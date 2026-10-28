-- =============================================================================
-- KEYCON — esquema do banco no Supabase
-- -----------------------------------------------------------------------------
-- Como usar: Supabase → SQL Editor → New query → colar este arquivo → Run.
-- Cada usuário só enxerga e altera os PRÓPRIOS dados (Row Level Security).
-- Fotos e áudios ficam no Storage, no bucket "media", em pastas por usuário:
--   media/<id do usuário>/<arquivo>
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Perfil de quem vende (nome, negócio, telefone, ramo)
-- Criado automaticamente no cadastro (e-mail/senha ou Google).
-- A coluna agency guarda o NOME DO NEGÓCIO (nome mantido da primeira versão).
-- A coluna segment guarda o RAMO escolhido no cadastro (ids em src/segments).
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  agency      text not null default '',
  phone       text not null default '',
  segment     text not null default 'general',
  -- Idioma do app (pt, en, es) e onde vende (moeda): ver src/i18n
  language    text not null default 'pt',
  market      text not null default 'BR',
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, agency, phone, segment, language, market)
  values (
    new.id,
    -- Cadastro pelo app envia name/agency/phone/segment; o Google envia full_name
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'agency', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'segment', ''), 'general'),
    coalesce(nullif(new.raw_user_meta_data ->> 'language', ''), 'pt'),
    coalesce(nullif(new.raw_user_meta_data ->> 'market', ''), 'BR')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Catálogo: pastas → produtos → fotos/vídeos
-- -----------------------------------------------------------------------------
create table if not exists public.folders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null,
  description   text,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.products (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id          uuid not null references public.folders (id) on delete cascade,
  title              text not null,
  -- 0 = "Sob consulta" (ramos com preço opcional)
  price              numeric(14, 2) not null check (price >= 0),
  short_description  text not null default '',
  datasheet_url      text not null default '',
  -- Características do ramo: [{"key": "bedrooms", "label": "Quartos", "value": "3"}, ...]
  attributes         jsonb not null default '[]'::jsonb,
  position           integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.media (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id    uuid not null references public.products (id) on delete cascade,
  type          text not null check (type in ('image', 'video')),
  title         text not null default '',
  url           text not null,
  -- Caminho no Storage quando o arquivo foi enviado pelo app (vazio = link externo)
  storage_path  text,
  duration      text,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Atalhos de texto e de áudio
-- -----------------------------------------------------------------------------
create table if not exists public.text_shortcuts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null,
  body        text not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.audio_shortcuts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null,
  audio_url     text not null,
  storage_path  text,
  duration      text not null default '',
  transcript    text not null default '',
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists folders_user_idx         on public.folders (user_id);
create index if not exists products_folder_idx      on public.products (folder_id);
create index if not exists media_product_idx        on public.media (product_id);
create index if not exists text_shortcuts_user_idx  on public.text_shortcuts (user_id);
create index if not exists audio_shortcuts_user_idx on public.audio_shortcuts (user_id);

-- -----------------------------------------------------------------------------
-- Row Level Security: cada usuário só acessa as próprias linhas
-- -----------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.folders         enable row level security;
alter table public.products        enable row level security;
alter table public.media           enable row level security;
alter table public.text_shortcuts  enable row level security;
alter table public.audio_shortcuts enable row level security;

drop policy if exists "perfil do proprio usuario" on public.profiles;
create policy "perfil do proprio usuario" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "pastas do proprio usuario" on public.folders;
create policy "pastas do proprio usuario" on public.folders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "imoveis do proprio usuario" on public.products;
drop policy if exists "produtos do proprio usuario" on public.products;
-- Além do dono, confere que a pasta / o produto de destino também são do usuário
create policy "produtos do proprio usuario" on public.products
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.folders f where f.id = folder_id and f.user_id = auth.uid())
  );

drop policy if exists "midias do proprio usuario" on public.media;
create policy "midias do proprio usuario" on public.media
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.products p where p.id = product_id and p.user_id = auth.uid())
  );

drop policy if exists "atalhos de texto do proprio usuario" on public.text_shortcuts;
create policy "atalhos de texto do proprio usuario" on public.text_shortcuts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "atalhos de audio do proprio usuario" on public.audio_shortcuts;
create policy "atalhos de audio do proprio usuario" on public.audio_shortcuts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Storage: bucket "media" para fotos, vídeos e áudios
-- Leitura pública: o link direto do arquivo é o que o teclado envia ao cliente
-- e o que permite mandar a foto "direto na conversa". Os nomes dos arquivos
-- são aleatórios (não dá para adivinhar), mas quem tiver o link consegue abrir.
-- Envio, troca e exclusão: só dentro da pasta do próprio usuário.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800) -- 50 MB por arquivo
on conflict (id) do nothing;

drop policy if exists "enviar arquivos na propria pasta" on storage.objects;
create policy "enviar arquivos na propria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "alterar arquivos da propria pasta" on storage.objects;
create policy "alterar arquivos da propria pasta" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "excluir arquivos da propria pasta" on storage.objects;
create policy "excluir arquivos da propria pasta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- Atualização de um banco criado por versões anteriores.
-- Pode rodar várias vezes: cada passo só age se ainda for necessário.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'folders' and column_name = 'neighborhood') then
    alter table public.folders rename column neighborhood to description;
  end if;
end $$;

alter table public.products drop column if exists deal_type;
alter table public.products drop column if exists bedrooms;
alter table public.products drop column if exists area_m2;
alter table public.profiles drop column if exists creci;

-- Ramos de negócio (cadastro) e características dos produtos
alter table public.profiles add column if not exists segment text not null default 'general';
alter table public.products add column if not exists attributes jsonb not null default '[]'::jsonb;
alter table public.products drop constraint if exists products_price_check;
alter table public.products add constraint products_price_check check (price >= 0);

-- Idiomas e moeda
alter table public.profiles add column if not exists language text not null default 'pt';
alter table public.profiles add column if not exists market text not null default 'BR';

-- -----------------------------------------------------------------------------
-- Lista de espera da landing page (landing/): "Avise-me no lançamento".
-- Qualquer visitante pode SE INSCREVER (insert com a chave anon), mas ninguém
-- lê a lista pelo site: só você, no painel do Supabase (Table Editor → waitlist).
-- -----------------------------------------------------------------------------
create table if not exists public.waitlist (
  id          bigint generated always as identity primary key,
  email       text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Celular de quem se inscreveu: em qual loja avisar
  platform    text not null check (platform in ('android', 'iphone')),
  -- Idioma da página na inscrição (en, pt, es): em que idioma escrever o aviso
  language    text not null default 'en' check (language in ('en', 'pt', 'es')),
  created_at  timestamptz not null default now()
);

-- Um e-mail entra uma vez só (maiúsculas e minúsculas contam como o mesmo)
create unique index if not exists waitlist_email_unique on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

revoke all on public.waitlist from anon, authenticated;
grant insert (email, platform, language) on public.waitlist to anon, authenticated;

drop policy if exists "inscricao na lista de espera" on public.waitlist;
create policy "inscricao na lista de espera" on public.waitlist
  for insert to anon, authenticated
  with check (true);
