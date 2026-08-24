-- Feature switches, so an admin can hide a section the group doesn't use or
-- that's misbehaving, without a redeploy.
--
-- Rows rather than a single settings blob: each feature updates independently,
-- so two admins toggling different things can't overwrite each other.

create table public.feature_flags (
  -- Matches the key used in the app's nav and route guards.
  key text primary key,
  label text not null,
  description text,
  enabled boolean not null default true,
  -- Ordering in the admin list; keeps it stable as features are added.
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create trigger trg_feature_flags_updated_at before update on public.feature_flags
  for each row execute function public.set_updated_at();

insert into public.feature_flags (key, label, description, sort_order) values
  ('equipment', 'Equipment',  'Inventory, conditions and where things are kept', 1),
  ('loans',     'Borrowing',  'Who has what, and when it is due back',           2),
  ('events',    'Calendar',   'Camps, hikes and meetings, and camp planning',    3),
  ('sites',     'Sites',      'Camping sites and their emergency details',       4),
  ('menus',     'Menus',      'Reusable meal plans',                             5),
  ('food',      'Food',       'The food store and shopping lists',               6),
  ('forms',     'Forms',      'Filling official PDF forms from camp data',       7),
  ('safety',    'Safety plans', 'Safety plans on the camp page',                 8)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- RLS: everyone signed in can read (the app needs them to build the nav);
-- only an Admin can change them.
-- ---------------------------------------------------------------------
alter table public.feature_flags enable row level security;

create policy feature_flags_select on public.feature_flags for select
  using (public.is_active_user());

create policy feature_flags_update on public.feature_flags for update
  using (public.current_role() = 'Admin' and public.is_active_user())
  with check (public.current_role() = 'Admin' and public.is_active_user());

-- No insert or delete policy: the set of features is defined by the app, so
-- rows are added by migrations rather than by users.

alter publication supabase_realtime add table public.feature_flags;
