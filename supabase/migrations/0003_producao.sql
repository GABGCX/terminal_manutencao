-- =====================================================================
-- 0003 · Produção: ordens, unidades, passagens pelos postos, NC e roteiros
-- Rode depois do 0001 e do 0002. Idempotente.
-- Papel novo: operador (registra produção; vê a manutenção sem editar).
-- =====================================================================

-- papel operador
alter table public.profiles drop constraint if exists profiles_papel_check;
alter table public.profiles add constraint profiles_papel_check check (papel in ('admin', 'tecnico', 'operador', 'leitura'));

-- meta diária de equipamentos concluídos (painel da produção)
alter table public.config add column if not exists meta_dia int not null default 0;

create sequence if not exists public.op_seq;
create sequence if not exists public.nc_seq;

-- ---------------------------------------------------------------------
-- Roteiro por produto (vem da planilha da linha; seed em supabase/seeds)
-- ---------------------------------------------------------------------
create table if not exists public.prod_roteiros (
  id         uuid primary key default gen_random_uuid(),
  produto    text not null,
  seq        int  not null,
  posto      text not null check (posto ~ '^P[1-8]$'),
  cod_op     text not null,
  operacao   text not null,
  setup      text,
  recurso    text,
  criterio   text,
  em_falha   text,
  tempo_min  numeric(6, 2) not null default 0,
  ref_pop    text,
  unique (produto, cod_op)
);

-- ---------------------------------------------------------------------
-- Ordem de produção (OP-0001...)
-- ---------------------------------------------------------------------
create table if not exists public.prod_ordens (
  id            text primary key default ('OP-' || lpad(nextval('public.op_seq')::text, 4, '0')),
  produto       text not null,
  quantidade    int  not null check (quantidade between 1 and 1000),
  lote          text,
  inicio        date not null default current_date,
  previsto      date,
  prio          text not null default 'Normal' check (prio in ('Urgente', 'Alta', 'Normal', 'Baixa')),
  status        text not null default 'Aberta' check (status in ('Aberta', 'Em produção', 'Concluída', 'Cancelada')),
  obs           text,
  criado_por    uuid default auth.uid() references public.profiles (id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Unidade (cada placa/equipamento da OP, com número de série único)
-- ---------------------------------------------------------------------
create table if not exists public.prod_unidades (
  id         uuid primary key default gen_random_uuid(),
  ordem_id   text not null references public.prod_ordens (id) on delete cascade,
  serie      text not null unique,
  produto    text not null,
  criado_em  timestamptz not null default now()
);
create index if not exists prod_unidades_ordem_idx on public.prod_unidades (ordem_id);

-- ---------------------------------------------------------------------
-- NC da linha (NC-0001...). Abre uma placa na manutenção (placa_id).
-- ---------------------------------------------------------------------
create table if not exists public.prod_nc (
  id          text primary key default ('NC-' || lpad(nextval('public.nc_seq')::text, 4, '0')),
  unidade_id  uuid not null references public.prod_unidades (id) on delete cascade,
  ordem_id    text references public.prod_ordens (id) on delete cascade,
  produto     text,
  posto       text not null,
  modo_falha  text,
  descricao   text,
  placa_id    text references public.placas (id) on update cascade on delete set null,
  status      text not null default 'Aberta' check (status in ('Aberta', 'Devolvida', 'Sucata')),
  criado_por  uuid default auth.uid() references public.profiles (id) on delete set null,
  criado_em   timestamptz not null default now(),
  fechado_em  timestamptz,
  fechado_por uuid references public.profiles (id) on delete set null
);
create index if not exists prod_nc_unidade_idx on public.prod_nc (unidade_id);

-- ---------------------------------------------------------------------
-- Passagem por um posto: aprovado (A) ou reprovado (R), com tempo
-- ---------------------------------------------------------------------
create table if not exists public.prod_eventos (
  id          uuid primary key default gen_random_uuid(),
  unidade_id  uuid not null references public.prod_unidades (id) on delete cascade,
  ordem_id    text references public.prod_ordens (id) on delete cascade,
  posto       text not null check (posto ~ '^P[1-8]$'),
  resultado   text not null check (resultado in ('A', 'R')),
  inicio      timestamptz,
  fim         timestamptz not null default now(),
  duracao_s   int check (duracao_s is null or duracao_s between 0 and 86400),
  checklist   jsonb,
  modo_falha  text,
  obs         text,
  nc_id       text references public.prod_nc (id) on delete set null,
  operador    uuid default auth.uid() references public.profiles (id) on delete set null,
  criado_em   timestamptz not null default now()
);
create index if not exists prod_eventos_unidade_idx on public.prod_eventos (unidade_id);
create index if not exists prod_eventos_criado_idx on public.prod_eventos (criado_em);

-- data de atualização e autoria imutável nas ordens
create or replace function public.tg_prod_ordens()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em := now();
  new.criado_por := old.criado_por;
  return new;
end
$$;
drop trigger if exists tg_prod_ordens on public.prod_ordens;
create trigger tg_prod_ordens before update on public.prod_ordens
  for each row execute function public.tg_prod_ordens();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.prod_roteiros enable row level security;
alter table public.prod_ordens   enable row level security;
alter table public.prod_unidades enable row level security;
alter table public.prod_nc       enable row level security;
alter table public.prod_eventos  enable row level security;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('prod_roteiros', 'prod_ordens', 'prod_unidades', 'prod_nc', 'prod_eventos')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- todos os ativos leem
create policy prod_roteiros_ler on public.prod_roteiros for select to authenticated using ((select public.meu_papel()) is not null);
create policy prod_ordens_ler   on public.prod_ordens   for select to authenticated using ((select public.meu_papel()) is not null);
create policy prod_unidades_ler on public.prod_unidades for select to authenticated using ((select public.meu_papel()) is not null);
create policy prod_nc_ler       on public.prod_nc       for select to authenticated using ((select public.meu_papel()) is not null);
create policy prod_eventos_ler  on public.prod_eventos  for select to authenticated using ((select public.meu_papel()) is not null);

-- roteiros: só admin altera (inclui aplicar tempo padrão medido)
create policy prod_roteiros_admin on public.prod_roteiros for all to authenticated
  using ((select public.meu_papel()) = 'admin') with check ((select public.meu_papel()) = 'admin');

-- ordens e unidades: operador e admin criam e alteram; só admin apaga
create policy prod_ordens_criar   on public.prod_ordens for insert to authenticated with check ((select public.meu_papel()) in ('admin', 'operador'));
create policy prod_ordens_alterar on public.prod_ordens for update to authenticated
  using ((select public.meu_papel()) in ('admin', 'operador')) with check ((select public.meu_papel()) in ('admin', 'operador'));
create policy prod_ordens_apagar  on public.prod_ordens for delete to authenticated using ((select public.meu_papel()) = 'admin');

create policy prod_unidades_criar   on public.prod_unidades for insert to authenticated with check ((select public.meu_papel()) in ('admin', 'operador'));
create policy prod_unidades_alterar on public.prod_unidades for update to authenticated
  using ((select public.meu_papel()) in ('admin', 'operador')) with check ((select public.meu_papel()) in ('admin', 'operador'));
create policy prod_unidades_apagar  on public.prod_unidades for delete to authenticated using ((select public.meu_papel()) = 'admin');

-- eventos: operador registra em nome próprio; só admin corrige ou apaga
create policy prod_eventos_criar on public.prod_eventos for insert to authenticated
  with check ((select public.meu_papel()) in ('admin', 'operador') and operador = (select auth.uid()));
create policy prod_eventos_alterar on public.prod_eventos for update to authenticated
  using ((select public.meu_papel()) = 'admin') with check ((select public.meu_papel()) = 'admin');
create policy prod_eventos_apagar on public.prod_eventos for delete to authenticated using ((select public.meu_papel()) = 'admin');

-- NC: operador e admin criam (pela função abrir_nc) e fecham (retorno ou sucata); só admin apaga
create policy prod_nc_criar on public.prod_nc for insert to authenticated with check ((select public.meu_papel()) in ('admin', 'operador'));
create policy prod_nc_alterar on public.prod_nc for update to authenticated
  using ((select public.meu_papel()) in ('admin', 'operador')) with check ((select public.meu_papel()) in ('admin', 'operador'));
create policy prod_nc_apagar on public.prod_nc for delete to authenticated using ((select public.meu_papel()) = 'admin');

-- ---------------------------------------------------------------------
-- abrir_nc: reprovação na linha vira NC + placa na manutenção, de uma vez.
-- Roda com permissão própria porque o operador não cadastra placas direto.
-- ---------------------------------------------------------------------
create or replace function public.abrir_nc(
  p_unidade uuid, p_posto text, p_modo text, p_descricao text, p_evento uuid,
  p_versao text default null, p_firmware text default null, p_linha text default null, p_tipo text default null)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  u record; v_nc text; v_placa text; v_rel text;
begin
  if public.meu_papel() not in ('admin', 'operador') then
    raise exception 'sem permissão para abrir NC' using errcode = '42501';
  end if;
  select * into u from public.prod_unidades where id = p_unidade;
  if not found then raise exception 'unidade não encontrada'; end if;
  if exists (select 1 from public.prod_nc where unidade_id = p_unidade and status = 'Aberta') then
    raise exception 'esta unidade já tem uma NC aberta';
  end if;

  insert into public.prod_nc (unidade_id, ordem_id, produto, posto, modo_falha, descricao)
  values (u.id, u.ordem_id, u.produto, p_posto, p_modo, p_descricao)
  returning id into v_nc;

  v_rel := left(p_posto || ' · ' || coalesce(p_modo, 'falha') || coalesce(': ' || nullif(p_descricao, ''), ''), 300);
  insert into public.placas (entrada, produto, versao, firmware, linha, tipo, origem, relatado, prio, serie, ref)
  values ((now() at time zone 'America/Fortaleza')::date, u.produto, p_versao, p_firmware, p_linha, p_tipo,
          'Linha de produção', v_rel, 'Normal', u.serie, v_nc || ' · ' || u.ordem_id)
  returning id into v_placa;

  update public.prod_nc set placa_id = v_placa where id = v_nc;
  if p_evento is not null then
    update public.prod_eventos set nc_id = v_nc where id = p_evento;
  end if;
  return json_build_object('nc', v_nc, 'placa', v_placa);
end
$$;
revoke execute on function public.abrir_nc(uuid, text, text, text, uuid, text, text, text, text) from public, anon;
grant execute on function public.abrir_nc(uuid, text, text, text, uuid, text, text, text, text) to authenticated;

grant select, insert, update, delete on public.prod_roteiros, public.prod_ordens, public.prod_unidades, public.prod_nc, public.prod_eventos to authenticated;
revoke all on public.prod_roteiros, public.prod_ordens, public.prod_unidades, public.prod_nc, public.prod_eventos from anon;
grant usage on sequence public.op_seq, public.nc_seq to authenticated;

-- tempo real
do $$
declare t text;
begin
  foreach t in array array['prod_roteiros', 'prod_ordens', 'prod_unidades', 'prod_nc', 'prod_eventos'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
