alter table public.recipes
  add column if not exists fiber_g numeric(8,2) not null default 0;
