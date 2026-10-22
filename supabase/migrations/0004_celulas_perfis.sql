-- =====================================================================
-- 0004 · Células, perfis, habilidades, escala, lotes SMD, ordens de
--        fabricação, apontamentos e painel do hall.
-- Rode depois do 0003. Idempotente.
--
-- Perfis (coluna profiles.papel):
--   admin        Gestor: tudo
--   responsavel  Responsável de célula: registra na própria célula e onde tem habilidade >= 2
--   auxiliar     Auxiliar polivalente: registra só na célula da escala do dia (definida pelo gestor)
--   diretoria    Vê tudo, não registra
--   vendas       Vê produção e ordens (pedido, cliente, andamento), não vê manutenção
--   engenharia   Vê tudo, registra e responde na base de conhecimento
--   painel       Conta da TV do hall: só números agregados (função painel_hall)
--   pendente     Conta nova, sem acesso até o gestor liberar
-- =====================================================================

-- ---------------------------------------------------------------------
-- Células
-- ---------------------------------------------------------------------
create table if not exists public.celulas (
  codigo text primary key,
  nome   text not null,
  ordem  int  not null default 0
);
insert into public.celulas (codigo, nome, ordem) values
  ('SMD',  'SMD e montagem eletrônica', 1),
  ('USI',  'Usinagem e protótipo', 2),
  ('SER',  'Serralheria e estruturas', 3),
  ('INT',  'Integração robusta', 4),
  ('MONT', 'Montagem final, testes e expedição', 5),
  ('MAN',  'Manutenção', 6),
  ('GES',  'Gestão, qualidade e estoque', 7)
on conflict (codigo) do update set nome = excluded.nome, ordem = excluded.ordem;

-- ---------------------------------------------------------------------
-- Perfis: novos papéis, célula principal e cargo
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists celula text references public.celulas (codigo) on update cascade;
alter table public.profiles add column if not exists cargo text;
alter table public.profiles drop constraint if exists profiles_papel_check;
update public.profiles set celula = coalesce(celula, 'MAN'),  papel = 'responsavel' where papel = 'tecnico';
update public.profiles set celula = coalesce(celula, 'MONT'), papel = 'responsavel' where papel = 'operador';
update public.profiles set papel = 'diretoria' where papel = 'leitura';
update public.profiles set celula = coalesce(celula, 'GES') where papel = 'admin';
alter table public.profiles alter column papel set default 'pendente';
alter table public.profiles add constraint profiles_papel_check
  check (papel in ('admin', 'responsavel', 'auxiliar', 'diretoria', 'vendas', 'engenharia', 'painel', 'pendente'));

-- conta nova: a primeira vira admin; as outras ficam pendentes até o gestor liberar
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome, papel, celula)
  values (
    new.id, new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles where papel = 'admin') then 'pendente' else 'admin' end,
    case when exists (select 1 from public.profiles where papel = 'admin') then null else 'GES' end
  )
  on conflict (id) do nothing;
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- Habilidades (pessoa x célula, 0 a 4) e escala do dia
-- ---------------------------------------------------------------------
create table if not exists public.habilidades (
  pessoa uuid not null references public.profiles (id) on delete cascade,
  celula text not null references public.celulas (codigo) on update cascade,
  nivel  int  not null check (nivel between 0 and 4),
  primary key (pessoa, celula)
);
create table if not exists public.escala (
  data   date not null,
  pessoa uuid not null references public.profiles (id) on delete cascade,
  celula text not null references public.celulas (codigo) on update cascade,
  definido_por uuid default auth.uid() references public.profiles (id) on delete set null,
  primary key (data, pessoa)
);

-- ---------------------------------------------------------------------
-- Funções de permissão (usadas pelas políticas)
-- ---------------------------------------------------------------------
create or replace function public.hoje_local()
returns date language sql stable
as $$ select (now() at time zone 'America/Fortaleza')::date $$;

create or replace function public.pode_ver()
returns boolean language sql stable security definer
set search_path = public
as $$ select coalesce(public.meu_papel() in ('admin', 'responsavel', 'auxiliar', 'diretoria', 'engenharia'), false) $$;

create or replace function public.pode_ver_producao()
returns boolean language sql stable security definer
set search_path = public
as $$ select coalesce(public.meu_papel() in ('admin', 'responsavel', 'auxiliar', 'diretoria', 'engenharia', 'vendas'), false) $$;

create or replace function public.interno()
returns boolean language sql stable security definer
set search_path = public
as $$ select coalesce(public.meu_papel() in ('admin', 'responsavel', 'auxiliar'), false) $$;

create or replace function public.pode_registrar(p_celula text)
returns boolean language sql stable security definer
set search_path = public
as $$
  select coalesce((
    select case p.papel
      when 'admin' then true
      when 'responsavel' then p.celula = p_celula
        or exists (select 1 from public.habilidades h where h.pessoa = p.id and h.celula = p_celula and h.nivel >= 2)
      when 'auxiliar' then exists (select 1 from public.escala e where e.pessoa = p.id and e.celula = p_celula and e.data = public.hoje_local())
      else false end
    from public.profiles p where p.id = auth.uid() and p.ativo), false)
$$;

-- ---------------------------------------------------------------------
-- Produção: pedido/cliente na OP, célula no roteiro, lote SMD na unidade
-- ---------------------------------------------------------------------
alter table public.prod_ordens   add column if not exists pedido  text;
alter table public.prod_ordens   add column if not exists cliente text;
alter table public.prod_roteiros add column if not exists celula  text references public.celulas (codigo) on update cascade;

-- integração robusta (Bruno) x leve (Helder): só no P8; o gestor pode trocar pela aba Equipe
create or replace function public.celula_padrao(p_produto text, p_posto text)
returns text language sql immutable
as $$
  select case
    when p_posto <> 'P8' then 'MONT'
    when p_produto in ('FIR', 'DIR Nutri', 'DIR Dual Nutri', 'ECO PRO Nutri', 'ECO PRO Dual Nutri', 'ECO PRO 30N', 'EMR')
      or p_produto like 'Quadro%' then 'INT'
    else 'MONT' end
$$;
update public.prod_roteiros set celula = public.celula_padrao(produto, posto) where celula is null;

create or replace function public.tg_roteiro_celula()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if new.celula is null then new.celula := public.celula_padrao(new.produto, new.posto); end if;
  return new;
end
$$;
drop trigger if exists tg_roteiro_celula on public.prod_roteiros;
create trigger tg_roteiro_celula before insert on public.prod_roteiros
  for each row execute function public.tg_roteiro_celula();

create or replace function public.celula_posto(p_produto text, p_posto text)
returns text language sql stable security definer
set search_path = public
as $$
  select coalesce((select r.celula from public.prod_roteiros r where r.produto = p_produto and r.posto = p_posto and r.celula is not null limit 1),
                  public.celula_padrao(p_produto, p_posto))
$$;

create sequence if not exists public.lote_smd_seq;
create table if not exists public.prod_lotes_smd (
  id           text primary key default ('LS-' || lpad(nextval('public.lote_smd_seq')::text, 4, '0')),
  ordem_id     text references public.prod_ordens (id) on delete set null,
  produto      text not null,
  pcb          text,
  quantidade   int  not null check (quantidade between 1 and 5000),
  qtd_ok       int  not null default 0 check (qtd_ok >= 0),
  qtd_refugo   int  not null default 0 check (qtd_refugo >= 0),
  status       text not null default 'Aberto' check (status in ('Aberto', 'Em montagem', 'Concluído', 'Cancelado')),
  previsto     date,
  obs          text,
  criado_por   uuid default auth.uid() references public.profiles (id) on delete set null,
  criado_em    timestamptz not null default now(),
  concluido_em timestamptz
);
alter table public.prod_unidades add column if not exists lote_smd text references public.prod_lotes_smd (id) on delete set null;

create sequence if not exists public.of_seq;
create table if not exists public.prod_of (
  id           text primary key default ('OF-' || lpad(nextval('public.of_seq')::text, 4, '0')),
  celula       text not null references public.celulas (codigo) on update cascade check (celula in ('USI', 'SER')),
  item         text not null,
  quantidade   int  not null check (quantidade between 1 and 5000),
  qtd_feita    int  not null default 0 check (qtd_feita >= 0),
  ordem_id     text references public.prod_ordens (id) on delete set null,
  previsto     date,
  prio         text not null default 'Normal' check (prio in ('Urgente', 'Alta', 'Normal', 'Baixa')),
  status       text not null default 'Aberta' check (status in ('Aberta', 'Em execução', 'Concluída', 'Cancelada')),
  obs          text,
  criado_por   uuid default auth.uid() references public.profiles (id) on delete set null,
  criado_em    timestamptz not null default now(),
  concluido_em timestamptz
);

-- apontamento de horas por célula (produção, setup, desenvolvimento...)
create table if not exists public.apontamentos (
  id         uuid primary key default gen_random_uuid(),
  data       date not null,
  pessoa     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  celula     text not null references public.celulas (codigo) on update cascade,
  ref        text,
  atividade  text not null,
  horas      numeric(5, 2) not null check (horas > 0 and horas <= 12),
  qtd        int check (qtd is null or qtd >= 0),
  obs        text,
  criado_em  timestamptz not null default now()
);
create index if not exists apontamentos_data_idx on public.apontamentos (data);

-- NC registrada por auxiliar fica Pendente até o responsável confirmar
alter table public.prod_nc drop constraint if exists prod_nc_status_check;
alter table public.prod_nc add constraint prod_nc_status_check check (status in ('Pendente', 'Aberta', 'Devolvida', 'Sucata', 'Descartada'));

-- ---------------------------------------------------------------------
-- Reescrita das políticas (todas as tabelas de dados)
-- ---------------------------------------------------------------------
alter table public.celulas        enable row level security;
alter table public.habilidades    enable row level security;
alter table public.escala         enable row level security;
alter table public.prod_lotes_smd enable row level security;
alter table public.prod_of        enable row level security;
alter table public.apontamentos   enable row level security;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in (
             'profiles', 'config', 'placas', 'diario', 'materiais', 'conhecimento', 'relatorios',
             'prod_roteiros', 'prod_ordens', 'prod_unidades', 'prod_nc', 'prod_eventos',
             'celulas', 'habilidades', 'escala', 'prod_lotes_smd', 'prod_of', 'apontamentos')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- perfis: cada um lê o próprio; quem tem acesso lê os nomes; só o gestor altera
create policy profiles_ler on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.pode_ver_producao()));
create policy profiles_admin on public.profiles for update to authenticated
  using ((select public.meu_papel()) = 'admin') with check ((select public.meu_papel()) = 'admin');

create policy config_ler on public.config for select to authenticated using ((select public.pode_ver_producao()));
create policy config_admin on public.config for update to authenticated
  using ((select public.meu_papel()) = 'admin') with check ((select public.meu_papel()) = 'admin');

create policy celulas_ler on public.celulas for select to authenticated using ((select public.pode_ver_producao()));
create policy celulas_admin on public.celulas for all to authenticated
  using ((select public.meu_papel()) = 'admin') with check ((select public.meu_papel()) = 'admin');
create policy habilidades_ler on public.habilidades for select to authenticated using ((select public.pode_ver()));
create policy habilidades_admin on public.habilidades for all to authenticated
  using ((select public.meu_papel()) = 'admin') with check ((select public.meu_papel()) = 'admin');
create policy escala_ler on public.escala for select to authenticated using ((select public.pode_ver()));
create policy escala_admin on public.escala for all to authenticated
  using ((select public.meu_papel()) = 'admin') with check ((select public.meu_papel()) = 'admin');

-- manutenção: quem pode ver lê; registra quem pode registrar na célula MAN
create policy placas_ler on public.placas for select to authenticated using ((select public.pode_ver()));
create policy placas_criar on public.placas for insert to authenticated with check ((select public.pode_registrar('MAN')));
create policy placas_alterar on public.placas for update to authenticated
  using ((select public.pode_registrar('MAN'))) with check ((select public.pode_registrar('MAN')));
create policy placas_apagar on public.placas for delete to authenticated using ((select public.meu_papel()) = 'admin');

create policy diario_ler on public.diario for select to authenticated using ((select public.pode_ver()));
create policy diario_criar on public.diario for insert to authenticated
  with check ((select public.pode_registrar('MAN')) and autor = (select auth.uid()));
create policy diario_alterar on public.diario for update to authenticated
  using ((select public.meu_papel()) = 'admin' or ((select public.pode_registrar('MAN')) and autor = (select auth.uid())))
  with check ((select public.pode_registrar('MAN')));
create policy diario_apagar on public.diario for delete to authenticated
  using ((select public.meu_papel()) = 'admin' or ((select public.pode_registrar('MAN')) and autor = (select auth.uid())));

create policy materiais_ler on public.materiais for select to authenticated using ((select public.pode_ver()));
create policy materiais_criar on public.materiais for insert to authenticated with check ((select public.interno()));
create policy materiais_alterar on public.materiais for update to authenticated
  using ((select public.meu_papel()) in ('admin', 'responsavel') or criado_por = (select auth.uid()))
  with check ((select public.interno()));
create policy materiais_apagar on public.materiais for delete to authenticated
  using ((select public.meu_papel()) = 'admin' or ((select public.interno()) and criado_por = (select auth.uid())));

create policy conhecimento_ler on public.conhecimento for select to authenticated using ((select public.pode_ver()));
create policy conhecimento_criar on public.conhecimento for insert to authenticated
  with check ((select public.meu_papel()) in ('admin', 'responsavel', 'auxiliar', 'engenharia'));
create policy conhecimento_alterar on public.conhecimento for update to authenticated
  using ((select public.meu_papel()) in ('admin', 'responsavel', 'engenharia'))
  with check ((select public.meu_papel()) in ('admin', 'responsavel', 'engenharia'));
create policy conhecimento_apagar on public.conhecimento for delete to authenticated
  using ((select public.meu_papel()) = 'admin' or ((select public.meu_papel()) in ('responsavel', 'engenharia') and criado_por = (select auth.uid())));

create policy relatorios_ler on public.relatorios for select to authenticated using ((select public.pode_ver()));
create policy relatorios_criar on public.relatorios for insert to authenticated with check ((select public.pode_registrar('MAN')));
create policy relatorios_alterar on public.relatorios for update to authenticated
  using ((select public.pode_registrar('MAN'))) with check ((select public.pode_registrar('MAN')));

-- produção
create policy prod_roteiros_ler on public.prod_roteiros for select to authenticated using ((select public.pode_ver_producao()));
create policy prod_roteiros_admin on public.prod_roteiros for all to authenticated
  using ((select public.meu_papel()) = 'admin') with check ((select public.meu_papel()) = 'admin');

create policy prod_ordens_ler on public.prod_ordens for select to authenticated using ((select public.pode_ver_producao()));
create policy prod_ordens_criar on public.prod_ordens for insert to authenticated
  with check ((select public.meu_papel()) in ('admin', 'responsavel') and ((select public.pode_registrar('MONT')) or (select public.pode_registrar('INT'))));
create policy prod_ordens_alterar on public.prod_ordens for update to authenticated
  using ((select public.pode_registrar('MONT')) or (select public.pode_registrar('INT')))
  with check ((select public.pode_registrar('MONT')) or (select public.pode_registrar('INT')));
create policy prod_ordens_apagar on public.prod_ordens for delete to authenticated using ((select public.meu_papel()) = 'admin');

create policy prod_unidades_ler on public.prod_unidades for select to authenticated using ((select public.pode_ver_producao()));
create policy prod_unidades_criar on public.prod_unidades for insert to authenticated
  with check ((select public.meu_papel()) in ('admin', 'responsavel')
    and ((select public.pode_registrar('MONT')) or (select public.pode_registrar('INT')) or (select public.pode_registrar('SMD'))));
create policy prod_unidades_alterar on public.prod_unidades for update to authenticated
  using ((select public.pode_registrar('MONT')) or (select public.pode_registrar('INT')) or (select public.pode_registrar('SMD')))
  with check ((select public.pode_registrar('MONT')) or (select public.pode_registrar('INT')) or (select public.pode_registrar('SMD')));
create policy prod_unidades_apagar on public.prod_unidades for delete to authenticated using ((select public.meu_papel()) = 'admin');

create policy prod_eventos_ler on public.prod_eventos for select to authenticated using ((select public.pode_ver_producao()));
create policy prod_eventos_criar on public.prod_eventos for insert to authenticated
  with check (operador = (select auth.uid())
    and public.pode_registrar(public.celula_posto((select u.produto from public.prod_unidades u where u.id = unidade_id), posto)));
create policy prod_eventos_alterar on public.prod_eventos for update to authenticated
  using ((select public.meu_papel()) = 'admin') with check ((select public.meu_papel()) = 'admin');
create policy prod_eventos_apagar on public.prod_eventos for delete to authenticated using ((select public.meu_papel()) = 'admin');

create policy prod_nc_ler on public.prod_nc for select to authenticated using ((select public.pode_ver()));
create policy prod_nc_alterar on public.prod_nc for update to authenticated
  using (public.pode_registrar(public.celula_posto(produto, posto)))
  with check (public.pode_registrar(public.celula_posto(produto, posto)));
create policy prod_nc_apagar on public.prod_nc for delete to authenticated using ((select public.meu_papel()) = 'admin');

create policy lotes_smd_ler on public.prod_lotes_smd for select to authenticated using ((select public.pode_ver_producao()));
create policy lotes_smd_criar on public.prod_lotes_smd for insert to authenticated
  with check ((select public.meu_papel()) in ('admin', 'responsavel') and ((select public.pode_registrar('SMD')) or (select public.pode_registrar('MONT'))));
create policy lotes_smd_alterar on public.prod_lotes_smd for update to authenticated
  using ((select public.pode_registrar('SMD'))) with check ((select public.pode_registrar('SMD')));
create policy lotes_smd_apagar on public.prod_lotes_smd for delete to authenticated using ((select public.meu_papel()) = 'admin');

create policy of_ler on public.prod_of for select to authenticated using ((select public.pode_ver_producao()));
create policy of_criar on public.prod_of for insert to authenticated
  with check ((select public.meu_papel()) in ('admin', 'responsavel'));
create policy of_alterar on public.prod_of for update to authenticated
  using (public.pode_registrar(celula)) with check (public.pode_registrar(celula));
create policy of_apagar on public.prod_of for delete to authenticated using ((select public.meu_papel()) = 'admin');

create policy apont_ler on public.apontamentos for select to authenticated using ((select public.pode_ver()));
create policy apont_criar on public.apontamentos for insert to authenticated
  with check (pessoa = (select auth.uid()) and public.pode_registrar(celula));
create policy apont_alterar on public.apontamentos for update to authenticated
  using ((select public.meu_papel()) = 'admin' or pessoa = (select auth.uid()))
  with check ((select public.meu_papel()) = 'admin' or (pessoa = (select auth.uid()) and public.pode_registrar(celula)));
create policy apont_apagar on public.apontamentos for delete to authenticated
  using ((select public.meu_papel()) = 'admin' or pessoa = (select auth.uid()));

-- ---------------------------------------------------------------------
-- NC: auxiliar registra como Pendente; responsável confirma (e aí vai para a manutenção)
-- ---------------------------------------------------------------------
drop function if exists public.abrir_nc(uuid, text, text, text, uuid, text, text, text, text);
create or replace function public.abrir_nc(
  p_unidade uuid, p_posto text, p_modo text, p_descricao text, p_evento uuid,
  p_versao text default null, p_firmware text default null, p_linha text default null, p_tipo text default null)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  u record; v_nc text; v_placa text; v_rel text; v_cel text; v_papel text;
begin
  select * into u from public.prod_unidades where id = p_unidade;
  if not found then raise exception 'unidade não encontrada'; end if;
  v_cel := public.celula_posto(u.produto, p_posto);
  if not public.pode_registrar(v_cel) then
    raise exception 'sem permissão para registrar na célula %', v_cel using errcode = '42501';
  end if;
  if exists (select 1 from public.prod_nc where unidade_id = p_unidade and status in ('Aberta', 'Pendente')) then
    raise exception 'esta unidade já tem uma NC aberta';
  end if;
  v_papel := public.meu_papel();

  insert into public.prod_nc (unidade_id, ordem_id, produto, posto, modo_falha, descricao, status)
  values (u.id, u.ordem_id, u.produto, p_posto, p_modo, p_descricao, case when v_papel = 'auxiliar' then 'Pendente' else 'Aberta' end)
  returning id into v_nc;
  if p_evento is not null then
    update public.prod_eventos set nc_id = v_nc where id = p_evento;
  end if;
  if v_papel = 'auxiliar' then
    return json_build_object('nc', v_nc, 'placa', null, 'pendente', true);
  end if;

  v_rel := left(p_posto || ' · ' || coalesce(p_modo, 'falha') || coalesce(': ' || nullif(p_descricao, ''), ''), 300);
  insert into public.placas (entrada, produto, versao, firmware, linha, tipo, origem, relatado, prio, serie, ref)
  values (public.hoje_local(), u.produto, p_versao, p_firmware, p_linha, p_tipo,
          'Linha de produção', v_rel, 'Normal', u.serie, v_nc || ' · ' || u.ordem_id)
  returning id into v_placa;
  update public.prod_nc set placa_id = v_placa where id = v_nc;
  return json_build_object('nc', v_nc, 'placa', v_placa, 'pendente', false);
end
$$;

create or replace function public.confirmar_nc(
  p_nc text, p_versao text default null, p_firmware text default null, p_linha text default null, p_tipo text default null)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  n record; u record; v_placa text; v_rel text;
begin
  select * into n from public.prod_nc where id = p_nc;
  if not found then raise exception 'NC não encontrada'; end if;
  if n.status <> 'Pendente' then raise exception 'a NC % não está pendente', p_nc; end if;
  if public.meu_papel() not in ('admin', 'responsavel') or not public.pode_registrar(public.celula_posto(n.produto, n.posto)) then
    raise exception 'só o responsável da célula confirma a NC' using errcode = '42501';
  end if;
  select * into u from public.prod_unidades where id = n.unidade_id;
  v_rel := left(n.posto || ' · ' || coalesce(n.modo_falha, 'falha') || coalesce(': ' || nullif(n.descricao, ''), ''), 300);
  insert into public.placas (entrada, produto, versao, firmware, linha, tipo, origem, relatado, prio, serie, ref)
  values (public.hoje_local(), n.produto, p_versao, p_firmware, p_linha, p_tipo,
          'Linha de produção', v_rel, 'Normal', u.serie, n.id || ' · ' || n.ordem_id)
  returning id into v_placa;
  update public.prod_nc set placa_id = v_placa, status = 'Aberta' where id = p_nc;
  return json_build_object('nc', p_nc, 'placa', v_placa);
end
$$;

-- ---------------------------------------------------------------------
-- Painel do hall: só números agregados, sem nomes, clientes ou séries
-- ---------------------------------------------------------------------
create or replace function public.painel_hall()
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_hoje date := public.hoje_local();
  r json;
begin
  if public.meu_papel() is null or public.meu_papel() = 'pendente' then
    raise exception 'sem acesso' using errcode = '42501';
  end if;
  with fim_rota as (
    select produto, max(posto) as posto_final from public.prod_roteiros group by produto
  ), concl as (
    select u.id, min((e.fim at time zone 'America/Fortaleza')::date) as dia
    from public.prod_unidades u
    join fim_rota f on f.produto = u.produto
    join public.prod_eventos e on e.unidade_id = u.id and e.posto = f.posto_final and e.resultado = 'A'
    group by u.id
  ), ev30 as (
    select unidade_id, bool_or(resultado = 'R') as reprovou
    from public.prod_eventos where fim >= now() - interval '30 days' group by unidade_id
  )
  select json_build_object(
    'data', v_hoje,
    'meta_dia', (select meta_dia from public.config where id = 1),
    'concluidas_hoje', (select count(*) from concl where dia = v_hoje),
    'concluidas_semana', (select count(*) from concl where dia > v_hoje - 7),
    'concluidas_14d', (select coalesce(json_agg(json_build_object('dia', d::date, 'n', (select count(*) from concl where dia = d::date)) order by d), '[]'::json)
                       from generate_series(v_hoje - 13, v_hoje, interval '1 day') d),
    'ops_andamento', (select count(*) from public.prod_ordens where status in ('Aberta', 'Em produção')),
    'ops_atrasadas', (select count(*) from public.prod_ordens where status in ('Aberta', 'Em produção') and previsto < v_hoje),
    'fpy_30d', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where not reprovou) / count(*)) end from ev30),
    'nc_abertas', (select count(*) from public.prod_nc where status in ('Aberta', 'Pendente')),
    'placas_manutencao', (select count(*) from public.placas p
                          where not exists (select 1 from public.diario d where d.placa_id = p.id
                                            and d.status in ('Concluída: reparada', 'Concluída: sem defeito', 'Irrecuperável', 'Devolvida sem reparo')
                                            and not exists (select 1 from public.diario d2 where d2.placa_id = p.id and (d2.data, d2.criado_em) > (d.data, d.criado_em)))),
    'lotes_smd_abertos', (select count(*) from public.prod_lotes_smd where status in ('Aberto', 'Em montagem')),
    'of_usinagem', (select count(*) from public.prod_of where celula = 'USI' and status in ('Aberta', 'Em execução')),
    'of_serralheria', (select count(*) from public.prod_of where celula = 'SER' and status in ('Aberta', 'Em execução')),
    'horas_hoje', (select coalesce(sum(horas), 0) from public.apontamentos where data = v_hoje)
  ) into r;
  return r;
end
$$;

revoke execute on function public.abrir_nc(uuid, text, text, text, uuid, text, text, text, text) from public, anon;
revoke execute on function public.confirmar_nc(text, text, text, text, text) from public, anon;
revoke execute on function public.painel_hall() from public, anon;
grant execute on function public.abrir_nc(uuid, text, text, text, uuid, text, text, text, text) to authenticated;
grant execute on function public.confirmar_nc(text, text, text, text, text) to authenticated;
grant execute on function public.painel_hall() to authenticated;
grant execute on function public.pode_ver(), public.pode_ver_producao(), public.interno(), public.pode_registrar(text), public.celula_posto(text, text), public.hoje_local() to authenticated;

grant select, insert, update, delete on public.celulas, public.habilidades, public.escala, public.prod_lotes_smd, public.prod_of, public.apontamentos to authenticated;
revoke all on public.celulas, public.habilidades, public.escala, public.prod_lotes_smd, public.prod_of, public.apontamentos from anon;
revoke insert on public.prod_nc from authenticated;   -- NC só nasce pela função abrir_nc
grant usage on sequence public.lote_smd_seq, public.of_seq to authenticated;

do $$
declare t text;
begin
  foreach t in array array['celulas', 'habilidades', 'escala', 'prod_lotes_smd', 'prod_of', 'apontamentos'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
