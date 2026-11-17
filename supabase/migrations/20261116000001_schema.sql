-- Little Chick Nest Shop: core schema

-- updated_at helper
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- profiles ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text check (char_length(full_name) <= 120),
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email,
          left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 120));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- store settings (singleton) --------------------------------------------------
create table public.store_settings (
  id int primary key default 1 check (id = 1),
  global_margin_percent int not null default 50 check (global_margin_percent between 1 and 100),
  shipping_flat numeric(10,2) not null default 0 check (shipping_flat >= 0),
  last_api_sync timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.store_settings default values;
create trigger store_settings_updated before update on public.store_settings
  for each row execute function public.set_updated_at();

-- products --------------------------------------------------------------------
-- variants: [{ "color": "Red", "hex": "#cc0000", "pn": "optional per-colour code", "sizes": ["S","M"], "images": ["url"] }]
-- print_files: { "front": "url", "back": "url" }  (sent to Inkthreadable, never exposed publicly)
create table public.products (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('inkthreadable','manual')),
  external_product_id text unique,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  category text not null check (category in ('Men','Women','Kids')),
  base_price numeric(10,2) check (base_price >= 0),
  manual_price numeric(10,2) check (manual_price >= 0),
  variants jsonb not null default '[]' check (jsonb_typeof(variants) = 'array'),
  images text[] not null default '{}',
  print_files jsonb not null default '{}' check (jsonb_typeof(print_files) = 'object'),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_matches_source check (
    (source = 'manual' and manual_price is not null) or
    (source = 'inkthreadable' and base_price is not null and external_product_id is not null))
);
create index products_active_category_idx on public.products (category) where is_active;
create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();

-- single source of truth for the storefront price
create or replace function public.product_price(p_source text, p_base numeric, p_manual numeric, p_margin int)
returns numeric language sql immutable set search_path = '' as $$
  select case when p_source = 'manual' then p_manual
              else round(p_base * (1 + p_margin / 100.0), 2) end
$$;

-- orders ----------------------------------------------------------------------
-- items: [{ product_id, title, color, size, quantity, unit_price, image }]
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  subtotal numeric(10,2) not null default 0,
  shipping_amount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null,
  currency text not null default 'usd',
  shipping_address jsonb,
  status text not null default 'pending'
    check (status in ('pending','paid','processing','printing','shipped','delivered','cancelled','refunded')),
  fulfillment_status text,
  fulfillment_error text,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  inkthreadable_order_id text unique,
  tracking_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create trigger orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

-- admin notes on orders -------------------------------------------------------
create table public.order_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null default auth.uid(),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index order_notes_order_idx on public.order_notes (order_id, created_at);
create index order_notes_author_idx on public.order_notes (author_id);

-- reviews ---------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  author_name text not null default '',
  rating int not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 2000),
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index reviews_user_idx on public.reviews (user_id);
create index reviews_product_approved_idx on public.reviews (product_id) where is_approved;

-- author name is taken from the profile; new reviews always wait for moderation
create or replace function public.review_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.author_name := coalesce(nullif(split_part(
    (select full_name from public.profiles where id = new.user_id), ' ', 1), ''), 'Verified buyer');
  new.is_approved := false;
  return new;
end $$;
create trigger reviews_defaults before insert on public.reviews
  for each row execute function public.review_defaults();

-- contact + newsletter --------------------------------------------------------
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  message text not null check (char_length(message) between 1 and 5000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.newsletter_subscribers (
  email text primary key check (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  created_at timestamptz not null default now()
);
