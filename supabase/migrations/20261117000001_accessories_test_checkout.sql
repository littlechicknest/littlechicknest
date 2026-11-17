-- Accessories category, test-mode checkout (before Stripe is connected), shipping rates,
-- saved customer details, and a flag for sample products so they are easy to remove later.

-- categories ------------------------------------------------------------------
alter table public.products drop constraint products_category_check;
alter table public.products add constraint products_category_check
  check (category in ('Men', 'Women', 'Kids', 'Accessories'));

-- sample products can be wiped in one click from the admin
alter table public.products add column is_sample boolean not null default false;

-- orders placed in test mode never go to Inkthreadable and never take payment
alter table public.orders add column is_test boolean not null default false;
alter table public.orders add column shipping_method text not null default 'standard'
  check (shipping_method in ('standard', 'express'));

-- store settings: checkout mode + shipping rules -------------------------------
alter table public.store_settings add column checkout_mode text not null default 'test'
  check (checkout_mode in ('test', 'live'));
alter table public.store_settings add column free_shipping_over numeric(10,2) not null default 75
  check (free_shipping_over >= 0);
alter table public.store_settings add column express_shipping numeric(10,2) not null default 12.95
  check (express_shipping >= 0);
update public.store_settings set shipping_flat = 4.95 where id = 1 and shipping_flat = 0;

-- profiles: phone + default address the checkout can prefill ------------------
alter table public.profiles add column phone text check (char_length(phone) <= 40);
alter table public.profiles add column default_address jsonb
  check (default_address is null or (jsonb_typeof(default_address) = 'object' and pg_column_size(default_address) < 4000));
grant update (phone, default_address) on public.profiles to authenticated;

-- one place that knows the shipping price (used by the RPC and the Stripe function)
create or replace function public.shipping_cost(p_subtotal numeric, p_method text)
returns numeric language sql stable security definer set search_path = '' as $$
  select case
    when p_method = 'express' then s.express_shipping
    when s.free_shipping_over > 0 and p_subtotal >= s.free_shipping_over then 0
    else s.shipping_flat end
  from public.store_settings s where s.id = 1
$$;
revoke execute on function public.shipping_cost(numeric, text) from public, anon, authenticated;
grant execute on function public.shipping_cost(numeric, text) to service_role;

drop function public.shop_config();
create function public.shop_config()
returns table (shipping_flat numeric, free_shipping_over numeric, express_shipping numeric, checkout_mode text)
language sql stable security definer set search_path = '' as $$
  select shipping_flat, free_shipping_over, express_shipping, checkout_mode from public.store_settings where id = 1
$$;
grant execute on function public.shop_config() to anon, authenticated;

-- test checkout -----------------------------------------------------------------
-- Prices, variants and shipping are all checked here; the browser only sends ids + quantities.
create or replace function public.place_test_order(p_items jsonb, p_address jsonb, p_shipping_method text)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_settings public.store_settings;
  v_lines jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_shipping numeric;
  v_item jsonb;
  v_p public.products;
  v_variant jsonb;
  v_qty int;
  v_color text;
  v_size text;
  v_unit numeric;
  v_addr jsonb;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Please sign in to check out.' using errcode = '42501'; end if;
  select * into v_settings from public.store_settings where id = 1;
  if v_settings.checkout_mode <> 'test' then
    raise exception 'Test orders are switched off.' using errcode = '42501';
  end if;
  if (select count(*) from public.orders where user_id = v_uid and is_test and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Test order limit reached for today.' using errcode = '54000';
  end if;
  if p_shipping_method not in ('standard', 'express') then raise exception 'Invalid delivery option.' using errcode = '22023'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Your basket looks invalid.' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::int;
    v_color := nullif(v_item->>'color', '');
    v_size := nullif(v_item->>'size', '');
    if v_qty is null or v_qty not between 1 and 20 then raise exception 'Invalid quantity.' using errcode = '22023'; end if;
    select * into v_p from public.products where id = (v_item->>'product_id')::uuid and is_active;
    if not found then raise exception 'An item in your basket is no longer available.' using errcode = '22023'; end if;
    v_variant := null;
    if jsonb_array_length(v_p.variants) > 0 then
      select v into v_variant from jsonb_array_elements(v_p.variants) v where v->>'color' = v_color limit 1;
      if v_variant is null then raise exception 'Please choose a colour for %.', v_p.title using errcode = '22023'; end if;
      if jsonb_array_length(coalesce(v_variant->'sizes', '[]')) > 0
         and (v_size is null or not (v_variant->'sizes') ? v_size) then
        raise exception 'Please choose a size for %.', v_p.title using errcode = '22023';
      end if;
      if jsonb_array_length(coalesce(v_variant->'sizes', '[]')) = 0 then v_size := null; end if;
    else
      v_color := null; v_size := null;
    end if;
    v_unit := public.product_price(v_p.source, v_p.base_price, v_p.manual_price, v_settings.global_margin_percent);
    v_subtotal := v_subtotal + v_unit * v_qty;
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_p.id, 'title', v_p.title, 'color', v_color, 'size', v_size, 'quantity', v_qty,
      'unit_price', v_unit, 'image', coalesce(v_variant->'images'->>0, v_p.images[1]));
  end loop;

  -- keep only the address fields we know about, trimmed
  select jsonb_object_agg(k, left(btrim(p_address->>k), 120)) into v_addr
  from unnest(array['name','line1','line2','city','state','postal_code','country','phone']) k
  where p_address ? k;
  if coalesce(v_addr->>'name', '') = '' or coalesce(v_addr->>'line1', '') = '' or coalesce(v_addr->>'city', '') = ''
     or coalesce(v_addr->>'postal_code', '') = '' or coalesce(v_addr->>'country', '') = '' then
    raise exception 'Please complete your shipping address.' using errcode = '22023';
  end if;

  v_shipping := public.shipping_cost(v_subtotal, p_shipping_method);
  select email into v_email from auth.users where id = v_uid;
  insert into public.orders (user_id, email, items, subtotal, shipping_amount, total_amount, currency, shipping_address,
                             status, is_test, shipping_method, fulfillment_status)
  values (v_uid, v_email, v_lines, round(v_subtotal, 2), v_shipping, round(v_subtotal + v_shipping, 2), 'usd', v_addr,
          'paid', true, p_shipping_method, 'test order (not sent to print)')
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.place_test_order(jsonb, jsonb, text) from public, anon;
grant execute on function public.place_test_order(jsonb, jsonb, text) to authenticated;

-- hide the hand-made test products from the storefront (still editable in admin)
update public.products set is_active = false
where id in ('7ed856ec-0844-4e5b-914d-8196288a8e8b', '9b75b79e-e5e0-4186-a835-3f554b4f4550', '1bcaf2d5-36e4-4b1b-a869-6b823f9b6000');
