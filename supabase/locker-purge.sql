-- =============================================================================
-- KEYCON Locker — esvaziar a lixeira depois de 30 dias (todo dia, às 4h17 UTC)
-- -----------------------------------------------------------------------------
-- Antes: publique a função (docs/LOCKER-SETUP.md, passo 8):
--   supabase secrets set CRON_SECRET=<uma senha longa qualquer>
--   supabase functions deploy locker-purge --no-verify-jwt
--
-- Depois: troque <CRON_SECRET> abaixo pela MESMA senha → SQL Editor → Run.
-- Pode rodar de novo (troca o agendamento antigo).
-- =============================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'locker-purge-daily';

select cron.schedule(
  'locker-purge-daily',
  '17 4 * * *',
  $job$
    select net.http_post(
      url := 'https://ldobmaflbrqruqfalkvi.supabase.co/functions/v1/locker-purge',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
      body := '{}'::jsonb
    );
  $job$
);
