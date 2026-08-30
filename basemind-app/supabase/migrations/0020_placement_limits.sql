-- Two things wrong with placing kit, both of them the same shape: the
-- function did what it was told without checking whether it made sense.
--
-- 1. IT REPLACED RATHER THAN ADDED. "Put five of these in the box" set the
--    count to five. Putting one in, then one more, left one — so adding to a
--    box appeared to do nothing after the first time.
--
-- 2. NOTHING CHECKED THE TOTAL. You could put six tents in one room and four
--    in another while owning four, and the inventory would report both
--    without complaint. A store record that cheerfully holds more than
--    exists is worse than no record, because it is believed.
--
-- Both are fixed here rather than in the browser: the rule is about the data,
-- and a check that only exists in a form is a check that a second form will
-- not have.
create or replace function public.place_equipment(
  p_equipment_id uuid,
  p_box_id uuid,
  p_location text,
  p_quantity integer,
  -- true adds to what is already there, false sets it outright. Adding is
  -- what "put some in this box" means; setting is what the number beside a
  -- row in the box means.
  p_add boolean default false
)
returns void
language plpgsql
as $$
declare
  owned    integer;
  item     text;
  existing integer := 0;
  target   integer;
  elsewhere integer;
begin
  if (p_box_id is null) = (p_location is null) then
    raise exception 'A placement needs exactly one of a box or a room';
  end if;

  select quantity, name into owned, item
    from public.equipment where id = p_equipment_id;
  if not found then
    raise exception 'Equipment % not found', p_equipment_id;
  end if;

  -- How many are already in THIS place.
  select coalesce(sum(quantity), 0) into existing
    from public.equipment_placements
   where equipment_id = p_equipment_id
     and (p_box_id is not null and box_id = p_box_id
          or p_location is not null and lower(location) = lower(p_location));

  target := case when p_add then existing + p_quantity else p_quantity end;

  if target <= 0 then
    delete from public.equipment_placements
     where equipment_id = p_equipment_id
       and (p_box_id is not null and box_id = p_box_id
            or p_location is not null and lower(location) = lower(p_location));
    return;
  end if;

  -- Everything of this item that is filed anywhere else.
  select coalesce(sum(quantity), 0) into elsewhere
    from public.equipment_placements
   where equipment_id = p_equipment_id
     and not (p_box_id is not null and box_id = p_box_id
              or p_location is not null and lower(location) = lower(p_location));

  if elsewhere + target > owned then
    raise exception
      'Only % of % % not already placed somewhere else. Raise the quantity on the item first.',
      owned - elsewhere, owned, item
      using errcode = 'check_violation';
  end if;

  if p_box_id is not null then
    insert into public.equipment_placements (equipment_id, box_id, quantity)
    values (p_equipment_id, p_box_id, target)
    on conflict (equipment_id, box_id) where box_id is not null
    do update set quantity = excluded.quantity;
  else
    insert into public.equipment_placements (equipment_id, location, quantity)
    values (p_equipment_id, p_location, target)
    on conflict (equipment_id, lower(location)) where location is not null
    do update set quantity = excluded.quantity;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Reducing an item's total must not leave more placed than exists
--
-- Editing "4 tents" down to 2 while 4 are filed across two rooms would
-- otherwise leave the placements claiming four. Rather than refusing the
-- edit — the count is usually the thing being corrected — the placements are
-- trimmed, largest pile first, and the shortfall simply becomes unplaced.
-- ---------------------------------------------------------------------
create or replace function public.trim_placements_to_quantity()
returns trigger language plpgsql as $$
declare
  placed    integer;
  excess    integer;
  row_id    uuid;
  row_qty   integer;
begin
  if new.quantity >= old.quantity then
    return new;
  end if;

  select coalesce(sum(quantity), 0) into placed
    from public.equipment_placements where equipment_id = new.id;

  excess := placed - new.quantity;
  if excess <= 0 then
    return new;
  end if;

  for row_id, row_qty in
    select id, quantity from public.equipment_placements
     where equipment_id = new.id
     order by quantity desc, id
  loop
    exit when excess <= 0;
    if row_qty <= excess then
      delete from public.equipment_placements where id = row_id;
      excess := excess - row_qty;
    else
      update public.equipment_placements
         set quantity = row_qty - excess where id = row_id;
      excess := 0;
    end if;
  end loop;

  return new;
end;
$$;

create trigger trg_trim_placements
  after update of quantity on public.equipment
  for each row execute function public.trim_placements_to_quantity();

-- ---------------------------------------------------------------------
-- Keep a fault and the item's condition in step
--
-- They were two separate records of the same fact and nothing tied them
-- together: reporting a split axe handle left the axe reading "Good", and
-- marking an axe Broken left Repairs empty. Whichever screen you were on
-- told you the other one was wrong.
--
-- Triggers rather than application code on purpose. There are now several
-- ways to change a condition — the edit form, the check dialog, Here/Missing
-- in a box — and a rule enforced in one of them is a rule the other three
-- quietly break.
-- ---------------------------------------------------------------------
create or replace function public.sync_condition_on_fault()
returns trigger language plpgsql as $$
begin
  -- A newly reported fault means the thing is broken, unless somebody has
  -- already said something more specific than "Good".
  if tg_op = 'INSERT' then
    update public.equipment
       set condition = 'Broken'
     where id = new.equipment_id
       and condition = 'Good';
    return new;
  end if;

  -- Closing one. If anything is still open on that item, its condition is
  -- still the truth and must not be cleared.
  if new.resolved_on is not null and old.resolved_on is null then
    if not exists (
      select 1 from public.equipment_faults
       where equipment_id = new.equipment_id
         and resolved_on is null
         and id <> new.id
    ) then
      -- Retired means gone rather than fixed, so it stays broken: the row
      -- is still in the inventory and should not read as serviceable.
      if coalesce(new.resolution, '') <> 'Retired' then
        update public.equipment
           set condition = 'Good'
         where id = new.equipment_id
           and condition in ('Broken', 'Needs Repair');
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_fault_sets_condition
  after insert on public.equipment_faults
  for each row execute function public.sync_condition_on_fault();

create trigger trg_fault_clears_condition
  after update of resolved_on on public.equipment_faults
  for each row execute function public.sync_condition_on_fault();
