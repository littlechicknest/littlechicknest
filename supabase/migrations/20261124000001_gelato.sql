-- Gelato replaces Inkthreadable as the print partner. Products are mirrored from the Gelato store by sync-products.

-- products --------------------------------------------------------------------
alter table public.products drop constraint products_source_check, drop constraint price_matches_source, drop constraint products_category_check;
alter table public.products
  add constraint products_source_check check (source in ('gelato', 'manual')),
  add constraint price_matches_source check (
    (source = 'manual' and manual_price is not null) or
    (source = 'gelato' and base_price is not null and external_product_id is not null)),
  -- Unisex products are listed under both Men and Women
  add constraint products_category_check check (category in ('Men', 'Women', 'Unisex', 'Kids', 'Accessories')),
  -- one entry per colour/size: { color, size, variant_id, uid, cost } (cost in USD, never exposed publicly)
  add column skus jsonb not null default '[]' check (jsonb_typeof(skus) = 'array'),
  -- size tables from the product: [table][row][cell]
  add column size_guide jsonb not null default '[]' check (jsonb_typeof(size_guide) = 'array'),
  -- Gelato image id -> our stored copy
  add column gelato_images jsonb not null default '{}' check (jsonb_typeof(gelato_images) = 'object');

alter table public.store_settings add column last_product_sync timestamptz;
alter table public.orders rename column inkthreadable_order_id to gelato_order_id;

-- price of one colour/size; null when Gelato doesn't offer it
create function public.sku_price(p public.products, p_color text, p_size text, p_margin int)
returns numeric language sql immutable set search_path = '' as $$
  select case when p.source = 'manual' then p.manual_price else (
    select round((s->>'cost')::numeric * (1 + p_margin / 100.0), 2) from jsonb_array_elements(p.skus) s
    where s->>'color' is not distinct from p_color and s->>'size' is not distinct from p_size limit 1) end
$$;
revoke execute on function public.sku_price(public.products, text, text, int) from public, anon, authenticated;

-- storefront: adds the price of every colour/size ("Navy|XL") and the size guide
drop function public.shop_products();
create function public.shop_products()
returns table (
  id uuid, title text, description text, category text, price numeric, prices jsonb,
  variants jsonb, images text[], size_guide jsonb, is_featured boolean, created_at timestamptz,
  rating_avg numeric, rating_count int)
language sql stable security definer set search_path = '' as $$
  select p.id, p.title, p.description, p.category,
         public.product_price(p.source, p.base_price, p.manual_price, s.global_margin_percent),
         coalesce((select jsonb_object_agg(concat(k->>'color', '|', k->>'size'), round((k->>'cost')::numeric * (1 + s.global_margin_percent / 100.0), 2))
                   from jsonb_array_elements(p.skus) k), '{}'),
         p.variants, p.images, p.size_guide, p.is_featured, p.created_at,
         round(r.avg, 1), coalesce(r.cnt, 0)::int
  from public.products p
  cross join public.store_settings s
  left join lateral (
    select avg(rating) as avg, count(*) as cnt from public.reviews
    where product_id = p.id and is_approved) r on true
  where p.is_active and s.id = 1
$$;
grant execute on function public.shop_products() to anon, authenticated;

-- test checkout: same as before, but priced per colour/size
do $$
declare v_def text := pg_get_functiondef('public.place_test_order(jsonb,jsonb,text)'::regprocedure);
  v_new text;
begin
  v_new := replace(v_def,
    'v_unit := public.product_price(v_p.source, v_p.base_price, v_p.manual_price, v_settings.global_margin_percent);',
    'v_unit := public.sku_price(v_p, v_color, v_size, v_settings.global_margin_percent);
    if coalesce(v_unit, 0) <= 0 then raise exception ''% is no longer available in that option.'', v_p.title using errcode = ''22023''; end if;');
  v_new := replace(v_new,
    'coalesce(v_variant->''images''->>0, v_p.images[1])',
    'coalesce(v_variant->''images''->>0, v_p.images[1], v_p.variants->0->''images''->>0)');
  if v_new = v_def or position('sku_price' in v_new) = 0 or position('variants->0->' in v_new) = 0 then
    raise exception 'place_test_order was not patched';
  end if;
  execute v_new;
end $$;

-- secrets: Gelato key + token and the auto-registered Stripe webhook secret live in Vault ---------------
select vault.update_secret(id, new_name := 'gelato_webhook_token', new_description := 'Token in the Gelato webhook URL')
from vault.secrets where name = 'inkthreadable_webhook_token';

create or replace function public.internal_secret(p_name text) returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = p_name and p_name in ('cron_secret', 'gelato_api_key', 'gelato_webhook_token', 'stripe_webhook_live', 'stripe_webhook_test')
$$;

create function public.store_internal_secret(p_name text, p_value text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_name not in ('stripe_webhook_live', 'stripe_webhook_test') then raise exception 'not allowed' using errcode = '42501'; end if;
  perform vault.create_secret(p_value, p_name);
end $$;
revoke execute on function public.store_internal_secret(text, text) from public, anon, authenticated;
grant execute on function public.store_internal_secret(text, text) to service_role;

create or replace function public.admin_webhook_token() returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select decrypted_secret from vault.decrypted_secrets where name = 'gelato_webhook_token');
end $$;

-- every 15 minutes: orders, then products ------------------------------------------
select cron.unschedule('sync-order-status-hourly');
select cron.schedule(job, schedule, format($job$
  select net.http_post(
    url := 'https://groyltayfbxzsalzvsai.supabase.co/functions/v1/%s',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
$job$, job))
from (values ('sync-order-status', '2-59/15 * * * *'), ('sync-products', '7-59/15 * * * *')) j(job, schedule);

