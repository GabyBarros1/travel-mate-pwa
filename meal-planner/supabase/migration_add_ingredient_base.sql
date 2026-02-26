create extension if not exists unaccent;

alter table public.recipe_ingredients
  add column if not exists ingredient_base text;

update public.recipe_ingredients
set ingredient_base = trim(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          split_part(unaccent(lower(ingredient_name)), ',', 1),
          '\\(.*?\\)',
          ' ',
          'g'
        ),
        '\\m(cortado|cortada|cortados|cortadas|picado|picada|picados|picadas|pelado|pelada|pelados|peladas|dados|trozos|rodajas|grande|grandes|fino|fina|finos|finas|deshuesado|deshuesada|deshuesados|deshuesadas)\\M',
        ' ',
        'g'
      ),
      '\\m(de|del|la|el|los|las|en|con|sin|y)\\M',
      ' ',
      'g'
    ),
    '\\s+',
    ' ',
    'g'
  )
)
where ingredient_base is null
   or trim(ingredient_base) = '';

update public.recipe_ingredients
set ingredient_base = ingredient_name
where ingredient_base is null
   or trim(ingredient_base) = '';
