# Plantillas para Excel/CSV

Archivos:
- `recipes_template.csv`: recetas con nutricion por racion.
- `recipe_ingredients_template.csv`: ingredientes por racion vinculados por `recipe_name`.

Uso recomendado:
1. Abre ambos CSV en Excel.
2. Sustituye los ejemplos por tus recetas reales.
3. Guarda como CSV UTF-8.
4. Importa primero recetas y luego ingredientes.

Nota:
- Si importas directo a Supabase `recipes`, necesitas `user_id`.
- Para evitar poner `user_id` manualmente, conviene usar un script SQL de carga con `auth.uid()`.
