-- =============================================================================
-- KEYCON — planos de assinatura: o que cada plano permite e o plano de cada conta
-- -----------------------------------------------------------------------------
-- Como usar: rode DEPOIS do supabase/locker.sql (Supabase → SQL Editor → Run).
-- Pode rodar de novo sem perder nada (cria só o que falta e atualiza os limites).
--
-- Planos: free (sem assinatura), basic, plus, pro e enterprise (combinado com o
-- suporte). A cobrança é só pelas lojas (App Store no iPhone, Google Play no
-- Android), via RevenueCat: quem grava o plano de cada conta é o servidor (chave
-- service_role). A pessoa só LÊ o próprio plano.
--
-- Teste grátis: 7 dias com tudo do Plus (period = 'trial'). Sem assinar depois,
-- a conta volta ao free.
--
-- Assinatura vencida ou cancelada: a conta passa a valer como free na hora (não
-- envia nada novo além do que o free permite) e os arquivos ficam guardados por
-- 30 dias (grace_until); depois disso ficam só os 3 arquivos do free.
-- Plano menor que passa do novo limite: 30 dias para escolher o que manter
-- (over_limit_since); depois saem os arquivos mais recentes que passam do limite.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. O que cada plano permite (null = sem limite)
-- -----------------------------------------------------------------------------
create table if not exists public.plan_limits (
  plan                   text primary key,
  name                   text not null,
  -- Espaço no Locker (null = combinado com o suporte: locker_plans.limit_bytes)
  limit_bytes            bigint,
  -- Tamanho máximo de cada arquivo, por tipo
  max_image_bytes        bigint not null,
  max_video_bytes        bigint not null,
  max_other_bytes        bigint not null,
  -- Quantos arquivos e pastas de arquivos (free: 1 pasta com 3 arquivos)
  max_files              integer,
  max_folders            integer,
  -- Produtos e atalhos (ficam no aparelho; o app confere)
  max_products           integer,
  max_product_folders    integer,
  max_shortcuts_per_kind integer,
  -- Compartilhar com pessoas por e-mail (pessoas diferentes)
  max_share_people       integer,
  -- Equipes e dependentes (as pessoas das equipes, criadas pela empresa)
  max_teams              integer,
  max_dependents         integer,
  -- Pasta por link (a vitrine pública foi adiada)
  folder_links           boolean not null default false,
  -- Arquivos sem internet no Locker do computador
  offline_web            boolean not null default false,
  -- Locker (no computador, compartilhar), agenda e CRM
  locker                 boolean not null default false,
  agenda                 boolean not null default false,
  crm                    boolean not null default false,
  -- Quantos dias a lixeira guarda
  trash_days             integer not null default 30,
  priority_support       boolean not null default false,
  updated_at             timestamptz not null default now()
);

insert into public.plan_limits (
  plan, name, limit_bytes, max_image_bytes, max_video_bytes, max_other_bytes,
  max_files, max_folders, max_products, max_product_folders, max_shortcuts_per_kind,
  max_share_people, max_teams, max_dependents,
  folder_links, offline_web, locker, agenda, crm, trash_days, priority_support
) values
  -- Sem assinatura: 1 pasta com 3 arquivos, 1 pasta com 3 produtos, 1 atalho de cada formato
  ('free',       'Free',        209715200,    16777216,   67108864, 10485760,  3,    1,    3,    1,    1,    0,    0,    0,    false, false, false, false, false, 30, false),
  ('basic',      'Basic',       5368709120,   16777216,   67108864, 10485760,  null, null, null, null, null, 3,    0,    0,    false, false, true,  true,  true,  30, false),
  ('plus',       'Plus',        21474836480,  33554432,  268435456, 52428800,  null, null, null, null, null, null, 1,    5,    true,  true,  true,  true,  true,  60, false),
  ('pro',        'Pro',         107374182400, 67108864, 1073741824, 209715200, null, null, null, null, null, null, 5,    50,   true,  true,  true,  true,  true,  90, true),
  -- Enterprise: espaço combinado (locker_plans.limit_bytes); equipes sem limite (futuro)
  ('enterprise', 'Enterprise',  null,         67108864, 1073741824, 209715200, null, null, null, null, null, null, null, null, true,  true,  true,  true,  true,  90, true)
on conflict (plan) do update set
  name = excluded.name, limit_bytes = excluded.limit_bytes,
  max_image_bytes = excluded.max_image_bytes, max_video_bytes = excluded.max_video_bytes, max_other_bytes = excluded.max_other_bytes,
  max_files = excluded.max_files, max_folders = excluded.max_folders,
  max_products = excluded.max_products, max_product_folders = excluded.max_product_folders,
  max_shortcuts_per_kind = excluded.max_shortcuts_per_kind,
  max_share_people = excluded.max_share_people, max_teams = excluded.max_teams, max_dependents = excluded.max_dependents,
  folder_links = excluded.folder_links, offline_web = excluded.offline_web,
  locker = excluded.locker, agenda = excluded.agenda, crm = excluded.crm,
  trash_days = excluded.trash_days, priority_support = excluded.priority_support,
  updated_at = now();

-- Todo mundo pode ler a tabela de planos (a tela de planos mostra a comparação)
alter table public.plan_limits enable row level security;
drop policy if exists "planos: todos leem" on public.plan_limits;
create policy "planos: todos leem" on public.plan_limits for select using (true);

-- -----------------------------------------------------------------------------
-- 2. O plano de cada conta (a tabela locker_plans já existe: ganha a assinatura)
-- -----------------------------------------------------------------------------
alter table public.locker_plans add column if not exists store text not null default 'manual';
alter table public.locker_plans add column if not exists product_id text;
alter table public.locker_plans add column if not exists period text not null default 'normal';
-- Até quando vale (null = sem vencimento: plano dado à mão pelo suporte)
alter table public.locker_plans add column if not exists expires_at timestamptz;
alter table public.locker_plans add column if not exists will_renew boolean not null default true;
-- Desde quando a conta passa do limite do plano (plano menor): conta os 30 dias
alter table public.locker_plans add column if not exists over_limit_since timestamptz;
-- Data do último aviso da loja (ignora aviso antigo que chega atrasado)
alter table public.locker_plans add column if not exists event_at timestamptz;

alter table public.locker_plans drop constraint if exists locker_plans_plan_check;
alter table public.locker_plans
  add constraint locker_plans_plan_check check (plan in ('free', 'basic', 'plus', 'pro', 'enterprise'));
alter table public.locker_plans drop constraint if exists locker_plans_store_check;
alter table public.locker_plans
  add constraint locker_plans_store_check check (store in ('app_store', 'play_store', 'manual'));
alter table public.locker_plans drop constraint if exists locker_plans_period_check;
alter table public.locker_plans
  add constraint locker_plans_period_check check (period in ('normal', 'trial'));

-- -----------------------------------------------------------------------------
-- 3. Plano que vale agora (assinatura vencida = free)
-- -----------------------------------------------------------------------------
-- Só o servidor e as regras do banco chamam (não revela o plano de outras contas)
create or replace function public.plan_of(uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when p.expires_at is null or p.expires_at > now() then p.plan else 'free' end
       from public.locker_plans p where p.user_id = uid),
    'free');
$$;
revoke all on function public.plan_of(uuid) from public, anon, authenticated;

-- Os limites que valem agora para a conta (enterprise: o espaço combinado)
create or replace function public.plan_limits_of(uid uuid)
returns public.plan_limits
language sql
stable
security definer
set search_path = public
as $$
  select l.plan, l.name,
         coalesce(l.limit_bytes, (select p.limit_bytes from public.locker_plans p where p.user_id = uid)),
         l.max_image_bytes, l.max_video_bytes, l.max_other_bytes,
         l.max_files, l.max_folders, l.max_products, l.max_product_folders, l.max_shortcuts_per_kind,
         l.max_share_people, l.max_teams, l.max_dependents,
         l.folder_links, l.offline_web, l.locker, l.agenda, l.crm,
         l.trash_days, l.priority_support, l.updated_at
    from public.plan_limits l
   where l.plan = public.plan_of(uid);
$$;
revoke all on function public.plan_limits_of(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. O que o app, o teclado e o Locker web leem: o próprio plano, os limites,
--    o que já usou e se pode enviar mais
-- -----------------------------------------------------------------------------
create or replace function public.my_plan()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.locker_plans;
  l public.plan_limits;
  used bigint;
  n_files integer;
  n_folders integer;
  status text;
  grace timestamptz;
  over boolean;
begin
  if uid is null then
    return null;
  end if;
  select * into p from public.locker_plans where user_id = uid;
  l := public.plan_limits_of(uid);

  select coalesce(sum(f.size_bytes) filter (where f.storage <> 'link'), 0), count(*)
    into used, n_files
    from public.locker_files f where f.user_id = uid;
  select count(*) into n_folders from public.locker_folders where user_id = uid;

  -- free · trial (teste do Plus) · active · expired (vencida: arquivos guardados até grace_until)
  if p.user_id is null or p.plan = 'free' then
    status := 'free';
  elsif p.expires_at is not null and p.expires_at <= now() then
    grace := p.expires_at + interval '30 days';
    status := case when grace > now() then 'expired' else 'free' end;
  elsif p.period = 'trial' then
    status := 'trial';
  else
    status := 'active';
  end if;

  over := (l.limit_bytes is not null and used > l.limit_bytes)
       or (l.max_files is not null and n_files > l.max_files)
       or (l.max_folders is not null and n_folders > l.max_folders);

  return jsonb_build_object(
    'plan', l.plan,
    'paid_plan', p.plan,
    'status', status,
    'store', coalesce(p.store, 'manual'),
    'expires_at', p.expires_at,
    'will_renew', coalesce(p.will_renew, false),
    'grace_until', grace,
    'over_limit', over,
    'over_limit_since', p.over_limit_since,
    'used_bytes', used,
    'files', n_files,
    'folders', n_folders,
    'limits', to_jsonb(l) - 'updated_at'
  );
end;
$$;
grant execute on function public.my_plan() to authenticated;

-- Espaço usado e limite (mesmas colunas de antes: app e Locker web já usam)
create or replace function public.locker_usage()
returns table (used_bytes bigint, limit_bytes bigint, plan text)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(f.size_bytes) from public.locker_files f where f.user_id = auth.uid() and f.storage <> 'link'), 0)::bigint,
    (public.plan_limits_of(auth.uid())).limit_bytes,
    public.plan_of(auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- 5. Travas do banco: ninguém passa do plano, nem mexendo no aparelho.
--    O erro começa com "plan_limit:" (o app reconhece e não fica tentando de novo).
--    Só valem para linhas NOVAS: quem já passou do limite (plano menor) não perde
--    nada, só não cria mais.
-- -----------------------------------------------------------------------------
create or replace function public.plan_check_files()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.plan_limits := public.plan_limits_of(new.user_id);
begin
  if l.max_files is not null and (select count(*) from public.locker_files where user_id = new.user_id) > l.max_files then
    raise exception 'plan_limit:files' using errcode = 'P0001', hint = l.max_files::text;
  end if;
  return null;
end;
$$;
drop trigger if exists plan_check_files on public.locker_files;
create trigger plan_check_files after insert on public.locker_files
  for each row execute function public.plan_check_files();

create or replace function public.plan_check_folders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.plan_limits := public.plan_limits_of(new.user_id);
begin
  if l.max_folders is not null and (select count(*) from public.locker_folders where user_id = new.user_id) > l.max_folders then
    raise exception 'plan_limit:folders' using errcode = 'P0001', hint = l.max_folders::text;
  end if;
  -- Pasta por link: só nos planos Plus e Pro
  if new.visibility <> 'private' and not l.folder_links then
    raise exception 'plan_limit:folder_links' using errcode = 'P0001';
  end if;
  return null;
end;
$$;
drop trigger if exists plan_check_folders on public.locker_folders;
create trigger plan_check_folders after insert on public.locker_folders
  for each row execute function public.plan_check_folders();

-- Mudar uma pasta para "link" ou "pública" (só quando a mudança é essa)
create or replace function public.plan_check_folder_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.visibility <> 'private' and not (public.plan_limits_of(new.user_id)).folder_links then
    raise exception 'plan_limit:folder_links' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists plan_check_folder_visibility on public.locker_folders;
create trigger plan_check_folder_visibility before update on public.locker_folders
  for each row when (new.visibility is distinct from old.visibility)
  execute function public.plan_check_folder_visibility();

-- Compartilhar com pessoas por e-mail: quantas pessoas diferentes
create or replace function public.plan_check_shares()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.plan_limits := public.plan_limits_of(new.owner_id);
begin
  if not l.locker then
    raise exception 'plan_limit:locker' using errcode = 'P0001';
  end if;
  if new.grantee_email is not null and l.max_share_people is not null
     and (select count(distinct s.grantee_email) from public.locker_shares s
           where s.owner_id = new.owner_id and s.grantee_email is not null) > l.max_share_people then
    raise exception 'plan_limit:share_people' using errcode = 'P0001', hint = l.max_share_people::text;
  end if;
  return null;
end;
$$;
drop trigger if exists plan_check_shares on public.locker_shares;
create trigger plan_check_shares after insert on public.locker_shares
  for each row execute function public.plan_check_shares();

-- Equipes e pessoas nas equipes
create or replace function public.plan_check_teams()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.plan_limits := public.plan_limits_of(new.owner_id);
begin
  if l.max_teams is not null and (select count(*) from public.locker_teams where owner_id = new.owner_id) > l.max_teams then
    raise exception 'plan_limit:teams' using errcode = 'P0001', hint = l.max_teams::text;
  end if;
  return null;
end;
$$;
drop trigger if exists plan_check_teams on public.locker_teams;
create trigger plan_check_teams after insert on public.locker_teams
  for each row execute function public.plan_check_teams();

create or replace function public.plan_check_team_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid := (select t.owner_id from public.locker_teams t where t.id = new.team_id);
  l public.plan_limits := public.plan_limits_of(owner);
begin
  if l.max_dependents is not null
     and (select count(distinct m.email) from public.locker_team_members m
            join public.locker_teams t on t.id = m.team_id
           where t.owner_id = owner) > l.max_dependents then
    raise exception 'plan_limit:dependents' using errcode = 'P0001', hint = l.max_dependents::text;
  end if;
  return null;
end;
$$;
drop trigger if exists plan_check_team_members on public.locker_team_members;
create trigger plan_check_team_members after insert on public.locker_team_members
  for each row execute function public.plan_check_team_members();

-- -----------------------------------------------------------------------------
-- 6. Passou do limite do plano: 30 dias para escolher o que manter
--    (assinatura vencida = free; plano menor = o limite novo). Quem marca o começo
--    dos 30 dias e acha quem já passou do prazo é a limpeza diária (locker-purge):
--    no fim do prazo saem os arquivos mais RECENTES que passam do limite (pela data
--    de envio, nunca ao acaso) e, no free, ficam numa pasta só.
-- -----------------------------------------------------------------------------
create or replace function public.plan_is_over(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with l as (select * from public.plan_limits_of(uid)),
       f as (select coalesce(sum(size_bytes) filter (where storage <> 'link'), 0) as used, count(*) as n
               from public.locker_files where user_id = uid),
       d as (select count(*) as n from public.locker_folders where user_id = uid)
  select (l.limit_bytes is not null and f.used > l.limit_bytes)
      or (l.max_files is not null and f.n > l.max_files)
      or (l.max_folders is not null and d.n > l.max_folders)
    from l, f, d;
$$;
revoke all on function public.plan_is_over(uuid) from public, anon, authenticated;

-- Marca/desmarca o começo dos 30 dias de cada conta e devolve quem já passou do prazo
create or replace function public.plan_scan_over_limit()
returns table (overdue_user uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  p public.locker_plans;
  over boolean;
begin
  for r in
    select distinct x.uid from (
      select lf.user_id as uid from public.locker_files lf
      union
      select lo.user_id as uid from public.locker_folders lo
    ) x
  loop
    over := public.plan_is_over(r.uid);
    p := null;
    select * into p from public.locker_plans lp where lp.user_id = r.uid;
    if over then
      if p.user_id is null then
        -- Nunca assinou: a linha guarda só a data (continua free)
        insert into public.locker_plans (user_id, plan, over_limit_since) values (r.uid, 'free', now());
      elsif p.over_limit_since is null then
        -- Assinatura vencida: os 30 dias contam do vencimento
        update public.locker_plans lp
           set over_limit_since = case when lp.expires_at is not null and lp.expires_at < now() then lp.expires_at else now() end
         where lp.user_id = r.uid;
      elsif p.over_limit_since < now() - interval '30 days' then
        overdue_user := r.uid;
        return next;
      end if;
    elsif p.user_id is not null and p.over_limit_since is not null then
      -- Voltou a caber (apagou arquivos ou assinou um plano maior)
      update public.locker_plans lp set over_limit_since = null where lp.user_id = r.uid;
    end if;
  end loop;
end;
$$;
revoke all on function public.plan_scan_over_limit() from public, anon, authenticated;

-- =============================================================================
-- 7. Conta empresa: dependentes (Plus: 1 equipe com até 5 pessoas; Pro: 5 equipes
--    com até 50 pessoas)
-- -----------------------------------------------------------------------------
-- A empresa (a conta que assina) cria o acesso de cada dependente: um login
-- próprio, preso à empresa (não é uma conta comum). O dependente:
--  - vê e baixa o Locker da empresa (só leitura) no app, no teclado e no Locker web;
--  - tem teclado, produtos, atalhos, CRM e agenda só dele;
--  - não vê assinaturas nem dados da empresa e não sai sozinho (só a empresa remove);
--  - fica BLOQUEADO (nada é apagado) se a assinatura da empresa vencer, até renovar.
-- As pessoas das equipes são os dependentes (locker_team_members segue sozinho).
-- Quem cria e remove os logins é a função "company" (chave service_role).
-- =============================================================================
create table if not exists public.company_members (
  member_id   uuid primary key references auth.users (id) on delete cascade,
  company_id  uuid not null references auth.users (id) on delete cascade,
  name        text not null default '',
  email       text not null,
  team_id     uuid references public.locker_teams (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint company_members_not_self check (member_id <> company_id)
);
create index if not exists company_members_company_idx on public.company_members (company_id);

alter table public.company_members enable row level security;
drop policy if exists "dependentes: empresa e o proprio veem" on public.company_members;
create policy "dependentes: empresa e o proprio veem" on public.company_members
  for select using (company_id = auth.uid() or member_id = auth.uid());
-- A empresa muda o nome e a equipe (criar e remover é pela função "company")
drop policy if exists "dependentes: empresa muda" on public.company_members;
create policy "dependentes: empresa muda" on public.company_members
  for update using (company_id = auth.uid()) with check (company_id = auth.uid());

-- Empresa da conta (null = não é dependente)
create or replace function public.company_of(uid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.company_id from public.company_members m where m.member_id = uid;
$$;
revoke all on function public.company_of(uuid) from public, anon, authenticated;

-- O plano do dependente é o da empresa
create or replace function public.plan_of(uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when p.expires_at is null or p.expires_at > now() then p.plan else 'free' end
       from public.locker_plans p where p.user_id = coalesce(public.company_of(uid), uid)),
    'free');
$$;
revoke all on function public.plan_of(uuid) from public, anon, authenticated;

create or replace function public.plan_limits_of(uid uuid)
returns public.plan_limits
language sql
stable
security definer
set search_path = public
as $$
  select l.plan, l.name,
         coalesce(l.limit_bytes, (select p.limit_bytes from public.locker_plans p where p.user_id = coalesce(public.company_of(uid), uid))),
         l.max_image_bytes, l.max_video_bytes, l.max_other_bytes,
         l.max_files, l.max_folders, l.max_products, l.max_product_folders, l.max_shortcuts_per_kind,
         l.max_share_people, l.max_teams, l.max_dependents,
         l.folder_links, l.offline_web, l.locker, l.agenda, l.crm,
         l.trash_days, l.priority_support, l.updated_at
    from public.plan_limits l
   where l.plan = public.plan_of(uid);
$$;
revoke all on function public.plan_limits_of(uuid) from public, anon, authenticated;

-- A assinatura da empresa vale e inclui dependentes? (Enterprise: sem limite)
create or replace function public.company_active(company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when l.max_dependents is null then l.plan = 'enterprise'
    else l.max_dependents > 0
  end
  from public.plan_limits_of(company) l;
$$;
revoke all on function public.company_active(uuid) from public, anon, authenticated;

-- O Locker que a pessoa vê como dependente (null = não é dependente ou a empresa está bloqueada)
create or replace function public.locker_company_for_me()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select x.c from (select public.company_of(auth.uid()) as c) x
   where x.c is not null and coalesce(public.company_active(x.c), false);
$$;
grant execute on function public.locker_company_for_me() to authenticated;

-- Leitura do Locker da empresa pelos dependentes (soma às outras regras de leitura)
drop policy if exists "pastas da empresa (dependentes leem)" on public.locker_folders;
create policy "pastas da empresa (dependentes leem)" on public.locker_folders
  for select using (user_id = public.locker_company_for_me() and trashed_at is null);
drop policy if exists "arquivos da empresa (dependentes leem)" on public.locker_files;
create policy "arquivos da empresa (dependentes leem)" on public.locker_files
  for select using (user_id = public.locker_company_for_me() and trashed_at is null);

-- Dependente não guarda arquivos próprios no Locker (o Locker dele é o da empresa)
create or replace function public.plan_check_not_dependent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.company_of(new.user_id) is not null then
    raise exception 'plan_limit:dependent' using errcode = 'P0001';
  end if;
  return null;
end;
$$;
drop trigger if exists plan_check_not_dependent_files on public.locker_files;
create trigger plan_check_not_dependent_files after insert on public.locker_files
  for each row execute function public.plan_check_not_dependent();
drop trigger if exists plan_check_not_dependent_folders on public.locker_folders;
create trigger plan_check_not_dependent_folders after insert on public.locker_folders
  for each row execute function public.plan_check_not_dependent();

-- Quantos dependentes o plano da empresa permite (a função "company" também confere)
create or replace function public.plan_check_dependents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.plan_limits := public.plan_limits_of(new.company_id);
begin
  if public.company_of(new.company_id) is not null or not coalesce(public.company_active(new.company_id), false) then
    raise exception 'plan_limit:dependents' using errcode = 'P0001', hint = '0';
  end if;
  if l.max_dependents is not null
     and (select count(*) from public.company_members where company_id = new.company_id) > l.max_dependents then
    raise exception 'plan_limit:dependents' using errcode = 'P0001', hint = l.max_dependents::text;
  end if;
  return null;
end;
$$;
drop trigger if exists plan_check_dependents on public.company_members;
create trigger plan_check_dependents after insert on public.company_members
  for each row execute function public.plan_check_dependents();

-- A equipe do dependente tem de ser da empresa dele; e-mail sempre em minúsculas
create or replace function public.company_member_team_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.team_id is not null
     and not exists (select 1 from public.locker_teams t where t.id = new.team_id and t.owner_id = new.company_id) then
    raise exception 'plan_limit:team' using errcode = 'P0001';
  end if;
  new.email := lower(trim(new.email));
  return new;
end;
$$;
drop trigger if exists company_member_team_check on public.company_members;
create trigger company_member_team_check before insert or update on public.company_members
  for each row execute function public.company_member_team_check();

-- As equipes seguem os dependentes: locker_team_members (usado ao compartilhar) é
-- mantido aqui, a partir de company_members.team_id
create or replace function public.company_member_sync_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.team_id is not null then
    delete from public.locker_team_members where team_id = old.team_id and email = old.email;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.team_id is not null then
    insert into public.locker_team_members (team_id, email) values (new.team_id, new.email)
    on conflict do nothing;
  end if;
  return null;
end;
$$;
drop trigger if exists company_member_sync_team on public.company_members;
create trigger company_member_sync_team after insert or update or delete on public.company_members
  for each row execute function public.company_member_sync_team();

-- Só dependentes da empresa entram nas equipes dela
create or replace function public.plan_check_team_is_dependent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid := (select t.owner_id from public.locker_teams t where t.id = new.team_id);
begin
  if not exists (select 1 from public.company_members m where m.company_id = owner and m.email = lower(trim(new.email))) then
    raise exception 'plan_limit:team_member_not_dependent' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists plan_check_team_is_dependent on public.locker_team_members;
create trigger plan_check_team_is_dependent before insert on public.locker_team_members
  for each row execute function public.plan_check_team_is_dependent();

-- Dependente não cria equipes nem compartilha (quem organiza é a empresa)
create or replace function public.plan_check_owner_not_dependent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.company_of(new.owner_id) is not null then
    raise exception 'plan_limit:dependent' using errcode = 'P0001';
  end if;
  return null;
end;
$$;
drop trigger if exists plan_check_owner_not_dependent_teams on public.locker_teams;
create trigger plan_check_owner_not_dependent_teams after insert on public.locker_teams
  for each row execute function public.plan_check_owner_not_dependent();
drop trigger if exists plan_check_owner_not_dependent_shares on public.locker_shares;
create trigger plan_check_owner_not_dependent_shares after insert on public.locker_shares
  for each row execute function public.plan_check_owner_not_dependent();

-- O plano que o app lê, com o papel na empresa (owner ou dependent). Dependente com a
-- empresa sem assinatura: status "blocked" (nada é apagado; volta quando ela renovar)
create or replace function public.my_plan()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  company uuid;
  owner uuid;
  p public.locker_plans;
  l public.plan_limits;
  used bigint;
  n_files integer;
  n_folders integer;
  status text;
  grace timestamptz;
  over boolean;
  company_name text;
  n_dependents integer;
begin
  if uid is null then
    return null;
  end if;
  company := public.company_of(uid);
  owner := coalesce(company, uid);
  select * into p from public.locker_plans where user_id = owner;
  l := public.plan_limits_of(uid);

  select coalesce(sum(f.size_bytes) filter (where f.storage <> 'link'), 0), count(*)
    into used, n_files
    from public.locker_files f where f.user_id = owner;
  select count(*) into n_folders from public.locker_folders where user_id = owner;
  select count(*) into n_dependents from public.company_members where company_id = owner;

  -- free · trial (teste do Plus) · active · expired (vencida: arquivos guardados até grace_until)
  if company is not null and not coalesce(public.company_active(company), false) then
    status := 'blocked';
  elsif p.user_id is null or p.plan = 'free' then
    status := 'free';
  elsif p.expires_at is not null and p.expires_at <= now() then
    grace := p.expires_at + interval '30 days';
    status := case when grace > now() then 'expired' else 'free' end;
  elsif p.period = 'trial' then
    status := 'trial';
  else
    status := 'active';
  end if;

  -- O dependente não guarda nada próprio: o limite é problema da empresa
  over := company is null and (
       (l.limit_bytes is not null and used > l.limit_bytes)
    or (l.max_files is not null and n_files > l.max_files)
    or (l.max_folders is not null and n_folders > l.max_folders));

  if company is not null then
    select coalesce(nullif(pr.agency, ''), nullif(pr.name, ''), '') into company_name from public.profiles pr where pr.id = company;
  end if;

  return jsonb_build_object(
    'plan', l.plan,
    'paid_plan', p.plan,
    'status', status,
    'role', case when company is null then 'owner' else 'dependent' end,
    'company_name', company_name,
    'dependents', n_dependents,
    'store', case when company is null then coalesce(p.store, 'manual') else 'manual' end,
    'expires_at', case when company is null then p.expires_at end,
    'will_renew', company is null and coalesce(p.will_renew, false),
    'grace_until', grace,
    'over_limit', over,
    'over_limit_since', case when company is null then p.over_limit_since end,
    'used_bytes', used,
    'files', n_files,
    'folders', n_folders,
    'limits', to_jsonb(l) - 'updated_at'
  );
end;
$$;
grant execute on function public.my_plan() to authenticated;

-- Tempo real: o app da empresa vê a lista de dependentes mudar
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'company_members'
  ) then
    alter publication supabase_realtime add table public.company_members;
  end if;
end;
$$;

-- =============================================================================
-- 8. Plano na hora: o app acompanha a própria linha de locker_plans (tempo real).
--    Compra, renovação ou vencimento aparecem sem fechar o app (a regra de leitura
--    "plano do locker do proprio usuario" já limita cada um à sua linha).
-- =============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'locker_plans'
  ) then
    alter publication supabase_realtime add table public.locker_plans;
  end if;
end;
$$;
