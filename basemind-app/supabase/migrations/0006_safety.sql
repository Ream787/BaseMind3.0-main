-- Safety: emergency details per site, and a per-camp safety plan.
--
-- Everything here is typed in by a leader. Nothing is generated, looked up or
-- inferred — a wrong hospital number on a camp is a real-world problem, so the
-- only source is a person who checked it.

-- ---------------------------------------------------------------------
-- Emergency details on the campsite
-- ---------------------------------------------------------------------
alter table public.camping_sites
  add column hospital_name text,
  add column hospital_phone text,
  add column hospital_address text,
  -- Free text ("about 20 km, 25 min via the R512") rather than a number:
  -- the useful part is the drive, and it varies by weather and vehicle.
  add column hospital_distance text,
  add column emergency_notes text,
  -- Where an ambulance should actually meet you, if it isn't the main gate.
  add column emergency_access text;

-- ---------------------------------------------------------------------
-- SAFETY PLANS - one per camp
--
-- Scenario responses are rows rather than columns because every group has a
-- different list: water activities matter at one site and not another.
-- ---------------------------------------------------------------------
create table public.safety_plans (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null unique references public.events(id) on delete cascade,

  -- Who is in charge, and who is on call from home.
  leader_in_charge text,
  leader_phone text,
  standby_name text,
  standby_phone text,
  first_aider_name text,
  first_aider_phone text,

  -- National numbers vary by country, so they're entered, not assumed.
  emergency_number text,
  ambulance_number text,

  -- Anything else the leader wants carried onto the printed plan.
  extra_notes text,

  -- Cached prose from the last generation, so the document is stable and
  -- reviewable rather than changing every time it's opened.
  generated_text text,
  generated_at timestamptz,
  -- 'template' or 'gemini' — which produced generated_text.
  generated_by text check (generated_by is null or generated_by in ('template','gemini')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_safety_plans_updated_at before update on public.safety_plans
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- SCENARIO RESPONSES
-- "If someone drowns -> ...", "If someone is injured -> ..."
-- ---------------------------------------------------------------------
create table public.safety_scenarios (
  id uuid primary key default uuid_generate_v4(),
  safety_plan_id uuid not null references public.safety_plans(id) on delete cascade,
  -- e.g. 'Serious injury', 'Drowning / water', 'Missing person', 'Fire'
  scenario text not null,
  response text not null,
  -- Where to go / who to call for this specific scenario, when it differs
  -- from the default hospital (a drowning may need a different facility).
  destination text,
  contact_phone text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_safety_scenarios_plan on public.safety_scenarios (safety_plan_id, sort_order);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.safety_plans     enable row level security;
alter table public.safety_scenarios enable row level security;

do $$
declare t text;
begin
  foreach t in array array['safety_plans','safety_scenarios']
  loop
    execute format($f$
      create policy %1$s_select on public.%1$s for select
        using (public.is_active_user());

      create policy %1$s_insert on public.%1$s for insert
        with check (public.is_active_user()
                    and public.current_role() in ('Admin','Manager','Member'));

      create policy %1$s_update on public.%1$s for update
        using (public.is_active_user()
               and public.current_role() in ('Admin','Manager','Member'))
        with check (public.is_active_user()
                    and public.current_role() in ('Admin','Manager','Member'));

      create policy %1$s_delete on public.%1$s for delete
        using (public.is_active_user()
               and public.current_role() in ('Admin','Manager'));
    $f$, t);
  end loop;
end $$;

alter publication supabase_realtime add table public.safety_plans;
alter publication supabase_realtime add table public.safety_scenarios;
