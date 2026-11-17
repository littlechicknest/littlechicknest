# Little Chick Nest Shop

The official print-on-demand shop for [Little Chick Nest](https://littlechicknest.com). It's a static React site on **GitHub Pages**, with **Supabase** for the database, auth, storage and Edge Functions, **Stripe** for payments and **Inkthreadable** for printing.

```
Browser (GitHub Pages) ──► Supabase (Postgres + RLS, Auth, Storage)
        │                         ▲
        └──► Edge Functions ──────┤  create-checkout-session ─► Stripe Checkout
                                  │  stripe-webhook ──────────► Inkthreadable (create order)
                                  │  sync-order-status (hourly pg_cron) ◄─► Inkthreadable
                                  │  inkthreadable-webhook (real-time status)
                                  └  delete-user-account
```

**Secrets never reach the browser.** The site only gets the Supabase URL and the publishable key, both of which are public by design and protected by Row Level Security. The Inkthreadable and Stripe secret keys live only in Supabase Edge Function secrets. The cron token and webhook token are generated inside Supabase Vault.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL + publishable key
npm run dev                  # http://localhost:5173/littlechicknest/
npm test && npm run lint && npm run build
```

## One-time setup checklist

### 1. Supabase (project `groyltayfbxzsalzvsai`, already done)
- The migrations in `supabase/migrations/` are applied: tables, RLS, Storage bucket, Vault tokens and the hourly cron job.
- The Edge Functions in `supabase/functions/` are deployed.

### 2. Edge Function secrets
In the Supabase dashboard, open **Edge Functions → Secrets**:

| Name | Value |
|---|---|
| `INKTHREADABLE_SECRET_KEY` | Inkthreadable → Your account → API settings → Secret key |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → Secret key (`sk_live_…` / `sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | From step 4 (`whsec_…`) |
| *(optional)* `INKTHREADABLE_APP_ID` | Defaults to `APP-00330383` |
| *(optional)* `INKTHREADABLE_SHIPPING_METHOD` | `regular` (default), `recorded` or `courier` |
| *(optional)* `INKTHREADABLE_BRAND` | Brand name set up on Inkthreadable's Brand page |
| *(optional)* `SITE_URL` | Defaults to `https://littlechicknest.github.io/littlechicknest/` |

The shop starts in **test checkout mode** (see below), so the full journey works before Stripe is connected. After adding the Stripe secrets, switch *Admin → Pricing & sync → Checkout mode* to **Live**.

### 3. Auth (Supabase → Authentication)
- **URL Configuration → Site URL:** `https://littlechicknest.github.io/littlechicknest/`
- **Redirect URLs:** add the URL above and `http://localhost:5173/littlechicknest/`
- **Providers → Google:** enable it and paste the OAuth Client ID and Secret from Google Cloud Console (logged in as info.littlechicknest@gmail.com). In Google Cloud, the authorised redirect URI is `https://groyltayfbxzsalzvsai.supabase.co/auth/v1/callback`. The "Continue with Google" button works as soon as this is on.

### 4. Stripe webhook
Stripe → Developers → Webhooks → **Add endpoint**:
- URL: `https://groyltayfbxzsalzvsai.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `charge.refunded`
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

### 5. Inkthreadable webhook (optional; the hourly sync already covers this)
In **Admin → Pricing & sync** the full webhook URL, token included, is shown. Paste it into Inkthreadable → API settings → Webhooks (format **JSON**).

### 6. Make yourself admin
Sign up on the site with `info.littlechicknest@gmail.com`, confirm the email, then run this in the Supabase SQL editor:
```sql
update public.profiles set role = 'admin' where email = 'info.littlechicknest@gmail.com';
```
Refresh the site and an **Admin** button appears.

### 7. GitHub Pages
The repo includes `.github/workflows/deploy.yml`. In GitHub, go to **Settings → Pages → Source: GitHub Actions**, and **Settings → Secrets and variables → Actions** should contain `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Every push to `main` deploys automatically.

## Products & pricing

Inkthreadable's API covers **orders only**. It has no product catalogue endpoint, so products are added in the admin:

- **Inkthreadable products:** product code (`pn`) + base cost. The shop price is `base × (1 + margin%)`, using the **margin slider** in *Pricing & sync* (1–100%; $15 at 100% → $30). Add print-file URLs (front/back), which are sent to Inkthreadable with each order.
- **Manual products:** a fixed price. These orders are marked "manual fulfilment" for you to handle.
- **CSV import:** *Admin → CSV import* (template included). One row per colour. Re-importing a code updates that product.
- If Inkthreadable uses a different code per size or colour, put `{size}` / `{color}` in the code (e.g. `TSHIRT-{color}-{size}`), or set a per-colour code.

Categories: **Men, Women, Kids, Accessories**. Product images can be full `https://` URLs (e.g. Supabase Storage uploads) or paths to files shipped with the site such as `products/cap.webp`.

Prices are always calculated on the server (`public.product_price()` in SQL and the checkout function), never trusted from the browser.

## Test checkout mode (before Stripe)
While *Checkout mode* is **Test**, customers (and you, for the client demo) can go all the way through checkout: address, delivery option, order confirmation, then order tracking in *My orders*.
- Orders are created by the `place_test_order()` database function, which re-prices everything on the server.
- They are flagged `is_test`, show a **Test order** badge, take no payment and are **never sent to Inkthreadable** (the hourly sync skips them).
- Move a test order through Processing → Printing → Shipped → Delivered from *Admin → Orders* to preview the customer's tracking page.
- Limit: 20 test orders per account per day.

## Sample products
25 sample products (Men, Women, Kids, Accessories) were added so the client can see a full shop. Their photos are cropped from the brand pack and live in `public/products/`. They are marked **Sample** in *Admin → Products*; remove them all with **Delete sample products** once real Inkthreadable products are in.

## Shipping
Set in *Admin → Pricing & sync*: standard rate (default $4.95), free-standard threshold (default $75) and express rate (default $12.95). `public.shipping_cost()` is the single source of truth, used by test checkout and the Stripe function.

## Order flow
1. Customer fills in address + delivery on the shop's checkout page → `create-checkout-session` re-prices the basket from the database → Stripe Checkout (card, Apple Pay, Google Pay).
2. Stripe → `stripe-webhook` marks the order **paid** and sends it to Inkthreadable. Any error is shown on the admin order page and retried hourly.
3. `sync-order-status` runs hourly (pg_cron), and on demand from the admin, to pull status and tracking: Processing → Printing → Shipped.
4. Admins can set status, tracking and internal notes on any order.

## Security notes
- RLS is on every table. Customers can read only their own orders and profile and can't change their role. Product costs and print files are hidden from the public, and the storefront reads through `shop_products()`.
- Reviews can be posted only by customers who bought the product, and appear only after admin approval.
- `npm test` covers the margin formula, shipping rules, CSV validation and URL/image sanitising.
- **Rotate the Inkthreadable secret key and the GitHub token after setup.** Both were shared in plain text during the project.

## Legal pages
Terms, Privacy, Cookie Policy and Shipping & Returns are sensible e-commerce defaults (UK/GDPR-aware). Have them reviewed for your business before launch.
