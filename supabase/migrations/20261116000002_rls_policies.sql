-- Little Chick Nest Shop: access control (RLS, column grants, public RPCs)

-- admin check (security definer so policies can call it without recursing into profiles RLS)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
$$;

alter table public.profiles enable row level security;
alter table public.store_settings enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_notes enable row level security;
alter table public.reviews enable row level security;
alter table public.contact_messages enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- profiles: users read their own row and may only change their name (never their role)
create policy "profiles: read own or admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

-- store settings: admin only (storefront gets what it needs via shop_config())
create policy "settings: admin read" on public.store_settings for select to authenticated
  using ((select public.is_admin()));
create policy "settings: admin update" on public.store_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke insert, delete on public.store_settings from anon, authenticated;

-- products: admin only; storefront reads through shop_products() which hides cost + print files
create policy "products: admin all" on public.products for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- orders: customers read their own; only admins update; inserts come from Edge Functions (service role)
create policy "orders: read own or admin" on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "orders: admin update" on public.orders for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke insert, update, delete on public.orders from anon, authenticated;
grant update (status, tracking_number) on public.orders to authenticated;

-- order notes: admin only
create policy "order_notes: admin all" on public.order_notes for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()) and author_id = (select auth.uid()));

-- reviews: buyers of the product may review it once; admins moderate
create policy "reviews: read own or admin" on public.reviews for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "reviews: buyers insert" on public.reviews for insert to authenticated
  with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.orders o
      where o.user_id = (select auth.uid())
        and o.status in ('paid','processing','printing','shipped','delivered')
        and o.items @> jsonb_build_array(jsonb_build_object('product_id', product_id::text))));
create policy "reviews: admin update" on public.reviews for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "reviews: delete own or admin" on public.reviews for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
revoke insert, update on public.reviews from anon, authenticated;
grant insert (product_id, rating, body) on public.reviews to authenticated;
grant update (is_approved) on public.reviews to authenticated;

-- contact messages + newsletter: anyone may submit, only admins read
-- shortcut: no rate limiting on public inserts; add a captcha / edge function if spam appears
create policy "contact: anyone insert" on public.contact_messages for insert to anon, authenticated
  with check (is_read = false);
create policy "contact: admin read" on public.contact_messages for select to authenticated
  using ((select public.is_admin()));
create policy "contact: admin update" on public.contact_messages for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "contact: admin delete" on public.contact_messages for delete to authenticated
  using ((select public.is_admin()));

create policy "newsletter: anyone insert" on public.newsletter_subscribers for insert to anon, authenticated
  with check (true);
create policy "newsletter: admin read" on public.newsletter_subscribers for select to authenticated
  using ((select public.is_admin()));
create policy "newsletter: admin delete" on public.newsletter_subscribers for delete to authenticated
  using ((select public.is_admin()));

-- public storefront RPCs -------------------------------------------------------
create or replace function public.shop_products()
returns table (
  id uuid, title text, description text, category text, price numeric,
  variants jsonb, images text[], is_featured boolean, created_at timestamptz,
  rating_avg numeric, rating_count int)
language sql stable security definer set search_path = '' as $$
  select p.id, p.title, p.description, p.category,
         public.product_price(p.source, p.base_price, p.manual_price, s.global_margin_percent),
         p.variants, p.images, p.is_featured, p.created_at,
         round(r.avg, 1), coalesce(r.cnt, 0)::int
  from public.products p
  cross join public.store_settings s
  left join lateral (
    select avg(rating) as avg, count(*) as cnt from public.reviews
    where product_id = p.id and is_approved) r on true
  where p.is_active and s.id = 1
$$;

create or replace function public.shop_config()
returns table (shipping_flat numeric)
language sql stable security definer set search_path = '' as $$
  select shipping_flat from public.store_settings where id = 1
$$;

create or replace function public.product_reviews(p_product_id uuid)
returns table (id uuid, author_name text, rating int, body text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select id, author_name, rating, body, created_at from public.reviews
  where product_id = p_product_id and is_approved
  order by created_at desc limit 50
$$;

-- admin: daily paid revenue for the dashboard chart
create or replace function public.admin_daily_sales(p_days int default 30)
returns table (day date, revenue numeric, orders int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select d::date, coalesce(sum(o.total_amount), 0), count(o.id)::int
    from generate_series(current_date - (least(greatest(p_days, 1), 365) - 1), current_date, interval '1 day') d
    left join public.orders o
      on o.created_at::date = d::date
     and o.status in ('paid','processing','printing','shipped','delivered')
    group by d order by d;
end $$;

-- function execute rights: lock everything down, then open what the client needs
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.review_defaults() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.admin_daily_sales(int) from public, anon;
grant execute on function public.admin_daily_sales(int) to authenticated;
grant execute on function public.shop_products() to anon, authenticated;
grant execute on function public.shop_config() to anon, authenticated;
grant execute on function public.product_reviews(uuid) to anon, authenticated;

-- storage: public product images, admin-only writes (no list policy, so the bucket can't be enumerated)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "product-images: admin read" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
create policy "product-images: admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "product-images: admin update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
create policy "product-images: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
