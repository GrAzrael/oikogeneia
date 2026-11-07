alter table public.meals
  add column if not exists items jsonb,
  add column if not exists caffeine_mg numeric,
  add column if not exists alcohol_g numeric,
  add column if not exists water_ml numeric;
comment on column public.meals.items is 'Τρόφιμα από τη λίστα της εφαρμογής: [{"id":"fakes","q":1}] — id από foods.js, q = μερίδες';
