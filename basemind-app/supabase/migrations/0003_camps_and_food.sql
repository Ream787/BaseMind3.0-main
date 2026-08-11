-- Camps: events, the sites they're held at, per-event equipment packing lists,
-- a food stock cupboard, and per-event food requirements.
--
-- Every table reuses the same role model as equipment:
--   read    - any Active user
--   write   - Admin / Manager / Member
--   delete  - Admin / Manager
-- enforced by RLS so it holds even against direct REST calls.

-- =====================================================================
-- CAMPING SITES
-- =====================================================================
create table public.camping_sites (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  email text,
  address text,
  description text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- EVENTS (camps, hikes, meetings)
-- =====================================================================
create table public.events (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  start_date date not null,
  end_date date,
  site_id uuid references public.camping_sites(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- a camp can't finish before it starts
  constraint events_dates_ordered check (end_date is null or end_date >= start_date)
);

create index idx_events_start_date on public.events(start_date);

-- =====================================================================
-- EVENT EQUIPMENT (packing list)
-- =====================================================================
create table public.event_equipment (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.events(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  -- one row per item per event; adjust quantity rather than adding twice
  unique (event_id, equipment_id)
);

create index idx_event_equipment_event on public.event_equipment(event_id);

-- =====================================================================
-- FOOD STOCK (the cupboard)
-- Quantities are numeric because food comes in halves and decimals
-- (1.5 kg mince) in a way equipment counts don't.
-- =====================================================================
create table public.food_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  unit text not null default 'units',
  quantity numeric not null default 0 check (quantity >= 0),
  category text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- EVENT FOOD (what a camp needs)
-- The shopping list is derived: needed - in stock, per item.
-- =====================================================================
create table public.event_food (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.events(id) on delete cascade,
  food_item_id uuid not null references public.food_items(id) on delete cascade,
  quantity numeric not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  unique (event_id, food_item_id)
);

create index idx_event_food_event on public.event_food(event_id);

-- =====================================================================
-- updated_at triggers (reuses public.set_updated_at from 0001)
-- =====================================================================
create trigger trg_camping_sites_updated_at before update on public.camping_sites
  for each row execute function public.set_updated_at();
create trigger trg_events_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger trg_food_items_updated_at before update on public.food_items
  for each row execute function public.set_updated_at();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.camping_sites   enable row level security;
alter table public.events          enable row level security;
alter table public.event_equipment enable row level security;
alter table public.food_items      enable row level security;
alter table public.event_food      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['camping_sites','events','event_equipment','food_items','event_food']
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

-- =====================================================================
-- REALTIME
-- =====================================================================
alter publication supabase_realtime add table public.camping_sites;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.event_equipment;
alter publication supabase_realtime add table public.food_items;
alter publication supabase_realtime add table public.event_food;
