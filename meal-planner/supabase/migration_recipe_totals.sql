alter table public.recipes
  add column if not exists recipe_servings integer not null default 4;

alter table public.recipe_ingredients
  add column if not exists quantity_recipe_total numeric(10,2);

update public.recipe_ingredients ri
set quantity_recipe_total = round((ri.quantity_per_serving * coalesce(r.recipe_servings, 1))::numeric, 2)
from public.recipes r
where r.id = ri.recipe_id
  and (ri.quantity_recipe_total is null or ri.quantity_recipe_total <= 0);
