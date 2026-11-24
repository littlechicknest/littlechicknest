# Little Chick Nest Shop

The official print-on-demand shop for [Little Chick Nest](https://littlechicknest.com). It's a static React site on **GitHub Pages**, with **Supabase** for the database, auth, storage and Edge Functions, **Stripe** for payments and **Gelato** for products and printing.

```
Browser (GitHub Pages) ──► Supabase (Postgres + RLS, Auth, Storage)
        │                         ▲
        └──► Edge Functions ──────┤  create-checkout-session ─► Stripe Checkout
                                  │  stripe-webhook ──────────► Gelato (create order)
                                  │  sync-products (every 15 min) ◄── Gelato store
                                  │  sync-order-status (every 15 min) ◄─► Gelato
                                  │  gelato-webhook (real-time status, optional)
                                  └  delete-user-account
```

**Secrets never reach the browser.** The site only gets the Supabase URL and the publishable key, both of which are public by design and protected by Row Level Security. The Gelato key is in Supabase Vault (name `gelato_api_key`) and the Stripe key goes in Edge Function secrets. The cron and webhook tokens are generated inside Vault.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL + publishable key
npm run dev                  # http://localhost:5173/littlechicknest/
npm test && npm run lint && npm run build
```

## One-time setup checklist

### 1. Supabase (project `groyltayfbxzsalzvsai`, already done)
- The migrations in `supabase/migrations/` are applied: tables, RLS, Storage bucket, Vault tokens and the cron jobs.
- The Edge Functions in `supabase/functions/` are deployed.

### 2. Go live with Stripe (the only key left to add)
In the Supabase dashboard, open **Edge Functions → Secrets** and add `STRIPE_SECRET_KEY` (Stripe → Developers → API keys).

Within 15 minutes the shop registers its own Stripe webhook, stores the signing secret in Vault and switches checkout from **Test** to **Live**. To do it at once, press *Admin → Pricing & sync → Sync orders now*.

- `sk_live_…`: real payments, orders go to Gelato and Gelato charges you for them, so add a payment method in Gelato first.
- `sk_test_…`: Stripe test cards work, orders are marked as test orders and are **never** sent to Gelato. Replace it with the live key when ready.
- A restricted key (`rk_…`) needs write access to Checkout Sessions and Webhook Endpoints.

Optional secrets: `GELATO_API_KEY` (overrides the one in Vault), `GELATO_STORE_ID`, `SITE_URL`, `STRIPE_WEBHOOK_SECRET` (only if you create the webhook by hand; then also switch *Checkout mode* yourself).

To change the Gelato key in Vault: `select vault.update_secret(id, 'NEW_KEY') from vault.secrets where name = 'gelato_api_key';`

### 3. Auth (Supabase → Authentication)
- **URL Configuration → Site URL:** `https://littlechicknest.github.io/littlechicknest/`
- **Redirect URLs:** add the URL above and `http://localhost:5173/littlechicknest/`
- **Providers → Google:** enable it and paste the OAuth Client ID and Secret from Google Cloud Console (logged in as info.littlechicknest@gmail.com). In Google Cloud, the authorised redirect URI is `https://groyltayfbxzsalzvsai.supabase.co/auth/v1/callback`. The "Continue with Google" button works as soon as this is on.

### 4. Gelato webhook (optional; the 15-minute sync already covers this)
In **Admin → Pricing & sync** the full webhook URL, token included, is shown. Paste it into Gelato → Developer → Webhooks for order status updates.

### 5. Make yourself admin
Sign up on the site with `info.littlechicknest@gmail.com`, confirm the email, then run this in the Supabase SQL editor:
```sql
update public.profiles set role = 'admin' where email = 'info.littlechicknest@gmail.com';
```
Refresh the site and an **Admin** button appears.

### 6. GitHub Pages
The repo includes `.github/workflows/deploy.yml`. In GitHub, go to **Settings → Pages → Source: GitHub Actions**, and **Settings → Secrets and variables → Actions** should contain `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Every push to `main` deploys automatically.

## Products & pricing
`sync-products` copies the Gelato store every 15 minutes: title, description, size guide, colours, sizes, photos and cost. Nothing is typed in by hand.

- **Price** = Gelato cost × (1 + margin%), per colour and size, using the margin slider in *Pricing & sync*. Gelato costs in GBP are converted to USD with Gelato's own rate.
- **Photos** are copied once to Supabase Storage (Gelato's links expire after 24 h). A colour only shows its own photos; if Gelato has none for it, the first colour's photo is shown with a note. Add mockups in Gelato to fill the gaps.
- **Category** is guessed on first import (Unisex appears under Men and Women). Category, visibility, featured and print files are yours to edit and the sync never changes them.
- A product deleted in Gelato is hidden, not deleted.
- **Manual products** have a fixed price and are marked "manual fulfilment".

Categories: **Men, Women, Unisex, Kids, Accessories**.

Prices are always calculated on the server (`public.sku_price()` in SQL and the checkout function), never trusted from the browser.

## Test checkout mode (before Stripe)
While *Checkout mode* is **Test**, customers (and you, for the client demo) can go all the way through checkout: address, delivery option, order confirmation, then order tracking in *My orders*.
- Orders are created by the `place_test_order()` database function, which re-prices everything on the server.
- They are flagged `is_test`, show a **Test order** badge, take no payment and are **never sent to Gelato** (the sync skips them).
- Move a test order through Processing → Printing → Shipped → Delivered from *Admin → Orders* to preview the customer's tracking page.
- Limit: 20 test orders per account per day.

## Sample products
The 25 sample products are hidden. Remove them for good with **Delete sample products** in the admin.

## Shipping
Set in *Admin → Pricing & sync*: standard rate (default $4.95), free-standard threshold (default $75) and express rate (default $12.95). `public.shipping_cost()` is the single source of truth, used by test checkout and the Stripe function.

## Order flow
1. Customer fills in address + delivery on the shop's checkout page → `create-checkout-session` re-prices the basket from the database → Stripe Checkout (card, Apple Pay, Google Pay).
2. Stripe → `stripe-webhook` marks the order **paid** and sends it to Gelato. Any error is shown on the admin order page and retried every 15 minutes.
3. `sync-order-status` runs every 15 minutes (pg_cron), and on demand from the admin, to pull status and tracking: Processing → Printing → Shipped.
4. Admins can set status, tracking and internal notes on any order.

## Security notes
- RLS is on every table. Customers can read only their own orders and profile and can't change their role. Product costs and print files are hidden from the public, and the storefront reads through `shop_products()`.
- Reviews can be posted only by customers who bought the product, and appear only after admin approval.
- `npm test` covers the Gelato mapping, prices, shipping rules and URL/image sanitising.
- **Rotate the Gelato key and the GitHub token after setup.** Both were shared in plain text during the project.

## Legal pages
Terms, Privacy, Cookie Policy and Shipping & Returns are sensible e-commerce defaults (UK/GDPR-aware). Have them reviewed for your business before launch.
