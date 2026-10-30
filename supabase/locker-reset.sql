-- =============================================================================
-- KEYCON Locker — limpar os dados de teste
-- -----------------------------------------------------------------------------
-- Apaga TODAS as pastas e arquivos do Locker de TODAS as contas (fase de testes).
-- Os planos de espaço (locker_plans) ficam. Não mexe em perfis, produtos,
-- atalhos, clientes nem agenda.
--
-- Como usar: Supabase → SQL Editor → New query → colar → Run.
-- Pode rodar antes ou depois do supabase/locker.sql (sem as tabelas, não faz nada).
--
-- Os arquivos em si ficam em outro lugar (ver o fim deste arquivo).
-- Cada aparelho também apaga a própria cópia na primeira abertura da versão nova.
-- =============================================================================

do $$
begin
  if to_regclass('public.locker_files') is not null then
    delete from public.locker_files;
  end if;
  if to_regclass('public.locker_folders') is not null then
    delete from public.locker_folders;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Os arquivos em si (não dá para apagar pelo SQL):
--
-- 1) Bucket "media" do Supabase (Arquivos de antes do Locker):
--    Storage → media → abra cada pasta (uma por usuário) → selecione tudo → Delete.
--    Atenção: o bucket também guarda as fotos dos produtos e os áudios dos
--    atalhos das mesmas contas. Na fase de testes pode apagar tudo.
--
-- 2) Bucket "keycon-locker" do Cloudflare R2 (se já foi criado e usado):
--    Cloudflare → R2 → keycon-locker → selecione os arquivos → Delete.
-- -----------------------------------------------------------------------------
