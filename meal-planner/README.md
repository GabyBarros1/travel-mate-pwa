# Meal Planner Starter

Starter app for your personal meal planner:
- Frontend: Vite + React
- Auth: Supabase email/password
- Database: Supabase Postgres with RLS

## 1) Configure Supabase

1. Create a Supabase project.
2. In `Authentication > Providers`, enable Email (password sign-in).
3. In `Authentication > Users`, create your user.
4. In `SQL Editor`, run `supabase/schema.sql`.
   - If you already ran an older schema, run `supabase/migration_add_fiber.sql` too.
   - For robust shopping-list grouping, run `supabase/migration_add_ingredient_base.sql`.
   - To use recipe-total ingredient quantities, run `supabase/migration_recipe_totals.sql`.
   - To enable per-person profiles and nutrition summary, run `supabase/migration_add_profiles.sql`.
5. Copy these values from `Project Settings > API`:
   - Project URL
   - anon public key

## 2) Environment variables

Create `.env` from `.env.example` and set:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 3) Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite and sign in.

## 4) Deploy to GitHub Pages

If you want, add a GitHub Actions workflow later.
For now, build locally:

```bash
npm run build
```

Then publish `dist/` with your preferred Pages setup.

## Current scope

This starter currently includes:
- Login and logout
- Session handling
- SQL schema for profile, recipes (including fiber), planning, and shopping lists

Next implementation steps:
1. Recipes CRUD
2. Planner generation (4-week Monday cycles)
3. Weekly shopping list generation and manual additions
