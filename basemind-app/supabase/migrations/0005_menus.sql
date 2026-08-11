-- Menus: plan meals for a camp, and keep the good ones to reuse.
--
-- One structure serves both jobs:
--   event_id IS NULL  -> a reusable preset in the menu library
--   event_id IS SET   -> that camp's own menu
--
-- Applying a preset COPIES it onto the event rather than referencing it, so
-- editing a preset later never rewrites the menu of a camp that already
-- happened, and a camp's menu can be tweaked without disturbing the preset.
--
-- Quantities are stored as totals for `serves` people rather than per-person
-- amounts. "2 kg rice, feeds 12" is how a leader actually thinks about it;
-- per-person decimals are unreadable. Scaling happens when the preset is
-- applied to a camp with a different headcount.

-- ---------------------------------------------------------------------
-- Headcount on events, so menus can scale to the group actually going
-- ---------------------------------------------------------------------
alter table public.events
  add column headcount integer check (headcount is null or headcount > 0);

-- ---------------------------------------------------------------------
-- MENUS
-- ---------------------------------------------------------------------
create table public.menus (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  -- How many people the quantities below are written for.
  serves integer not null default 1 check (serves > 0),
  -- Length in days, so the library can be filtered to "2 day menus".
  day_count integer not null default 1 check (day_count > 0),
  -- Hiking, Camping, Day trip... free text so groups can use their own words.
  category text,
  -- NULL = reusable preset; set = this camp's copy.
  event_id uuid references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A camp has at most one menu; presets are unconstrained.
create unique index idx_menus_one_per_event
  on public.menus (event_id) where event_id is not null;

create index idx_menus_presets on public.menus (category, day_count)
  where event_id is null;

-- ---------------------------------------------------------------------
-- MEALS within a menu
-- ---------------------------------------------------------------------
create table public.menu_meals (
  id uuid primary key default uuid_generate_v4(),
  menu_id uuid not null references public.menus(id) on delete cascade,
  day_number integer not null default 1 check (day_number > 0),
  -- Breakfast, Lunch, Dinner, Snack... free text with UI suggestions.
  meal_slot text not null default 'Breakfast',
  -- What's actually being cooked, e.g. "Chicken potjie with rice".
  name text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_menu_meals_menu on public.menu_meals (menu_id, day_number);

-- ---------------------------------------------------------------------
-- INGREDIENTS for a meal
-- ---------------------------------------------------------------------
create table public.menu_meal_items (
  id uuid primary key default uuid_generate_v4(),
  meal_id uuid not null references public.menu_meals(id) on delete cascade,
  food_item_id uuid not null references public.food_items(id) on delete cascade,
  quantity numeric not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  -- One row per ingredient per meal; adjust the quantity instead.
  unique (meal_id, food_item_id)
);

create index idx_menu_meal_items_meal on public.menu_meal_items (meal_id);

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------
create trigger trg_menus_updated_at before update on public.menus
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Apply a preset to an event: deep-copy and scale in one transaction.
--
-- SECURITY INVOKER (the default) on purpose - the caller's RLS applies to
-- every statement inside, so this can't be used to write rows the user
-- wouldn't be allowed to insert directly.
-- ---------------------------------------------------------------------
create or replace function public.apply_menu_preset(
  preset_id uuid,
  target_event_id uuid,
  target_headcount integer default null
)
returns uuid
language plpgsql
as $$
declare
  preset public.menus%rowtype;
  new_menu_id uuid;
  scale numeric;
  meal record;
  new_meal_id uuid;
begin
  select * into preset from public.menus where id = preset_id and event_id is null;
  if not found then
    raise exception 'Menu preset % not found', preset_id;
  end if;

  -- No headcount given means keep the preset's own quantities as-is.
  scale := coalesce(target_headcount, preset.serves)::numeric / preset.serves;

  -- A camp has one menu, so replace any existing one.
  delete from public.menus where event_id = target_event_id;

  insert into public.menus (name, description, serves, day_count, category, event_id)
  values (preset.name, preset.description,
          coalesce(target_headcount, preset.serves),
          preset.day_count, preset.category, target_event_id)
  returning id into new_menu_id;

  for meal in
    select * from public.menu_meals where menu_id = preset.id order by day_number, id
  loop
    insert into public.menu_meals (menu_id, day_number, meal_slot, name, notes)
    values (new_menu_id, meal.day_number, meal.meal_slot, meal.name, meal.notes)
    returning id into new_meal_id;

    insert into public.menu_meal_items (meal_id, food_item_id, quantity)
    select new_meal_id, food_item_id, round(quantity * scale, 3)
      from public.menu_meal_items where meal_id = meal.id;
  end loop;

  return new_menu_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Save a camp's menu back to the library as a reusable preset.
-- ---------------------------------------------------------------------
create or replace function public.save_menu_as_preset(
  source_menu_id uuid,
  preset_name text,
  preset_category text default null
)
returns uuid
language plpgsql
as $$
declare
  source public.menus%rowtype;
  new_menu_id uuid;
  meal record;
  new_meal_id uuid;
begin
  select * into source from public.menus where id = source_menu_id;
  if not found then
    raise exception 'Menu % not found', source_menu_id;
  end if;

  insert into public.menus (name, description, serves, day_count, category, event_id)
  values (preset_name, source.description, source.serves, source.day_count,
          coalesce(preset_category, source.category), null)
  returning id into new_menu_id;

  for meal in
    select * from public.menu_meals where menu_id = source.id order by day_number, id
  loop
    insert into public.menu_meals (menu_id, day_number, meal_slot, name, notes)
    values (new_menu_id, meal.day_number, meal.meal_slot, meal.name, meal.notes)
    returning id into new_meal_id;

    insert into public.menu_meal_items (meal_id, food_item_id, quantity)
    select new_meal_id, food_item_id, quantity
      from public.menu_meal_items where meal_id = meal.id;
  end loop;

  return new_menu_id;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS - same role model as everything else
-- ---------------------------------------------------------------------
alter table public.menus           enable row level security;
alter table public.menu_meals      enable row level security;
alter table public.menu_meal_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['menus','menu_meals','menu_meal_items']
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
               and public.current_role() in ('Admin','Manager','Member'));
    $f$, t);
  end loop;
end $$;

alter publication supabase_realtime add table public.menus;
alter publication supabase_realtime add table public.menu_meals;
alter publication supabase_realtime add table public.menu_meal_items;
