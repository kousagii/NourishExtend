-- Run after enabling pg_cron and pg_net in Supabase Extensions and deploying maintenance.
-- Store these in Vault first (Dashboard -> Vault):
-- nourish_project_url = your HTTPS Supabase URL
-- nourish_maintenance_secret = same random value configured as MAINTENANCE_SECRET
-- Do not replace the names below with literal secrets in a tracked file.
select cron.schedule('nourish-retention-daily','15 19 * * *',$$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='nourish_project_url' limit 1) || '/functions/v1/maintenance',
    headers := jsonb_build_object('Content-Type','application/json','x-maintenance-secret',(select decrypted_secret from vault.decrypted_secrets where name='nourish_maintenance_secret' limit 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);
-- 19:15 UTC is 03:15 Philippines time the following day.
-- Verify the function response in net._http_response and cron.job_run_details.
