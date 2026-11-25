# Little Chick Nest Shop

The official print-on-demand shop for [Little Chick Nest](https://littlechicknest.com), live at https://littlechicknest.github.io/littlechicknest/. A static React site on GitHub Pages that talks to Supabase.

The admin panel, database migrations and Edge Functions live in [littlechicknest/admin](https://github.com/littlechicknest/admin). Setup, payments, Gelato and security notes are in its README.

```bash
npm install
cp .env.example .env.local   # Supabase URL + publishable key (public, protected by Row Level Security)
npm run dev                  # http://localhost:5173/littlechicknest/
npm test && npm run lint && npm run build
```

Every push to `main` tests, builds and deploys. Repository secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Pictures outside products are replaced in the admin under *Website photos* (slots: `src/lib/siteImages.tsx`).

Legal pages are sensible e-commerce defaults (UK/GDPR-aware). Have them reviewed for your business before launch.
