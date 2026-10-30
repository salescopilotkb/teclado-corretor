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

-- Plano de armazenamento de cada pessoa (5, 20 ou 100 GB).
-- A pessoa só LÊ o próprio plano: quem muda é o servidor (cobrança da assinatura,
-- com a chave service_role). Sem linha aqui = 5 GB.
create table if not exists public.locker_plans (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  plan        text not null default 'basic' check (plan in ('basic', 'plus', 'pro')),
  limit_bytes bigint not null default 5368709120,
  updated_at  timestamptz not null default now()
);

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
