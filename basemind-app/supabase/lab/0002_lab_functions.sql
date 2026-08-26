-- ======================================================================
-- BaseMind Lab — the handful of jobs that belong in the database.
--
-- Run after 0001_lab_schema.sql.
--
-- Everything here is either a total the browser should not be downloading
-- rows to compute, or a multi-row insert that must not half-happen. Plain
-- CRUD stays in the app where it can be read.
--
-- All of these are SECURITY INVOKER (the default). They run as the caller,
-- so Row Level Security still applies inside them — a Viewer calling
-- roll_call() gets the same nothing they would get inserting by hand.
-- ======================================================================

-- ----------------------------------------------------------------------
-- The patrol competition table.
--
-- Points live in a ledger, so a standings screen would otherwise mean
-- fetching every award ever made and summing it in JavaScript. Sums here,
-- one row per patrol back.
-- ----------------------------------------------------------------------
create or replace function lab.patrol_standings()
returns table (
  patrol_id uuid,
  name text,
  colour smallint,
  emblem text,
  points bigint,
  member_count bigint,
  last_awarded_at timestamptz
)
language sql stable as $fn$
  select p.id,
         p.name,
         p.colour,
         p.emblem,
         coalesce(sum(a.points), 0)::bigint,
         (select count(*) from lab.members m
           where m.patrol_id = p.id and m.active)::bigint,
         max(a.awarded_at)
    from lab.patrols p
    left join lab.point_awards a on a.patrol_id = p.id
   where p.active
   group by p.id, p.name, p.colour, p.emblem, p.sort_order
   order by coalesce(sum(a.points), 0) desc, p.sort_order, p.name;
$fn$;

-- ----------------------------------------------------------------------
-- Progression, counted.
--
-- One row per member with how many badges they hold and how many loose
-- requirements they have signed off. The progression page draws a bar
-- from this rather than pulling every join row.
-- ----------------------------------------------------------------------
create or replace function lab.member_progress()
returns table (
  member_id uuid,
  badges_awarded bigint,
  requirements_done bigint,
  last_awarded_on date
)
language sql stable as $fn$
  select m.id,
         (select count(*) from lab.member_badges b where b.member_id = m.id)::bigint,
         (select count(*) from lab.member_requirements r where r.member_id = m.id)::bigint,
         (select max(b.awarded_on) from lab.member_badges b where b.member_id = m.id)
    from lab.members m;
$fn$;

-- ----------------------------------------------------------------------
-- Roll call: put every active member on an event's attendance list.
--
-- Starting from a blank list and typing thirty names is the reason
-- attendance does not get taken. This fills it in as "Unknown" so the
-- job becomes ticking rather than typing.
--
-- Idempotent: members already listed keep whatever status they were
-- given. Running it again after a new member joins adds only them.
-- ----------------------------------------------------------------------
create or replace function lab.roll_call(target_event_id uuid)
returns integer
language plpgsql as $fn$
declare
  added integer;
begin
  insert into lab.attendance (event_id, member_id)
  select target_event_id, m.id
    from lab.members m
   where m.active
     and not exists (
       select 1 from lab.attendance a
        where a.event_id = target_event_id and a.member_id = m.id
     );

  get diagnostics added = row_count;
  return added;
end;
$fn$;

-- ----------------------------------------------------------------------
-- Start a stocktake by photographing the inventory.
--
-- The expected quantities have to be copied at the moment counting
-- starts. If the entry read through to public.equipment instead, someone
-- editing the inventory mid-count would silently change what the count
-- was being compared against, and the discrepancy — the entire point of
-- a stocktake — would vanish.
-- ----------------------------------------------------------------------
create or replace function lab.start_stocktake(stocktake_name text)
returns uuid
language plpgsql as $fn$
declare
  new_id uuid;
begin
  insert into lab.stocktakes (name, started_by)
  values (coalesce(nullif(trim(stocktake_name), ''), 'Stocktake'), auth.uid())
  returning id into new_id;

  insert into lab.stocktake_entries (stocktake_id, equipment_id, expected_quantity)
  select new_id, e.id, e.quantity
    from public.equipment e;

  return new_id;
end;
$fn$;

-- ----------------------------------------------------------------------
-- Copy a programme to a new date.
--
-- Most meeting plans are last week's with two things swapped. Copying
-- the slots as well is what makes that true in practice.
-- ----------------------------------------------------------------------
create or replace function lab.copy_programme(
  source_programme_id uuid,
  new_date date,
  new_title text default null
)
returns uuid
language plpgsql as $fn$
declare
  new_id uuid;
begin
  insert into lab.programmes (title, meets_on, theme, location, lead_person, notes)
  select coalesce(nullif(trim(new_title), ''), p.title || ' (copy)'),
         new_date, p.theme, p.location, p.lead_person, p.notes
    from lab.programmes p
   where p.id = source_programme_id
  returning id into new_id;

  if new_id is null then
    raise exception 'Programme % not found', source_programme_id;
  end if;

  insert into lab.programme_slots
    (programme_id, title, activity_id, minutes, lead_person, notes, sort_order)
  select new_id, s.title, s.activity_id, s.minutes, s.lead_person, s.notes, s.sort_order
    from lab.programme_slots s
   where s.programme_id = source_programme_id;

  return new_id;
end;
$fn$;

-- ----------------------------------------------------------------------
-- What a camp costs.
--
-- Spend, income and the per-head number, worked out where the rows are.
-- Returns a row even for an event with no budget set up, so the money
-- page has something to render on first visit.
-- ----------------------------------------------------------------------
create or replace function lab.event_money(target_event_id uuid)
returns table (
  spent_cents bigint,
  unreimbursed_cents bigint,
  charge_per_head_cents integer,
  subs_collected_cents integer,
  grant_cents integer,
  attending integer,
  cost_per_head_cents numeric
)
language sql stable as $fn$
  with spend as (
    select coalesce(sum(amount_cents), 0)::bigint as total,
           coalesce(sum(amount_cents) filter (where not reimbursed), 0)::bigint as owed
      from lab.expenses where event_id = target_event_id
  ),
  budget as (
    select charge_per_head_cents, subs_collected_cents, grant_cents
      from lab.budgets where event_id = target_event_id
  ),
  heads as (
    select greatest(
      (select count(*) from lab.attendance
        where event_id = target_event_id and status = 'Coming'),
      0
    )::integer as n
  )
  select spend.total,
         spend.owed,
         coalesce(budget.charge_per_head_cents, 0),
         coalesce(budget.subs_collected_cents, 0),
         coalesce(budget.grant_cents, 0),
         heads.n,
         case when heads.n > 0 then round(spend.total::numeric / heads.n, 2) else null end
    from spend
    left join budget on true
    cross join heads;
$fn$;

-- ----------------------------------------------------------------------
-- The dashboard, in one request.
--
-- The overview screen needs a dozen counts from ten tables. Asking for
-- them separately is a dozen round trips before anything renders, on the
-- screen most likely to be opened on a phone with one bar of signal.
--
-- Returns jsonb rather than a wide row because the shape will keep
-- changing as the dashboard does, and a jsonb key that has not appeared
-- yet reads as undefined in the browser instead of failing the query.
-- ----------------------------------------------------------------------
create or replace function lab.dashboard()
returns jsonb
language sql stable as $fn$
  select jsonb_build_object(
    'members_active',
      (select count(*) from lab.members where active),
    'patrols',
      (select count(*) from lab.patrols where active),
    'badges_awarded_30d',
      (select count(*) from lab.member_badges
        where awarded_on >= current_date - 30),
    'tasks_open',
      (select count(*) from lab.tasks where status <> 'Done'),
    'tasks_overdue',
      (select count(*) from lab.tasks
        where status <> 'Done' and due_on is not null and due_on < current_date),
    'incidents_30d',
      (select count(*) from lab.incidents
        where happened_at >= now() - interval '30 days'),
    'unread_notices',
      (select count(*) from lab.announcements
        where expires_on is null or expires_on >= current_date),
    'open_polls',
      (select count(*) from lab.polls where not closed),
    'wishlist_open',
      (select count(*) from lab.wishlist where status = 'Requested'),
    'photos',
      (select count(*) from lab.photos),
    -- From the app's own tables. Read-only, and the reason the dashboard
    -- is worth having: these are the numbers that matter on a Monday.
    'equipment_items',
      (select count(*) from public.equipment),
    'equipment_needing_repair',
      (select count(*) from public.equipment
        where condition in ('Needs Repair', 'Broken', 'Missing')),
    'loans_out',
      (select count(*) from public.equipment_loans where returned_on is null),
    'loans_overdue',
      (select count(*) from public.equipment_loans
        where returned_on is null and due_back is not null and due_back < current_date),
    'events_upcoming',
      (select count(*) from public.events where start_date >= current_date),
    'next_event',
      (select to_jsonb(e) from (
         select id, name, start_date, end_date, headcount
           from public.events
          where start_date >= current_date
          order by start_date
          limit 1
       ) e)
  );
$fn$;

-- ----------------------------------------------------------------------
-- Functions created after 0001 need their own grant; that file's
-- "all functions in schema lab" only covered what existed at the time.
-- ----------------------------------------------------------------------
grant execute on all functions in schema lab to authenticated, anon, service_role;
