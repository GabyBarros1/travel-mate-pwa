-- Core profile: one row per auth user
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sex text,
  weight_kg numeric(6,2),
  height_cm numeric(6,2),
  age_years integer,
  activity_level text,
  goal text,
  default_servings integer not null default 3,
  restrictions text,
  preferences text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sex text not null default 'female',
  age_years integer not null,
  weight_kg numeric(6,2) not null,
  height_cm numeric(6,2) not null,
  activity_level text not null default 'moderate',
  goal text not null default 'maintain',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_user_id_idx on public.profiles(user_id);

-- Recipes (nutrition and prep are per serving)
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  meal_type text not null default 'pool', -- pool, pizza_fixed, pasta_fixed
  kcal numeric(8,2) not null,
  protein_g numeric(8,2) not null,
  carbs_g numeric(8,2) not null,
  fat_g numeric(8,2) not null,
  fiber_g numeric(8,2) not null default 0,
  recipe_servings integer not null default 4,
  prep_minutes integer,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipes_user_id_idx on public.recipes(user_id);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_name text not null,
  ingredient_base text,
  quantity_recipe_total numeric(10,2),
  quantity_per_serving numeric(10,2) not null,
  unit text not null,
  category text,
  created_at timestamptz not null default now()
);

create index if not exists recipe_ingredients_recipe_id_idx on public.recipe_ingredients(recipe_id);

-- One 4-week plan block (Mon-Sun weeks)
create table if not exists public.plan_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_monday date not null,
  weeks_count integer not null default 4,
  strategy text not null default 'variety_first',
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, start_monday)
);

create index if not exists plan_cycles_user_id_idx on public.plan_cycles(user_id);

-- One row per meal slot in the cycle
create table if not exists public.plan_slots (
  id uuid primary key default gen_random_uuid(),
  plan_cycle_id uuid not null references public.plan_cycles(id) on delete cascade,
  slot_date date not null,
  slot_name text not null, -- mon_dinner, fri_dinner_pizza, sat_lunch_pasta, etc
  status text not null default 'recipe', -- recipe, fixed, out
  recipe_id uuid references public.recipes(id) on delete set null,
  servings_override integer,
  created_at timestamptz not null default now(),
  unique(plan_cycle_id, slot_date, slot_name)
);

create index if not exists plan_slots_plan_cycle_id_idx on public.plan_slots(plan_cycle_id);

-- Generated weekly shopping list headers
create table if not exists public.shopping_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_monday date not null,
  plan_cycle_id uuid references public.plan_cycles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(user_id, week_monday)
);

create index if not exists shopping_weeks_user_id_idx on public.shopping_weeks(user_id);

-- Auto-generated line items from recipes/fixed meals
create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  shopping_week_id uuid not null references public.shopping_weeks(id) on delete cascade,
  ingredient_name text not null,
  quantity numeric(10,2) not null,
  unit text not null,
  category text,
  source text not null default 'auto', -- auto, fixed
  is_checked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists shopping_items_shopping_week_id_idx on public.shopping_items(shopping_week_id);

-- Manual extra items the user adds
create table if not exists public.shopping_manual_items (
  id uuid primary key default gen_random_uuid(),
  shopping_week_id uuid not null references public.shopping_weeks(id) on delete cascade,
  item_name text not null,
  quantity numeric(10,2),
  unit text,
  is_recurring boolean not null default false,
  recurrence_note text,
  is_checked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists shopping_manual_items_shopping_week_id_idx on public.shopping_manual_items(shopping_week_id);

alter table public.user_profiles enable row level security;
alter table public.profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.plan_cycles enable row level security;
alter table public.plan_slots enable row level security;
alter table public.shopping_weeks enable row level security;
alter table public.shopping_items enable row level security;
alter table public.shopping_manual_items enable row level security;

create policy "user_profiles_owner_all" on public.user_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "profiles_owner_all" on public.profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "recipes_owner_all" on public.recipes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "recipe_ingredients_owner_all" on public.recipe_ingredients
  for all using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
      and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
      and r.user_id = auth.uid()
    )
  );

create policy "plan_cycles_owner_all" on public.plan_cycles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "plan_slots_owner_all" on public.plan_slots
  for all using (
    exists (
      select 1 from public.plan_cycles pc
      where pc.id = plan_slots.plan_cycle_id
      and pc.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.plan_cycles pc
      where pc.id = plan_slots.plan_cycle_id
      and pc.user_id = auth.uid()
    )
  );

create policy "shopping_weeks_owner_all" on public.shopping_weeks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "shopping_items_owner_all" on public.shopping_items
  for all using (
    exists (
      select 1 from public.shopping_weeks sw
      where sw.id = shopping_items.shopping_week_id
      and sw.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.shopping_weeks sw
      where sw.id = shopping_items.shopping_week_id
      and sw.user_id = auth.uid()
    )
  );

create policy "shopping_manual_items_owner_all" on public.shopping_manual_items
  for all using (
    exists (
      select 1 from public.shopping_weeks sw
      where sw.id = shopping_manual_items.shopping_week_id
      and sw.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.shopping_weeks sw
      where sw.id = shopping_manual_items.shopping_week_id
      and sw.user_id = auth.uid()
    )
  );
