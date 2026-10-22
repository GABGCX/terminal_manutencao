-- =====================================================================
-- Terminal Manutenção 3V3 · schema inicial
-- Rode inteiro no Supabase: SQL Editor > New query > colar > Run.
-- Pode rodar de novo sem quebrar (idempotente).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Perfis de usuário (1 linha por conta do Supabase Auth)
-- papel: admin (configura, gerencia usuários, apaga)
--        tecnico (registra placas, diário, materiais, conhecimento)
--        leitura (só vê: gestão)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  nome        text not null default '',
  papel       text not null default 'leitura' check (papel in ('admin', 'tecnico', 'leitura')),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- papel do usuário logado (null se inativo ou sem perfil)
create or replace function public.meu_papel()
returns text
language sql stable security definer
set search_path = public
as $$
  select papel from public.profiles where id = auth.uid() and ativo
$$;

-- cria o perfil quando alguém é convidado/criado no Auth.
-- O PRIMEIRO usuário vira admin; os seguintes entram como leitura até o admin mudar.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome, papel)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles where papel = 'admin') then 'leitura' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Configuração geral (uma linha só)
-- ---------------------------------------------------------------------
create table if not exists public.config (
  id             int primary key default 1 check (id = 1),
  tecnico        text not null default '',          -- responsável pelo setor (cabeçalho do relatório)
  alerta         int  not null default 3 check (alerta between 1 and 60),
  catalogo       jsonb,                             -- null = usa o catálogo padrão do app
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid default auth.uid() references public.profiles (id) on delete set null
);
insert into public.config (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Placas (cadastro). ID gerado pelo banco: MP-0001, MP-0002...
-- ---------------------------------------------------------------------
create sequence if not exists public.placa_seq;

create table if not exists public.placas (
  id            text primary key default ('MP-' || lpad(nextval('public.placa_seq')::text, 4, '0')),
  entrada       date not null,
  produto       text not null,
  versao        text,
  linha         text,
  tipo          text,
  origem        text not null,
  relatado      text not null check (length(relatado) <= 300),
  prio          text not null default 'Normal' check (prio in ('Urgente', 'Alta', 'Normal', 'Baixa')),
  serie         text,
  ref           text,
  defeito       text,
  causa         text,
  componentes   text,
  destino       text,
  exemplo       boolean not null default false,
  criado_por    uuid default auth.uid() references public.profiles (id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Diário de bordo: 1 linha por sessão de trabalho.
-- placa_id nulo = atividade GERAL (sem placa).
-- ---------------------------------------------------------------------
create table if not exists public.diario (
  id            uuid primary key default gen_random_uuid(),
  data          date not null,
  placa_id      text references public.placas (id) on update cascade on delete restrict,
  atividade     text not null,
  horas         numeric(5, 2) not null check (horas > 0 and horas <= 12),
  feito         text not null check (length(feito) <= 500),
  status        text,
  teste         text,
  componente    text,
  impedimento   text,
  material      text,
  destaque      text,
  obs           text,
  exemplo       boolean not null default false,
  autor         uuid default auth.uid() references public.profiles (id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint diario_status_placa check (placa_id is null or status is not null)
);
create index if not exists diario_placa_idx on public.diario (placa_id);
create index if not exists diario_data_idx  on public.diario (data);

-- ---------------------------------------------------------------------
-- Materiais e componentes pedidos
-- ---------------------------------------------------------------------
create table if not exists public.materiais (
  id            uuid primary key default gen_random_uuid(),
  data          date not null default current_date,
  item          text not null,
  spec          text,
  qtd           int not null default 1 check (qtd > 0),
  placa         text,                                  -- ID da placa, GERAL ou vazio
  urg           text not null default 'Normal',
  status        text not null default 'Solicitado' check (status in ('Solicitado', 'Aprovado', 'Comprado', 'Recebido', 'Cancelado')),
  recebido      date,
  obs           text,
  exemplo       boolean not null default false,
  criado_por    uuid default auth.uid() references public.profiles (id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Base de conhecimento (origem dos POPs)
-- ---------------------------------------------------------------------
create table if not exists public.conhecimento (
  id            uuid primary key default gen_random_uuid(),
  data          date not null default current_date,
  tipo          text not null,
  titulo        text not null,
  descricao     text,
  placas        text,
  produto       text,
  acao          text,
  resp          text,
  status        text not null default 'Registrado',
  exemplo       boolean not null default false,
  criado_por    uuid default auth.uid() references public.profiles (id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Textos manuais do relatório, por quinzena (ex.: 2026-10-2)
-- ---------------------------------------------------------------------
create table if not exists public.relatorios (
  quinzena       text primary key check (quinzena ~ '^\d{4}-\d{2}-[12]$'),
  comentario     text,
  decisoes       text,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid default auth.uid() references public.profiles (id) on delete set null
);

-- ---------------------------------------------------------------------
-- Gatilhos: data de atualização e autoria imutável
-- ---------------------------------------------------------------------
create or replace function public.tg_atualizado()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em := now();
  if tg_table_name = 'diario' then
    new.autor := old.autor;
  elsif tg_table_name in ('placas', 'materiais', 'conhecimento') then
    new.criado_por := old.criado_por;
  end if;
  if tg_table_name in ('config', 'relatorios') then
    new.atualizado_por := auth.uid();
  end if;
  return new;
end
$$;

do $$
declare t text;
begin
  foreach t in array array['placas', 'diario', 'materiais', 'conhecimento', 'relatorios', 'config'] loop
    execute format('drop trigger if exists tg_%1$s_atualizado on public.%1$I', t);
    execute format('create trigger tg_%1$s_atualizado before update on public.%1$I for each row execute function public.tg_atualizado()', t);
  end loop;
end $$;

-- impede que alguém se rebaixe/promova sem ser admin (reforço além da RLS)
create or replace function public.tg_profiles_guard()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.id := old.id;
  new.email := old.email;
  new.criado_em := old.criado_em;
  return new;
end
$$;
drop trigger if exists tg_profiles_guard on public.profiles;
create trigger tg_profiles_guard before update on public.profiles
  for each row execute function public.tg_profiles_guard();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.config       enable row level security;
alter table public.placas       enable row level security;
alter table public.diario       enable row level security;
alter table public.materiais    enable row level security;
alter table public.conhecimento enable row level security;
alter table public.relatorios   enable row level security;

-- limpa políticas antigas (para poder rodar de novo)
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public'
             and tablename in ('profiles', 'config', 'placas', 'diario', 'materiais', 'conhecimento', 'relatorios')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- profiles: cada um lê o próprio; usuários ativos leem todos (para mostrar nomes); só admin altera
create policy profiles_ler on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.meu_papel()) is not null);
create policy profiles_admin_altera on public.profiles for update to authenticated
  using ((select public.meu_papel()) = 'admin')
  with check ((select public.meu_papel()) = 'admin');

-- config: todos ativos leem, admin altera
create policy config_ler on public.config for select to authenticated
  using ((select public.meu_papel()) is not null);
create policy config_admin on public.config for update to authenticated
  using ((select public.meu_papel()) = 'admin')
  with check ((select public.meu_papel()) = 'admin');

-- placas: ativos leem; técnico e admin criam e alteram; só admin apaga
create policy placas_ler on public.placas for select to authenticated
  using ((select public.meu_papel()) is not null);
create policy placas_criar on public.placas for insert to authenticated
  with check ((select public.meu_papel()) in ('admin', 'tecnico'));
create policy placas_alterar on public.placas for update to authenticated
  using ((select public.meu_papel()) in ('admin', 'tecnico'))
  with check ((select public.meu_papel()) in ('admin', 'tecnico'));
create policy placas_apagar on public.placas for delete to authenticated
  using ((select public.meu_papel()) = 'admin');

-- diário: ativos leem; técnico cria em nome próprio; altera/apaga o próprio; admin tudo
create policy diario_ler on public.diario for select to authenticated
  using ((select public.meu_papel()) is not null);
create policy diario_criar on public.diario for insert to authenticated
  with check ((select public.meu_papel()) in ('admin', 'tecnico') and autor = (select auth.uid()));
create policy diario_alterar on public.diario for update to authenticated
  using ((select public.meu_papel()) = 'admin' or ((select public.meu_papel()) = 'tecnico' and autor = (select auth.uid())))
  with check ((select public.meu_papel()) in ('admin', 'tecnico'));
create policy diario_apagar on public.diario for delete to authenticated
  using ((select public.meu_papel()) = 'admin' or ((select public.meu_papel()) = 'tecnico' and autor = (select auth.uid())));

-- materiais e conhecimento: ativos leem; técnico e admin criam e alteram; apaga o autor ou admin
create policy materiais_ler on public.materiais for select to authenticated
  using ((select public.meu_papel()) is not null);
create policy materiais_criar on public.materiais for insert to authenticated
  with check ((select public.meu_papel()) in ('admin', 'tecnico'));
create policy materiais_alterar on public.materiais for update to authenticated
  using ((select public.meu_papel()) in ('admin', 'tecnico'))
  with check ((select public.meu_papel()) in ('admin', 'tecnico'));
create policy materiais_apagar on public.materiais for delete to authenticated
  using ((select public.meu_papel()) = 'admin' or ((select public.meu_papel()) = 'tecnico' and criado_por = (select auth.uid())));

create policy conhecimento_ler on public.conhecimento for select to authenticated
  using ((select public.meu_papel()) is not null);
create policy conhecimento_criar on public.conhecimento for insert to authenticated
  with check ((select public.meu_papel()) in ('admin', 'tecnico'));
create policy conhecimento_alterar on public.conhecimento for update to authenticated
  using ((select public.meu_papel()) in ('admin', 'tecnico'))
  with check ((select public.meu_papel()) in ('admin', 'tecnico'));
create policy conhecimento_apagar on public.conhecimento for delete to authenticated
  using ((select public.meu_papel()) = 'admin' or ((select public.meu_papel()) = 'tecnico' and criado_por = (select auth.uid())));

-- relatórios: ativos leem; técnico e admin escrevem
create policy relatorios_ler on public.relatorios for select to authenticated
  using ((select public.meu_papel()) is not null);
create policy relatorios_criar on public.relatorios for insert to authenticated
  with check ((select public.meu_papel()) in ('admin', 'tecnico'));
create policy relatorios_alterar on public.relatorios for update to authenticated
  using ((select public.meu_papel()) in ('admin', 'tecnico'))
  with check ((select public.meu_papel()) in ('admin', 'tecnico'));

-- anônimo não vê nada
revoke all on public.profiles, public.config, public.placas, public.diario, public.materiais, public.conhecimento, public.relatorios from anon;
grant select, insert, update, delete on public.placas, public.diario, public.materiais, public.conhecimento, public.relatorios to authenticated;
grant select, update on public.profiles, public.config to authenticated;
grant usage on sequence public.placa_seq to authenticated;
revoke execute on function public.meu_papel() from anon;
grant execute on function public.meu_papel() to authenticated;

-- ---------------------------------------------------------------------
-- Tempo real: todo mundo vê as mudanças dos outros na hora
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['placas', 'diario', 'materiais', 'conhecimento', 'relatorios', 'config', 'profiles'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
