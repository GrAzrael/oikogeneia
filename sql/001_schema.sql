-- Οικογενειακός Σύμβουλος — σχήμα βάσης
-- Ένας λογαριασμός (ο George) διαχειρίζεται όλα τα μέλη.
-- Κάθε γραμμή ανήκει στον owner_id. Το Claude γράφει μέσω Supabase connector
-- χωρίς auth.uid(), οπότε ο trigger συμπληρώνει τον μοναδικό χρήστη.

create extension if not exists pgcrypto;

-- ---------- βοηθητικά ----------
create or replace function public.fill_owner()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if new.owner_id is null then
    new.owner_id := coalesce(auth.uid(), (select id from auth.users order by created_at limit 1));
  end if;
  return new;
end $$;

create or replace function public.touch_updated()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

-- ---------- μέλη ----------
create table public.members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  relation text,                       -- εγώ, σύζυγος, παιδί...
  birth_date date,
  sex text check (sex in ('Α','Θ') or sex is null),
  height_cm numeric,
  allergies text,
  chronic_conditions text,
  diet_notes text,                     -- προτιμήσεις/περιορισμοί
  color text default '#2f6f5e',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- έγγραφα (PDF, φωτογραφίες εξετάσεων, συνταγές) ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  doc_date date default current_date,
  title text not null,
  kind text default 'εξετάσεις',       -- εξετάσεις, συνταγή, γνωμάτευση, απεικόνιση, άλλο
  source text,                         -- myHealth, μικροβιολογικό, γιατρός, φωτογραφία
  storage_path text,                   -- bucket health-docs
  processed boolean default false,     -- έχει εξαχθεί από Claude;
  notes text,
  created_at timestamptz default now()
);

-- ---------- αποτελέσματα εξετάσεων ----------
create table public.lab_results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  test_date date not null,
  test_name text not null,             -- κανονικοποιημένο όνομα, π.χ. «Ολική χοληστερίνη»
  category text,                       -- λιπίδια, σάκχαρο, νεφρικά, ηπατικά, αιματολογικά, σίδηρος, βιταμίνες, θυρεοειδής, ουρικό, άλλο
  value numeric,
  value_text text,                     -- για μη αριθμητικά (π.χ. «αρνητικό»)
  unit text,
  ref_low numeric,
  ref_high numeric,
  lab text,
  notes text,
  created_at timestamptz default now()
);
create index on public.lab_results (member_id, test_name, test_date desc);

-- ---------- στόχοι τιμών ----------
create table public.targets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  test_name text not null,
  target_low numeric,
  target_high numeric,
  unit text,
  set_by text,                         -- γιατρός / εγώ
  notes text,
  created_at timestamptz default now(),
  unique (member_id, test_name)
);

-- ---------- φάρμακα ----------
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  name text not null,
  dose text,                           -- π.χ. 10 mg
  schedule text,                       -- π.χ. 1 πρωί
  times text[],                        -- ['08:00','20:00']
  reason text,
  prescribed_by text,
  start_date date default current_date,
  end_date date,
  active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.med_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  taken_at timestamptz default now(),
  status text default 'πάρθηκε' check (status in ('πάρθηκε','παραλείφθηκε'))
);

-- ---------- γεύματα ----------
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  eaten_at timestamptz default now(),
  meal_type text,                      -- πρωινό, μεσημεριανό, βραδινό, σνακ
  description text,
  photo_path text,                     -- bucket health-docs
  analyzed boolean default false,      -- το Claude έχει υπολογίσει θρεπτικά;
  kcal numeric, carbs_g numeric, sugar_g numeric, fiber_g numeric,
  protein_g numeric, fat_g numeric, sat_fat_g numeric, sodium_mg numeric,
  purines text,                        -- χαμηλές/μέτριες/υψηλές (για ουρικό)
  advisor_note text,                   -- σχόλιο Claude
  created_at timestamptz default now()
);
create index on public.meals (member_id, eaten_at desc);

-- ---------- διάθεση / συμπτώματα ----------
create table public.wellbeing (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  logged_at timestamptz default now(),
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  sleep_hours numeric,
  symptoms text,
  notes text
);

-- ---------- μετρήσεις (βάρος, πίεση, σάκχαρο δακτύλου...) ----------
create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  measured_at timestamptz default now(),
  kind text not null,                  -- βάρος, πίεση, σάκχαρο, σφυγμοί, περίμετρος μέσης, θερμοκρασία
  value numeric,                       -- βάρος/σάκχαρο/κ.λπ. — για πίεση: συστολική
  value2 numeric,                      -- για πίεση: διαστολική
  unit text,
  context text,                        -- νηστεία, μετά φαγητού, πρωί...
  notes text
);
create index on public.measurements (member_id, kind, measured_at desc);

-- ---------- ραντεβού / εξετάσεις / εμβόλια ----------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  starts_at timestamptz not null,
  kind text default 'ραντεβού',        -- ραντεβού, εξετάσεις, εμβόλιο, επανέλεγχος
  title text not null,
  doctor text,
  location text,
  calendar_event_id text,              -- Google Calendar
  done boolean default false,
  notes text,
  created_at timestamptz default now()
);

-- ---------- αγορές σπιτιού ----------
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  category text default 'τρόφιμα',     -- τρόφιμα, φαρμακείο, καθαριστικά, σπίτι, συσκευές, παιδί
  qty numeric,
  unit text,
  reason text,                         -- γιατί προτείνεται (π.χ. για χοληστερίνη)
  for_member uuid references public.members(id) on delete set null,
  status text default 'χρειάζεται' check (status in ('χρειάζεται','αγοράστηκε','ακυρώθηκε')),
  best_store text,
  best_price numeric,
  price_checked_at timestamptz,
  link text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- συσκευές σπιτιού / μεγάλες αγορές ----------
create table public.household_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  category text,                       -- κουζίνα, πλυντήριο, κλιματισμός, ηλεκτρονικά...
  brand text, model text,
  status text default 'έχουμε' check (status in ('έχουμε','θέλουμε','σε έρευνα')),
  purchase_date date,
  price numeric,
  store text,
  warranty_until date,
  link text,
  notes text,
  created_at timestamptz default now()
);

-- ---------- σημειώσεις/αναφορές συμβούλου ----------
create table public.advisor_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  created_at timestamptz default now(),
  kind text default 'σημείωση',        -- σημείωση, εβδομαδιαία αναφορά, ανάλυση εξετάσεων, πρόγραμμα διατροφής
  title text not null,
  body text not null
);

-- ---------- triggers + RLS για όλους τους πίνακες ----------
do $$
declare t text;
begin
  foreach t in array array['members','documents','lab_results','targets','medications','med_logs',
                           'meals','wellbeing','measurements','appointments','shopping_items',
                           'household_items','advisor_notes']
  loop
    execute format('create trigger %I_owner before insert on public.%I for each row execute function public.fill_owner()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner_all" on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('create index on public.%I (owner_id)', t);
  end loop;
end $$;

create trigger members_touch before update on public.members for each row execute function public.touch_updated();
create trigger medications_touch before update on public.medications for each row execute function public.touch_updated();
create trigger shopping_touch before update on public.shopping_items for each row execute function public.touch_updated();

-- ---------- βολική προβολή: τελευταία τιμή κάθε εξέτασης ----------
create view public.v_latest_results with (security_invoker = true) as
select distinct on (r.member_id, r.test_name)
  r.member_id, m.name as member_name, r.test_name, r.category, r.test_date,
  r.value, r.value_text, r.unit, r.ref_low, r.ref_high,
  t.target_low, t.target_high,
  case
    when r.value is null then null
    when r.ref_high is not null and r.value > r.ref_high then 'υψηλό'
    when r.ref_low  is not null and r.value < r.ref_low  then 'χαμηλό'
    else 'εντός'
  end as flag
from public.lab_results r
join public.members m on m.id = r.member_id
left join public.targets t on t.member_id = r.member_id and t.test_name = r.test_name
order by r.member_id, r.test_name, r.test_date desc;

-- ---------- ιδιωτικός χώρος αρχείων ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('health-docs', 'health-docs', false, 20971520)
on conflict (id) do nothing;

create policy "health_docs_owner_read" on storage.objects for select to authenticated
  using (bucket_id = 'health-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "health_docs_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'health-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "health_docs_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'health-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Η αυτόματη εγγραφή νέων χρηστών πρέπει να κλείσει από το dashboard
-- (Authentication → Sign In / Providers → Allow new users to sign up: OFF) μετά τη δημιουργία του λογαριασμού.
