-- ======================================================================
-- BaseMind Lab — everything else, in a schema of its own.
--
-- WHY A SEPARATE SCHEMA
-- ---------------------
-- This branch adds a lot of tables at once. Putting them in `public`
-- alongside equipment, events and food would mean the experiment and the
-- working app share a namespace, a backup and a blast radius: one bad
-- migration here and the group's real inventory is in the way of the fix.
--
-- So everything below lives in `lab`. That buys three things:
--
--   1. The main app is untouched. Not "carefully avoided" — literally not
--      referenced by any create/alter statement in this file except by
--      foreign key, which reads public rows and never changes them.
--   2. Removal is one line. `drop schema lab cascade` (see drop_lab.sql)
--      takes the whole experiment away and leaves the app exactly as it
--      was. No hunting for which of forty tables was ours.
--   3. Both can live in one Supabase project, so there is no second set
--      of keys, no second URL and no second login to keep in step.
--
-- The auth helpers are the deliberate exception: policies here call
-- public.is_active_user() and public.current_role() rather than
-- re-deriving them, because who counts as an active Admin must have
-- exactly one answer across the whole database. Dropping `lab` does not
-- touch those.
--
-- HOW TO INSTALL
-- --------------
--   1. Run this file in the Supabase SQL editor (once).
--   2. Run 0002_lab_functions.sql, then optionally 0003_lab_seed.sql.
--   3. Dashboard -> Project Settings -> API -> "Exposed schemas": add
--      `lab` next to `public`. PostgREST will not serve a schema it has
--      not been told about, and the app shows a setup page until it is.
-- ======================================================================

create schema if not exists lab;

-- PostgREST connects as `authenticated`/`anon`; without usage on the schema
-- it cannot see the tables at all, and every request fails in a way that
-- looks like a missing table rather than a missing grant.
grant usage on schema lab to anon, authenticated, service_role;

-- ----------------------------------------------------------------------
-- Helpers.
--
-- Two role tests, written once. Thirty-odd tables share four policies
-- each; spelling the role list out 120 times is how a schema ends up with
-- one table that quietly lets Viewers write.
-- ----------------------------------------------------------------------

create or replace function lab.set_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

/** Signed in, approved, and allowed to add or change things. */
create or replace function lab.can_write()
returns boolean language sql stable as $fn$
  select public.is_active_user()
     and public.current_role() in ('Admin', 'Manager', 'Member');
$fn$;

/** Leader-level: also allowed to delete, and to run the group's admin. */
create or replace function lab.can_manage()
returns boolean language sql stable as $fn$
  select public.is_active_user()
     and public.current_role() in ('Admin', 'Manager');
$fn$;

-- ======================================================================
-- PEOPLE
--
-- `members` are the young people in the group. They are NOT app users:
-- an eleven-year-old does not get a login, and their medical details must
-- not be tied to an account anyone could sign into. public.users stays as
-- it is — the leaders who run the app — and these two never merge.
-- ======================================================================

create table lab.patrols (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  -- 1-8, matching the --avatar-N hues, so a patrol's colour is one the
  -- stylesheet already knows how to draw in both themes.
  colour smallint not null default 1 check (colour between 1 and 8),
  motto text,
  emblem text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lab.members (
  id uuid primary key default uuid_generate_v4(),
  first_name text not null,
  last_name text not null,
  -- A member survives their patrol being disbanded; they just have none.
  patrol_id uuid references lab.patrols(id) on delete set null,
  date_of_birth date,
  joined_on date,
  rank text,
  parent_name text,
  parent_phone text,
  parent_email text,
  -- Free text on purpose. A checkbox list of conditions would be both
  -- incomplete and a worse thing to get wrong than a sentence somebody
  -- actually reads before a camp.
  medical_notes text,
  dietary_notes text,
  allergies text,
  photo_consent boolean not null default false,
  swim_ability text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_lab_members_patrol on lab.members (patrol_id);
create index idx_lab_members_name on lab.members (last_name, first_name);

create table lab.attendance (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references lab.members(id) on delete cascade,
  -- Deliberately text rather than an enum: a group will invent a state
  -- ("coming Saturday only") faster than anyone will run a migration.
  status text not null default 'Unknown',
  paid boolean not null default false,
  consent_form_in boolean not null default false,
  transport text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, member_id)
);

create index idx_lab_attendance_event on lab.attendance (event_id);

-- ======================================================================
-- PROGRESSION
--
-- Badges have requirements; a member can have a requirement ticked off
-- without having the badge. Storing only "has badge" loses the year of
-- work in between, which is the part a parent asks about.
-- ======================================================================

create table lab.badges (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  category text,
  colour smallint not null default 1 check (colour between 1 and 8),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lab.badge_requirements (
  id uuid primary key default uuid_generate_v4(),
  badge_id uuid not null references lab.badges(id) on delete cascade,
  text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_lab_badge_reqs on lab.badge_requirements (badge_id);

create table lab.member_badges (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references lab.members(id) on delete cascade,
  badge_id uuid not null references lab.badges(id) on delete cascade,
  awarded_on date not null default current_date,
  awarded_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  unique (member_id, badge_id)
);

create table lab.member_requirements (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references lab.members(id) on delete cascade,
  requirement_id uuid not null references lab.badge_requirements(id) on delete cascade,
  done_on date not null default current_date,
  signed_off_by uuid references public.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  unique (member_id, requirement_id)
);

create index idx_lab_member_reqs on lab.member_requirements (member_id);

-- ======================================================================
-- PATROL POINTS
--
-- A ledger, not a running total on the patrol row. "Who gave us those
-- twenty points, and what for" is the question that gets asked, and a
-- single integer cannot answer it. The total is a sum over this table.
-- ======================================================================

create table lab.point_awards (
  id uuid primary key default uuid_generate_v4(),
  patrol_id uuid not null references lab.patrols(id) on delete cascade,
  -- Optional: points are usually earned by a patrol, sometimes by one person.
  member_id uuid references lab.members(id) on delete set null,
  points integer not null,
  reason text not null,
  awarded_by uuid references public.users(id) on delete set null,
  awarded_at timestamptz not null default now()
);

create index idx_lab_points_patrol on lab.point_awards (patrol_id);

-- ======================================================================
-- PROGRAMME
-- ======================================================================

create table lab.activities (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  kind text,
  duration_minutes integer not null default 15,
  indoors boolean not null default true,
  outdoors boolean not null default true,
  min_people integer,
  max_people integer,
  kit_needed text,
  instructions text,
  risk_notes text,
  source text,
  favourite boolean not null default false,
  times_run integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lab.programmes (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  meets_on date not null,
  theme text,
  location text,
  lead_person text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_lab_programmes_date on lab.programmes (meets_on);

create table lab.programme_slots (
  id uuid primary key default uuid_generate_v4(),
  programme_id uuid not null references lab.programmes(id) on delete cascade,
  -- The title is copied from the activity, not read through the link, on
  -- purpose: editing an activity in the library should not rewrite what
  -- last term's programme says happened.
  title text not null,
  activity_id uuid references lab.activities(id) on delete set null,
  minutes integer not null default 15,
  lead_person text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_lab_slots_programme on lab.programme_slots (programme_id);

-- ======================================================================
-- CAMP OPERATIONS
-- ======================================================================

create table lab.tasks (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references public.events(id) on delete cascade,
  title text not null,
  detail text,
  status text not null default 'Todo',
  assignee_id uuid references public.users(id) on delete set null,
  due_on date,
  priority integer not null default 2 check (priority between 1 and 3),
  sort_order integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_lab_tasks_event on lab.tasks (event_id);

create table lab.duties (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.events(id) on delete cascade,
  day_number integer not null default 1,
  duty text not null,
  patrol_id uuid references lab.patrols(id) on delete set null,
  member_id uuid references lab.members(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_lab_duties_event on lab.duties (event_id);

create table lab.expenses (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references public.events(id) on delete cascade,
  description text not null,
  category text,
  -- Integer minor units. Money in a float is how a camp budget ends up
  -- three pence out and nobody can find it.
  amount_cents integer not null default 0,
  paid_by uuid references public.users(id) on delete set null,
  spent_on date not null default current_date,
  reimbursed boolean not null default false,
  receipt_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_lab_expenses_event on lab.expenses (event_id);

create table lab.budgets (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  charge_per_head_cents integer not null default 0,
  subs_collected_cents integer not null default 0,
  grant_cents integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lab.risk_assessments (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  event_id uuid references public.events(id) on delete cascade,
  activity_id uuid references lab.activities(id) on delete set null,
  assessor text,
  assessed_on date not null default current_date,
  review_on date,
  approved_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lab.risk_lines (
  id uuid primary key default uuid_generate_v4(),
  assessment_id uuid not null references lab.risk_assessments(id) on delete cascade,
  hazard text not null,
  who_at_risk text,
  likelihood smallint not null default 2 check (likelihood between 1 and 5),
  severity smallint not null default 2 check (severity between 1 and 5),
  controls text,
  residual_note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_lab_risk_lines on lab.risk_lines (assessment_id);

create table lab.incidents (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references public.events(id) on delete cascade,
  happened_at timestamptz not null default now(),
  kind text not null default 'Near miss',
  who_involved text,
  what_happened text not null,
  action_taken text,
  first_aid_given boolean not null default false,
  parents_informed boolean not null default false,
  reportable boolean not null default false,
  reported_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ======================================================================
-- COMMUNICATION
-- ======================================================================

create table lab.announcements (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  body text not null default '',
  pinned boolean not null default false,
  expires_on date,
  author_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lab.announcement_reactions (
  id uuid primary key default uuid_generate_v4(),
  announcement_id uuid not null references lab.announcements(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (announcement_id, user_id, emoji)
);

create table lab.messages (
  id uuid primary key default uuid_generate_v4(),
  channel text not null default 'general',
  author_id uuid references public.users(id) on delete set null,
  body text not null,
  -- Set rather than deleted, so a thread keeps its shape when somebody
  -- removes a line from the middle of it.
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_lab_messages_channel on lab.messages (channel, created_at);

create table lab.polls (
  id uuid primary key default uuid_generate_v4(),
  question text not null,
  detail text,
  multi boolean not null default false,
  closes_on date,
  closed boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lab.poll_options (
  id uuid primary key default uuid_generate_v4(),
  poll_id uuid not null references lab.polls(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table lab.poll_votes (
  id uuid primary key default uuid_generate_v4(),
  option_id uuid not null references lab.poll_options(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (option_id, user_id)
);

-- ======================================================================
-- EQUIPMENT, CONTINUED
--
-- These hang off public.equipment by foreign key and add nothing to it.
-- The inventory row stays the single description of the item; this is
-- what has happened to it since.
-- ======================================================================

create table lab.maintenance_logs (
  id uuid primary key default uuid_generate_v4(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  logged_on date not null default current_date,
  kind text not null default 'Check',
  detail text,
  cost_cents integer not null default 0,
  done_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_lab_maint_equipment on lab.maintenance_logs (equipment_id);

create table lab.stocktakes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  started_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lab.stocktake_entries (
  id uuid primary key default uuid_generate_v4(),
  stocktake_id uuid not null references lab.stocktakes(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  -- Recorded at counting time. The inventory can move underneath a
  -- stocktake, and a count you cannot compare against what was expected
  -- when it was taken is not evidence of anything.
  expected_quantity integer not null default 0,
  counted_quantity integer,
  condition text,
  note text,
  counted_at timestamptz,
  counted_by uuid references public.users(id) on delete set null,
  unique (stocktake_id, equipment_id)
);

create index idx_lab_stock_entries on lab.stocktake_entries (stocktake_id);

create table lab.wishlist (
  id uuid primary key default uuid_generate_v4(),
  item text not null,
  why text,
  estimated_cents integer not null default 0,
  status text not null default 'Requested',
  requested_by uuid references public.users(id) on delete set null,
  decided_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lab.wishlist_votes (
  id uuid primary key default uuid_generate_v4(),
  wishlist_id uuid not null references lab.wishlist(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (wishlist_id, user_id)
);

-- ======================================================================
-- CAMP EXTRAS
-- ======================================================================

create table lab.kit_lists (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  kind text not null default 'Camp',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lab.kit_list_items (
  id uuid primary key default uuid_generate_v4(),
  kit_list_id uuid not null references lab.kit_lists(id) on delete cascade,
  item text not null,
  quantity integer not null default 1,
  -- Grams. Most lines will not have one, but a hike list with weights is
  -- a pack weight the toolkit can total.
  weight_grams integer,
  essential boolean not null default true,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_lab_kit_items on lab.kit_list_items (kit_list_id);

create table lab.site_reviews (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.camping_sites(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  stayed_on date,
  author_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_lab_site_reviews on lab.site_reviews (site_id);

create table lab.photos (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references public.events(id) on delete cascade,
  storage_path text not null,
  caption text,
  taken_on date,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_lab_photos_event on lab.photos (event_id);

-- ======================================================================
-- META
-- ======================================================================

-- Lab's own switches. It would have been shorter to add rows to
-- public.feature_flags, but then removing the experiment would mean
-- picking nineteen rows back out of the app's own table — and until
-- somebody did, the app would show switches for pages that no longer
-- exist.
create table lab.feature_flags (
  key text primary key,
  label text not null,
  description text,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table lab.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table lab.audit_log (
  id uuid primary key default uuid_generate_v4(),
  table_name text not null,
  row_id uuid,
  action text not null,
  actor_id uuid references public.users(id) on delete set null,
  summary text,
  at timestamptz not null default now()
);

create index idx_lab_audit_at on lab.audit_log (at desc);

-- ======================================================================
-- TRIGGERS
-- ======================================================================

do $do$
declare t text;
begin
  foreach t in array array[
    'patrols','members','attendance','badges','activities','programmes',
    'tasks','duties','expenses','budgets','risk_assessments','incidents',
    'announcements','polls','stocktakes','wishlist','kit_lists',
    'site_reviews','feature_flags','settings'
  ] loop
    execute format(
      'create trigger trg_%1$s_updated_at before update on lab.%1$I
         for each row execute function lab.set_updated_at()', t);
  end loop;
end $do$;

-- ======================================================================
-- ROW LEVEL SECURITY
--
-- The same four policies on nearly every table: read if you are signed in
-- and approved, write if you are a Member or above, delete if you are a
-- leader. Written as a loop because thirty tables of copy-paste is thirty
-- chances to leave one table open.
--
-- The tables with rules of their own are listed underneath and left out
-- of the loop.
-- ======================================================================

do $do$
declare t text;
begin
  foreach t in array array[
    'patrols','members','attendance','badges','badge_requirements',
    'member_badges','member_requirements','point_awards','activities',
    'programmes','programme_slots','tasks','duties','expenses','budgets',
    'risk_assessments','risk_lines','incidents','maintenance_logs',
    'stocktakes','stocktake_entries','wishlist','kit_lists','kit_list_items',
    'site_reviews','photos','polls','poll_options','audit_log'
  ] loop
    execute format('alter table lab.%I enable row level security', t);
    execute format(
      'create policy %I on lab.%I for select using (public.is_active_user())',
      t || '_select', t);
    execute format(
      'create policy %I on lab.%I for insert with check (lab.can_write())',
      t || '_insert', t);
    execute format(
      'create policy %I on lab.%I for update using (lab.can_write()) with check (lab.can_write())',
      t || '_update', t);
    execute format(
      'create policy %I on lab.%I for delete using (lab.can_manage())',
      t || '_delete', t);
  end loop;
end $do$;

-- --- Announcements: leaders write, everyone reads. -------------------
alter table lab.announcements enable row level security;

create policy announcements_select on lab.announcements for select
  using (public.is_active_user());
create policy announcements_insert on lab.announcements for insert
  with check (lab.can_manage());
create policy announcements_update on lab.announcements for update
  using (lab.can_manage()) with check (lab.can_manage());
create policy announcements_delete on lab.announcements for delete
  using (lab.can_manage());

-- --- Reactions and votes: yours are yours. ---------------------------
-- Anyone signed in may react or vote, and may take their own back. What
-- they may not do is remove somebody else's, which the shared
-- can_manage() delete policy above would have allowed by accident.
alter table lab.announcement_reactions enable row level security;

create policy reactions_select on lab.announcement_reactions for select
  using (public.is_active_user());
create policy reactions_insert on lab.announcement_reactions for insert
  with check (public.is_active_user() and user_id = auth.uid());
create policy reactions_delete on lab.announcement_reactions for delete
  using (public.is_active_user() and user_id = auth.uid());

alter table lab.poll_votes enable row level security;

create policy poll_votes_select on lab.poll_votes for select
  using (public.is_active_user());
create policy poll_votes_insert on lab.poll_votes for insert
  with check (public.is_active_user() and user_id = auth.uid());
create policy poll_votes_delete on lab.poll_votes for delete
  using (public.is_active_user() and user_id = auth.uid());

alter table lab.wishlist_votes enable row level security;

create policy wishlist_votes_select on lab.wishlist_votes for select
  using (public.is_active_user());
create policy wishlist_votes_insert on lab.wishlist_votes for insert
  with check (public.is_active_user() and user_id = auth.uid());
create policy wishlist_votes_delete on lab.wishlist_votes for delete
  using (public.is_active_user() and user_id = auth.uid());

-- --- Messages: you post as yourself, and only leaders remove. --------
-- Updates are limited to the author so "delete" can be a soft one; a
-- leader can still take a message out of the table outright.
alter table lab.messages enable row level security;

create policy messages_select on lab.messages for select
  using (public.is_active_user());
create policy messages_insert on lab.messages for insert
  with check (public.is_active_user() and author_id = auth.uid());
create policy messages_update on lab.messages for update
  using (public.is_active_user() and (author_id = auth.uid() or lab.can_manage()))
  with check (public.is_active_user() and (author_id = auth.uid() or lab.can_manage()));
create policy messages_delete on lab.messages for delete
  using (lab.can_manage());

-- --- Flags and settings: read by all, changed by Admins only. --------
alter table lab.feature_flags enable row level security;

create policy lab_flags_select on lab.feature_flags for select
  using (public.is_active_user());
create policy lab_flags_update on lab.feature_flags for update
  using (public.current_role() = 'Admin' and public.is_active_user())
  with check (public.current_role() = 'Admin' and public.is_active_user());

alter table lab.settings enable row level security;

create policy lab_settings_select on lab.settings for select
  using (public.is_active_user());
create policy lab_settings_insert on lab.settings for insert
  with check (public.current_role() = 'Admin' and public.is_active_user());
create policy lab_settings_update on lab.settings for update
  using (public.current_role() = 'Admin' and public.is_active_user())
  with check (public.current_role() = 'Admin' and public.is_active_user());

-- ----------------------------------------------------------------------
-- Grants.
--
-- RLS decides what a request may touch; without a grant PostgREST never
-- gets far enough to ask. Both are needed, and a grant on its own is not
-- a permission — every table above has RLS enabled.
-- ----------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema lab to authenticated;
grant select on all tables in schema lab to anon;
grant all on all tables in schema lab to service_role;
grant execute on all functions in schema lab to authenticated, anon, service_role;

alter default privileges in schema lab
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema lab
  grant execute on functions to authenticated, anon, service_role;

-- ----------------------------------------------------------------------
-- Realtime.
--
-- One publication serves the whole project, so lab tables join the same
-- one the app already uses. Wrapped because re-running this file should
-- not fail on a table that is already published.
-- ----------------------------------------------------------------------
do $do$
declare t text;
begin
  foreach t in array array[
    'patrols','members','attendance','badges','badge_requirements',
    'member_badges','member_requirements','point_awards','activities',
    'programmes','programme_slots','tasks','duties','expenses','budgets',
    'risk_assessments','risk_lines','incidents','announcements',
    'announcement_reactions','messages','polls','poll_options','poll_votes',
    'maintenance_logs','stocktakes','stocktake_entries','wishlist',
    'wishlist_votes','kit_lists','kit_list_items','site_reviews','photos',
    'feature_flags','settings','audit_log'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table lab.%I', t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end $do$;

-- ----------------------------------------------------------------------
-- Photo storage.
--
-- Its own bucket, so removing the experiment does not go anywhere near
-- the policy PDFs.
-- ----------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('lab-photos', 'lab-photos', false)
on conflict (id) do nothing;

create policy lab_photos_read on storage.objects for select
  using (bucket_id = 'lab-photos' and public.is_active_user());

create policy lab_photos_write on storage.objects for insert
  with check (bucket_id = 'lab-photos' and lab.can_write());

create policy lab_photos_delete on storage.objects for delete
  using (bucket_id = 'lab-photos' and lab.can_manage());

-- ----------------------------------------------------------------------
-- The switches themselves.
-- ----------------------------------------------------------------------
insert into lab.feature_flags (key, label, description, sort_order) values
  ('dashboard',  'Dashboard',    'The overview screen the app opens on',                1),
  ('members',    'Members',      'The young people, their patrols and their details',   2),
  ('progression','Progression',  'Badges, requirements and sign-offs',                  3),
  ('attendance', 'Attendance',   'Who is coming to what, and who has paid',             4),
  ('points',     'Patrol points','The running competition between patrols',             5),
  ('programme',  'Programme',    'Weekly meeting plans and the activity library',       6),
  ('tasks',      'Camp tasks',   'What still needs doing before a camp',                7),
  ('duties',     'Duty roster',  'Cooking, washing up and wood, by patrol',             8),
  ('money',      'Money',        'Camp budgets, expenses and what it costs per head',   9),
  ('risk',       'Risk',         'Risk assessments and the incident log',              10),
  ('noticeboard','Noticeboard',  'Announcements everyone sees when they open the app', 11),
  ('chat',       'Chat',         'A running conversation between leaders',             12),
  ('polls',      'Polls',        'Asking the group to pick something',                 13),
  ('gallery',    'Gallery',      'Camp photographs',                                   14),
  ('maintenance','Maintenance',  'Repair history and stocktakes for equipment',        15),
  ('wishlist',   'Wishlist',     'Kit people would like the group to buy',             16),
  ('kitlists',   'Kit lists',    'Printable personal packing lists',                   17),
  ('reviews',    'Site reviews', 'What the group thought of a campsite',               18),
  ('toolkit',    'Toolkit',      'Offline calculators, references and camp gadgets',   19)
on conflict (key) do nothing;

insert into lab.settings (key, value) values
  ('group', '{"name":"BaseMind Scout Group","section":"Scouts"}'::jsonb)
on conflict (key) do nothing;
