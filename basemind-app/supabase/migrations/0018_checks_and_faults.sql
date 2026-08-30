-- Two records the inventory was missing: what was said at a check, and what
-- is broken.

-- ---------------------------------------------------------------------
-- CHECKS
--
-- equipment already carries date_last_checked and checked_by, which answer
-- "is this due a look" and are used all over the app. Those stay as the
-- summary. This is the history behind them, and the place a note can live:
-- "two pegs bent", "zip sticking but usable" is exactly the kind of thing
-- that gets noticed at a check and then forgotten by the next one.
-- ---------------------------------------------------------------------
create table public.equipment_checks (
  id uuid primary key default uuid_generate_v4(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  checked_by uuid references public.users(id) on delete set null,
  checked_on date not null default current_date,
  note text,
  -- What it was found to be, so the history reads without cross-referencing.
  condition text,
  created_at timestamptz not null default now()
);

create index idx_equipment_checks_item
  on public.equipment_checks (equipment_id, checked_on desc);

-- ---------------------------------------------------------------------
-- FAULTS
--
-- "Broken" as a condition says the state but not the story: when it went,
-- what happened, and whether anyone intends to do anything about it. A axe
-- with a split handle that someone has decided to retire and one that is
-- waiting for a repair look identical in the inventory, and only one of them
-- should be replaced in the budget.
--
-- `plan` starts Undecided rather than defaulting to Repair, because pretending
-- a decision has been made is how a broken tent stays in the store for two
-- years.
-- ---------------------------------------------------------------------
create table public.equipment_faults (
  id uuid primary key default uuid_generate_v4(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,

  -- Nullable: often nobody knows exactly when it broke, and a guessed date
  -- is worse than an honest blank.
  broke_on date,
  reported_on date not null default current_date,
  reported_by uuid references public.users(id) on delete set null,

  description text not null,
  quantity integer not null default 1 check (quantity > 0),

  plan text not null default 'Undecided'
    check (plan in ('Undecided', 'Repair', 'Retire')),
  notes text,

  -- Set when it is fixed, replaced or written off. Null means still open.
  resolved_on date,
  resolution text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_equipment_faults_open
  on public.equipment_faults (resolved_on, reported_on desc);
create index idx_equipment_faults_item on public.equipment_faults (equipment_id);

create trigger trg_equipment_faults_updated_at before update on public.equipment_faults
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: the same model as the equipment these describe.
-- ---------------------------------------------------------------------
alter table public.equipment_checks enable row level security;
alter table public.equipment_faults enable row level security;

create policy equipment_checks_select on public.equipment_checks for select
  using (public.is_active_user());

create policy equipment_checks_insert on public.equipment_checks for insert
  with check (public.is_active_user()
              and public.current_role() in ('Admin','Manager','Member'));

-- No update or delete on checks: it is a record of what somebody saw on a
-- day. Correcting it means checking the thing again.
create policy equipment_checks_delete on public.equipment_checks for delete
  using (public.is_active_user() and public.current_role() = 'Admin');

create policy equipment_faults_select on public.equipment_faults for select
  using (public.is_active_user());

create policy equipment_faults_insert on public.equipment_faults for insert
  with check (public.is_active_user()
              and public.current_role() in ('Admin','Manager','Member'));

create policy equipment_faults_update on public.equipment_faults for update
  using (public.is_active_user()
         and public.current_role() in ('Admin','Manager','Member'))
  with check (public.is_active_user()
              and public.current_role() in ('Admin','Manager','Member'));

create policy equipment_faults_delete on public.equipment_faults for delete
  using (public.is_active_user() and public.current_role() in ('Admin','Manager'));

alter publication supabase_realtime add table public.equipment_checks;
alter publication supabase_realtime add table public.equipment_faults;
