create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- random shared secrets generated inside the database; they never pass through code or chat
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_secret', 'Bearer token pg_cron uses to call sync-order-status')
where not exists (select 1 from vault.secrets where name = 'cron_secret');
select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'inkthreadable_webhook_token', 'Token in the Inkthreadable webhook URL')
where not exists (select 1 from vault.secrets where name = 'inkthreadable_webhook_token');

-- Edge Functions (service role only) read the tokens to verify callers
create or replace function public.internal_secret(p_name text) returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = p_name and p_name in ('cron_secret', 'inkthreadable_webhook_token')
$$;
revoke execute on function public.internal_secret(text) from public, anon, authenticated;
grant execute on function public.internal_secret(text) to service_role;

-- admins need the webhook token to paste the URL into Inkthreadable
create or replace function public.admin_webhook_token() returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select decrypted_secret from vault.decrypted_secrets where name = 'inkthreadable_webhook_token');
end $$;
revoke execute on function public.admin_webhook_token() from public, anon;
grant execute on function public.admin_webhook_token() to authenticated;

-- hourly order status sync (project URL is specific to this Supabase project)
select cron.schedule('sync-order-status-hourly', '7 * * * *', $$
  select net.http_post(
    url := 'https://groyltayfbxzsalzvsai.supabase.co/functions/v1/sync-order-status',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
$$);
