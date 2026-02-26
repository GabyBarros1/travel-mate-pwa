create table if not exists public.ingredient_catalog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_base text not null,
  default_unit text not null,
  default_category text not null default 'Ingrediente',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ingredient_catalog_user_id_idx on public.ingredient_catalog(user_id);

create unique index if not exists ingredient_catalog_user_base_unique
  on public.ingredient_catalog(user_id, ingredient_base);

alter table public.ingredient_catalog enable row level security;

drop policy if exists "ingredient_catalog_owner_all" on public.ingredient_catalog;
create policy "ingredient_catalog_owner_all" on public.ingredient_catalog
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
