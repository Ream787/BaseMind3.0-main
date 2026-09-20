-- Three ways the counts stopped adding up, and one that hid it.
--
-- Found by testing the live site on 17 Sep 2026. Barrels read 42 owned with
-- 48 filed in Room 5, and Tents 5 owned with 7 filed across three rooms. An
-- inventory that claims more than exists is worse than no inventory, because
-- somebody packs from it.
--
-- Everything here is written to be safe to run whether or not 0020 reached
-- this database — the evidence says it did not, since lowering a quantity
-- left the placements untouched and reporting a fault left the item reading
-- "Good". So the triggers are dropped and recreated rather than assumed.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 1. One place to take a surplus off
--
-- Whatever is filed beyond what the group owns is a phantom, and the honest
-- thing is to take it off the vaguest record first: a loose pile in a room is
-- a guess, while "six in this box" is something somebody counted. So loose
-- room piles go first, largest first, then places.
--
-- p_protect is the place somebody has just counted into. Trimming what they
-- have this second told us is true would be answering a fact with a guess.
-- ---------------------------------------------------------------------
create or replace function public.trim_placements(
  p_equipment_id uuid,
  p_protect uuid default null
)
returns integer
language plpgsql
as $$
declare
  owned   integer;
  placed  integer;
  surplus integer;
  row_id  uuid;
  row_qty integer;
  take    integer;
  trimmed integer := 0;
begin
  select quantity into owned from public.equipment where id = p_equipment_id;
  if not found then return 0; end if;

  select coalesce(sum(quantity), 0) into placed
    from public.equipment_placements where equipment_id = p_equipment_id;

  surplus := placed - owned;
  if surplus <= 0 then return 0; end if;

  for row_id, row_qty in
    select id, quantity
      from public.equipment_placements
     where equipment_id = p_equipment_id
       and (p_protect is null or id <> p_protect)
     -- Loose room piles before places, biggest before smallest.
     order by (location is not null) desc, quantity desc, id
  loop
    exit when surplus <= 0;
    take := least(row_qty, surplus);
    if take >= row_qty then
      delete from public.equipment_placements where id = row_id;
    else
      update public.equipment_placements
         set quantity = quantity - take
       where id = row_id;
    end if;
    surplus := surplus - take;
    trimmed := trimmed + take;
  end loop;

  return trimmed;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. Lowering the quantity trims what is filed
--
-- Editing "5 lanterns" down to 2 while 5 are filed in a room left the room
-- claiming five. The count is usually the thing being corrected, so the edit
-- goes through and the placements follow it down rather than the edit being
-- refused.
-- ---------------------------------------------------------------------
create or replace function public.trim_placements_to_quantity()
returns trigger language plpgsql as $$
begin
  if new.quantity < old.quantity then
    perform public.trim_placements(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_trim_placements on public.equipment;
create trigger trg_trim_placements
  after update of quantity on public.equipment
  for each row execute function public.trim_placements_to_quantity();


-- ---------------------------------------------------------------------
-- 3. Putting something away counts it where it is
--
-- The old version decided that anything beyond the owned total was a second
-- record of the same kit and simply dropped the units being stowed. With the
-- real Tents — five owned, seven filed — putting one in a box took it off the
-- room, never added it to the box, and reported success. A tent left the
-- records entirely on a button that said it had been filed.
--
-- What somebody has just counted into a place is the best fact available, so
-- it is recorded first and the surplus comes off everything else. If the
-- place alone would hold more than the group owns, that is the quantity being
-- wrong rather than a surplus to shuffle, and it says so.
-- ---------------------------------------------------------------------
drop function if exists public.stow_equipment(uuid, uuid, integer);

create function public.stow_equipment(
  p_equipment_id uuid,
  p_storage_id uuid,
  p_quantity integer
)
returns jsonb
language plpgsql
as $$
declare
  room      text;
  item      text;
  owned     integer;
  loose     integer;
  taken     integer;
  existing  integer;
  place_id  uuid;
  trimmed   integer;
  placed    integer;
begin
  if p_quantity <= 0 then
    raise exception 'Stow at least one';
  end if;

  select location into room from public.storage_places where id = p_storage_id;
  if not found then
    raise exception 'Storage place % not found', p_storage_id;
  end if;

  select quantity, name into owned, item
    from public.equipment where id = p_equipment_id;
  if not found then
    raise exception 'Equipment % not found', p_equipment_id;
  end if;

  -- What is lying loose in the room this place stands in. Only that room:
  -- kit loose somewhere else is somewhere else, and moving it silently would
  -- be inventing a fact rather than recording one.
  select coalesce(sum(quantity), 0) into loose
    from public.equipment_placements
   where equipment_id = p_equipment_id
     and location is not null
     and lower(location) = lower(room);

  taken := least(loose, p_quantity);
  if taken > 0 then
    if loose - taken <= 0 then
      delete from public.equipment_placements
       where equipment_id = p_equipment_id
         and location is not null
         and lower(location) = lower(room);
    else
      update public.equipment_placements
         set quantity = loose - taken
       where equipment_id = p_equipment_id
         and location is not null
         and lower(location) = lower(room);
    end if;
  end if;

  select coalesce(sum(quantity), 0) into existing
    from public.equipment_placements
   where equipment_id = p_equipment_id and storage_id = p_storage_id;

  insert into public.equipment_placements (equipment_id, storage_id, quantity)
  values (p_equipment_id, p_storage_id, existing + p_quantity)
  on conflict (equipment_id, storage_id) where storage_id is not null
  do update set quantity = excluded.quantity
  returning id into place_id;

  -- Anything still over the owned total was already a phantom somewhere else.
  trimmed := public.trim_placements(p_equipment_id, place_id);

  select coalesce(sum(quantity), 0) into placed
    from public.equipment_placements where equipment_id = p_equipment_id;

  if placed > owned then
    raise exception
      'That would put % of % in this place, and the group owns %. Raise the quantity on the item first.',
      existing + p_quantity, item, owned
      using errcode = 'check_violation';
  end if;

  return jsonb_build_object(
    'moved', taken,
    'added', p_quantity,
    'trimmed', coalesce(trimmed, 0)
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 4. A fault and the item's condition, in step — and writing one off
--
-- Reporting a split handle left the axe reading "Good", and "Written off"
-- closed the fault while leaving every one of them in the inventory, so
-- Repairs immediately listed it again as "not in good condition, with
-- nothing written down about why". You could write the same tent off all
-- afternoon and still own it.
--
-- Retiring now removes the units it was reported against. What is left is
-- serviceable, so the condition clears with it; if nothing is left the row
-- stays at zero rather than vanishing, because the fault history is worth
-- more than a tidy list and somebody may want to delete it deliberately.
-- ---------------------------------------------------------------------
create or replace function public.sync_condition_on_fault()
returns trigger language plpgsql as $$
declare
  left_over integer;
begin
  if tg_op = 'INSERT' then
    update public.equipment
       set condition = 'Broken'
     where id = new.equipment_id
       and condition = 'Good';
    return new;
  end if;

  if new.resolved_on is null or old.resolved_on is not null then
    return new;
  end if;

  if coalesce(new.resolution, '') = 'Retired' then
    update public.equipment
       set quantity = greatest(quantity - new.quantity, 0)
     where id = new.equipment_id
    returning quantity into left_over;
    -- The trim trigger has already followed the quantity down.
  end if;

  -- Whatever is still open on that item is still the truth.
  if exists (
    select 1 from public.equipment_faults
     where equipment_id = new.equipment_id
       and resolved_on is null
       and id <> new.id
  ) then
    return new;
  end if;

  update public.equipment
     set condition = 'Good'
   where id = new.equipment_id
     and condition in ('Broken', 'Needs Repair', 'Missing')
     and (left_over is null or left_over > 0);

  return new;
end;
$$;

drop trigger if exists trg_fault_sets_condition on public.equipment_faults;
create trigger trg_fault_sets_condition
  after insert on public.equipment_faults
  for each row execute function public.sync_condition_on_fault();

drop trigger if exists trg_fault_clears_condition on public.equipment_faults;
create trigger trg_fault_clears_condition
  after update of resolved_on on public.equipment_faults
  for each row execute function public.sync_condition_on_fault();


-- ---------------------------------------------------------------------
-- 5. A saved menu is as long as its meals
--
-- Saving a camp menu to the library copied the length it was written as, so
-- a menu with a meal on day 3 could sit in the library labelled "2 days" —
-- and the length filter then filed it under the wrong number.
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
  source      public.menus%rowtype;
  new_menu_id uuid;
  meal        record;
  new_meal_id uuid;
  days        integer;
begin
  select * into source from public.menus where id = source_menu_id;
  if not found then
    raise exception 'Menu % not found', source_menu_id;
  end if;

  select greatest(coalesce(max(day_number), 1), source.day_count) into days
    from public.menu_meals where menu_id = source.id;

  insert into public.menus (name, description, serves, day_count, category, event_id)
  values (preset_name, source.description, source.serves, coalesce(days, source.day_count),
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

-- Menus already in the library that are longer than they say they are.
update public.menus m
   set day_count = sub.days
  from (
    select menu_id, max(day_number) as days
      from public.menu_meals group by menu_id
  ) sub
 where sub.menu_id = m.id and sub.days > m.day_count;


-- ---------------------------------------------------------------------
-- 6. Straighten out what is already filed
--
-- Barrels and Tents are over-filed today. Trimming them here means the first
-- person to put one in a box is not the one who discovers it.
-- ---------------------------------------------------------------------
do $$
declare
  id_row uuid;
begin
  for id_row in
    select e.id
      from public.equipment e
      join public.equipment_placements p on p.equipment_id = e.id
     group by e.id, e.quantity
    having coalesce(sum(p.quantity), 0) > e.quantity
  loop
    perform public.trim_placements(id_row);
  end loop;
end;
$$;
