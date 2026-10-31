-- =============================================================================
-- KEYCON Locker — organização dos arquivos na nuvem
-- -----------------------------------------------------------------------------
-- Como usar: Supabase → SQL Editor → New query → colar este arquivo → Run.
-- Pode rodar de novo sem perder nada (cria só o que falta).
--
-- Os ARQUIVOS ficam no Cloudflare R2 (ver supabase/functions/locker). Aqui ficam
-- só os dados da organização: pastas, nomes, tamanhos, onde cada arquivo está,
-- o que aparece no teclado, estrela e lixeira. App, teclado e Locker web leem
-- estas tabelas e recebem as mudanças em tempo real (Realtime).
--
-- Os ids são texto e nascem no aparelho: o app cria a pasta ou o arquivo na hora
-- (também sem internet) e manda para a nuvem quando der.
-- =============================================================================

-- Pastas (e subpastas: parent_id)
create table if not exists public.locker_folders (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id   text references public.locker_folders (id) on delete cascade,
  name        text not null default '',
  -- Ordem escolhida pela pessoa (no teclado e no Locker)
  position    integer not null default 0,
  -- Aparece no teclado (a pessoa escolhe o que vai para o teclado)
  in_keyboard boolean not null default true,
  starred     boolean not null default false,
  -- Na lixeira desde quando (null = não está na lixeira)
  trashed_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Arquivos
create table if not exists public.locker_files (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Pasta onde está (null = na raiz). Pasta apagada: o arquivo vai junto
  folder_id   text references public.locker_folders (id) on delete cascade,
  name        text not null default '',
  -- image, video, audio, pdf, document...
  kind        text not null default 'image',
  mime        text not null default '',
  size_bytes  bigint not null default 0,
  -- Onde está o arquivo: r2 (Cloudflare), supabase (bucket "media", versão antiga) ou link (externo)
  storage     text not null default 'r2' check (storage in ('r2', 'supabase', 'link')),
  -- Caminho no R2 ou no bucket "media" (<id do usuário>/<nome>); vazio para link externo
  object_key  text not null default '',
  -- Só para storage = supabase ou link: o endereço público. No R2 o app pede um link temporário
  url         text not null default '',
  duration    text,
  position    integer not null default 0,
  in_keyboard boolean not null default true,
  starred     boolean not null default false,
  trashed_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Links públicos (sem login), pela Edge Function "locker-public":
--  - todo arquivo tem um link próprio: locker.keyconapp.com/f/<share_token>
--    (quem tiver o link abre o arquivo, também de dentro de uma pasta privada);
--  - cada pasta escolhe quem a vê: private (só o dono), link (quem tem o link
--    locker.keyconapp.com/d/<share_token>) ou public (como link, e também na
--    vitrine pública do vendedor no Locker web).
-- O share_token é aleatório (32 caracteres): não dá para adivinhar outros links.
-- -----------------------------------------------------------------------------
alter table public.locker_folders add column if not exists visibility text not null default 'private';
alter table public.locker_folders add column if not exists share_token text not null default replace(gen_random_uuid()::text, '-', '');
alter table public.locker_files add column if not exists share_token text not null default replace(gen_random_uuid()::text, '-', '');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'locker_folders_visibility_check') then
    alter table public.locker_folders
      add constraint locker_folders_visibility_check check (visibility in ('private', 'link', 'public'));
  end if;
end;
$$;

create unique index if not exists locker_folders_share_idx on public.locker_folders (share_token);
create unique index if not exists locker_files_share_idx on public.locker_files (share_token);

create index if not exists locker_folders_user_idx on public.locker_folders (user_id);
create index if not exists locker_files_user_idx on public.locker_files (user_id);
create index if not exists locker_files_folder_idx on public.locker_files (folder_id);

-- Plano de armazenamento de cada pessoa: basic 5 GB, plus 20 GB, pro 100 GB ou
-- enterprise (espaço combinado com o suporte, gravado em limit_bytes).
-- A pessoa só LÊ o próprio plano: quem muda é o servidor (cobrança da assinatura,
-- com a chave service_role). Sem linha aqui = 5 GB.
create table if not exists public.locker_plans (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  plan        text not null default 'basic',
  limit_bytes bigint not null default 5368709120,
  updated_at  timestamptz not null default now()
);

-- Planos aceitos (o enterprise entrou depois: troca a regra antiga, se existir)
alter table public.locker_plans drop constraint if exists locker_plans_plan_check;
alter table public.locker_plans
  add constraint locker_plans_plan_check check (plan in ('basic', 'plus', 'pro', 'enterprise'));

-- -----------------------------------------------------------------------------
-- Segurança: cada pessoa só vê e mexe nas próprias pastas e arquivos
-- -----------------------------------------------------------------------------
alter table public.locker_folders enable row level security;
alter table public.locker_files   enable row level security;
alter table public.locker_plans   enable row level security;

drop policy if exists "pastas do locker do proprio usuario" on public.locker_folders;
create policy "pastas do locker do proprio usuario" on public.locker_folders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "arquivos do locker do proprio usuario" on public.locker_files;
create policy "arquivos do locker do proprio usuario" on public.locker_files
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "plano do locker do proprio usuario (so leitura)" on public.locker_plans;
create policy "plano do locker do proprio usuario (so leitura)" on public.locker_plans
  for select using (user_id = auth.uid());

-- updated_at sozinho a cada alteração (o app usa para saber o que é mais novo)
create or replace function public.locker_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists locker_folders_touch on public.locker_folders;
create trigger locker_folders_touch before update on public.locker_folders
  for each row execute function public.locker_touch();

drop trigger if exists locker_files_touch on public.locker_files;
create trigger locker_files_touch before update on public.locker_files
  for each row execute function public.locker_touch();

-- -----------------------------------------------------------------------------
-- Espaço usado e limite do plano (a lixeira também conta, até ser esvaziada)
-- -----------------------------------------------------------------------------
create or replace function public.locker_usage()
returns table (used_bytes bigint, limit_bytes bigint, plan text)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce((select sum(f.size_bytes) from public.locker_files f where f.user_id = auth.uid() and f.storage <> 'link'), 0)::bigint,
    coalesce((select p.limit_bytes from public.locker_plans p where p.user_id = auth.uid()), 5368709120)::bigint,
    coalesce((select p.plan from public.locker_plans p where p.user_id = auth.uid()), 'basic');
$$;

-- -----------------------------------------------------------------------------
-- Tempo real: app, teclado e Locker web recebem as mudanças na hora
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'locker_folders'
  ) then
    alter publication supabase_realtime add table public.locker_folders;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'locker_files'
  ) then
    alter publication supabase_realtime add table public.locker_files;
  end if;
end;
$$;

-- =============================================================================
-- Compartilhar com pessoas e equipes (Locker web, "Compartilhar")
-- -----------------------------------------------------------------------------
-- A pessoa é identificada pelo e-mail da conta KEYCON: compartilhar com um e-mail
-- que ainda não tem conta vale assim que alguém entrar com esse e-mail.
-- Acesso de LEITOR: ver, abrir e baixar (a pasta e tudo o que tem dentro).
-- O app e o teclado continuam mostrando só o Locker da própria pessoa.
-- =============================================================================

-- Equipes: um grupo de e-mails que a pessoa monta uma vez e usa ao compartilhar
create table if not exists public.locker_teams (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.locker_team_members (
  team_id     uuid not null references public.locker_teams (id) on delete cascade,
  email       text not null,
  added_at    timestamptz not null default now(),
  primary key (team_id, email)
);

-- Quem tem acesso a quê: uma pasta (e o que tem dentro) ou um arquivo, para um
-- e-mail ou uma equipe
create table if not exists public.locker_shares (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- E-mail de quem compartilhou (para mostrar "Compartilhado por" a quem recebe)
  owner_email   text not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  folder_id     text references public.locker_folders (id) on delete cascade,
  file_id       text references public.locker_files (id) on delete cascade,
  grantee_email text,
  team_id       uuid references public.locker_teams (id) on delete cascade,
  role          text not null default 'viewer',
  created_at    timestamptz not null default now(),
  constraint locker_shares_target check ((folder_id is null) <> (file_id is null)),
  constraint locker_shares_grantee check ((grantee_email is null) <> (team_id is null)),
  constraint locker_shares_role check (role in ('viewer'))
);

create unique index if not exists locker_shares_unique_idx on public.locker_shares (
  coalesce(folder_id, ''), coalesce(file_id, ''), coalesce(grantee_email, ''), coalesce(team_id::text, '')
);
create index if not exists locker_shares_email_idx on public.locker_shares (grantee_email);
create index if not exists locker_shares_team_idx on public.locker_shares (team_id);
create index if not exists locker_team_members_email_idx on public.locker_team_members (email);
create index if not exists locker_folders_parent_idx on public.locker_folders (parent_id);

-- E-mails sempre em minúsculas
create or replace function public.locker_lower_email()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'locker_shares' then
    new.grantee_email = lower(trim(new.grantee_email));
  else
    new.email = lower(trim(new.email));
  end if;
  return new;
end;
$$;

drop trigger if exists locker_shares_email on public.locker_shares;
create trigger locker_shares_email before insert or update on public.locker_shares
  for each row execute function public.locker_lower_email();
drop trigger if exists locker_team_members_email on public.locker_team_members;
create trigger locker_team_members_email before insert or update on public.locker_team_members
  for each row execute function public.locker_lower_email();

-- -----------------------------------------------------------------------------
-- Funções de apoio das regras (security definer: leem sem cair nas próprias regras)
-- -----------------------------------------------------------------------------
create or replace function public.locker_my_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- Equipes de que a pessoa é dona ou membro
create or replace function public.locker_my_team_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id from public.locker_teams t where t.owner_id = auth.uid()
  union
  select m.team_id from public.locker_team_members m where m.email = public.locker_my_email() and m.email <> '';
$$;

-- Compartilhamentos que valem para a pessoa (direto ou por equipe)
create or replace function public.locker_my_share_rows()
returns setof public.locker_shares
language sql
stable
security definer
set search_path = public
as $$
  select s.* from public.locker_shares s
  where s.owner_id <> auth.uid()
    and ((s.grantee_email = public.locker_my_email() and s.grantee_email <> '')
      or s.team_id in (select public.locker_my_team_ids()));
$$;

-- Pastas que a pessoa pode ver por compartilhamento: as compartilhadas e tudo dentro delas
create or replace function public.locker_shared_folder_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  with recursive tree as (
    select f.id from public.locker_folders f
    where f.id in (select s.folder_id from public.locker_my_share_rows() s where s.folder_id is not null)
      and f.trashed_at is null
    union
    select c.id from public.locker_folders c join tree t on c.parent_id = t.id
    where c.trashed_at is null
  )
  select id from tree;
$$;

create or replace function public.locker_shared_file_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select s.file_id from public.locker_my_share_rows() s where s.file_id is not null;
$$;

-- -----------------------------------------------------------------------------
-- Regras
-- -----------------------------------------------------------------------------
alter table public.locker_teams        enable row level security;
alter table public.locker_team_members enable row level security;
alter table public.locker_shares       enable row level security;

drop policy if exists "equipes: dono mexe" on public.locker_teams;
create policy "equipes: dono mexe" on public.locker_teams
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "equipes: membros veem" on public.locker_teams;
create policy "equipes: membros veem" on public.locker_teams
  for select using (id in (select public.locker_my_team_ids()));

drop policy if exists "membros: dono da equipe mexe" on public.locker_team_members;
create policy "membros: dono da equipe mexe" on public.locker_team_members
  for all using (team_id in (select t.id from public.locker_teams t where t.owner_id = auth.uid()))
  with check (team_id in (select t.id from public.locker_teams t where t.owner_id = auth.uid()));
drop policy if exists "membros: quem é da equipe vê" on public.locker_team_members;
create policy "membros: quem é da equipe vê" on public.locker_team_members
  for select using (team_id in (select public.locker_my_team_ids()));

-- Só compartilha o que é seu, com uma equipe de que faz parte
drop policy if exists "compartilhamentos: dono mexe" on public.locker_shares;
create policy "compartilhamentos: dono mexe" on public.locker_shares
  for all using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (folder_id is null or exists (select 1 from public.locker_folders f where f.id = folder_id and f.user_id = auth.uid()))
    and (file_id is null or exists (select 1 from public.locker_files f where f.id = file_id and f.user_id = auth.uid()))
    and (team_id is null or team_id in (select public.locker_my_team_ids()))
    and (grantee_email is null or lower(grantee_email) <> public.locker_my_email())
  );
drop policy if exists "compartilhamentos: quem recebe vê" on public.locker_shares;
create policy "compartilhamentos: quem recebe vê" on public.locker_shares
  for select using (id in (select s.id from public.locker_my_share_rows() s));

-- Leitura do que foi compartilhado (soma às regras do próprio dono)
drop policy if exists "pastas compartilhadas comigo (leitura)" on public.locker_folders;
create policy "pastas compartilhadas comigo (leitura)" on public.locker_folders
  for select using (id in (select public.locker_shared_folder_ids()));

drop policy if exists "arquivos compartilhados comigo (leitura)" on public.locker_files;
create policy "arquivos compartilhados comigo (leitura)" on public.locker_files
  for select using (
    trashed_at is null
    and (folder_id in (select public.locker_shared_folder_ids()) or id in (select public.locker_shared_file_ids()))
  );
