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

alter table public.profiles enable row level security;

drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all" on public.profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
