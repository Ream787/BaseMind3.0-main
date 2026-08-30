-- Rooms hold storage places, and storage places hold each other.
--
-- "Box" was too narrow the moment somebody had a shelf. A store is boxes,
-- shelves, cupboards, crates and the trailer, and a cupboard has shelves in
-- it — so this stops being a flat list of boxes per room and becomes a tree
-- under each room.
--
-- The table is renamed rather than replaced: the QR stickers already printed
-- carry codes in it, and the loans, placements and packing lists point at it.
-- A rename keeps every one of those working.

alter table public.equipment_boxes rename to storage_places;

-- ---------------------------------------------------------------------
-- What kind of thing it is
--
-- Free text with a default rather than an enum. Groups have hanging racks,
-- ammo cans, pigeonholes and "the corner behind the door", and a fixed list
-- would send all of those to Other, which tells nobody anything.
-- ---------------------------------------------------------------------
alter index idx_equipment_boxes_code rename to idx_storage_places_code;
alter index idx_equipment_boxes_location rename to idx_storage_places_location;

alter table public.storage_places
  add column kind text not null default 'Box';

-- ---------------------------------------------------------------------
-- What it sits inside
--
-- Null means it sits directly in the room. ON DELETE CASCADE so removing a
-- cupboard removes its shelves — what happens to the KIT in them is decided
-- by delete_storage_place below, which empties the whole subtree into the
-- room first.
-- ---------------------------------------------------------------------
alter table public.storage_places
  add column parent_id uuid references public.storage_places(id) on delete cascade;

create index idx_storage_parent on public.storage_places (parent_id)
  where parent_id is not null;

-- ---------------------------------------------------------------------
-- The room a place is in is the room its root is in
--
-- `location` stays on every row so everything else can just read it, but for
-- a nested place it is derived, never chosen: a shelf inside a cupboard is
-- wherever the cupboard is, and letting the two disagree would mean kit that
-- is in two rooms at once.
-- ---------------------------------------------------------------------
create or replace function public.storage_inherits_room()
returns trigger language plpgsql as $$
declare
  parent_room text;
  depth integer := 0;
  walker uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A storage place cannot be inside itself';
  end if;

  -- Walk up to the root: proves there is no cycle, finds the room, and
  -- enforces the depth limit. Five levels is deep enough for a trailer
  -- holding a crate holding a box, and shallow enough that nobody loses
  -- anything. Counting ANCESTORS, so four of them is the fifth level.
  walker := new.parent_id;
  while walker is not null loop
    depth := depth + 1;
    if depth > 4 then
      raise exception 'Storage places can only be nested 5 deep';
    end if;
    if walker = new.id then
      raise exception 'That would put a storage place inside itself';
    end if;
    select parent_id, location into walker, parent_room
      from public.storage_places where id = walker;
  end loop;

  new.location := parent_room;
  return new;
end;
$$;

create trigger trg_storage_inherits_room
  before insert or update of parent_id, location on public.storage_places
  for each row execute function public.storage_inherits_room();

-- Moving a cupboard to another room takes its shelves with it.
create or replace function public.storage_moves_children()
returns trigger language plpgsql as $$
begin
  if new.location is distinct from old.location then
    update public.storage_places
       set location = new.location
     where parent_id = new.id;
  end if;
  return new;
end;
$$;

-- Deliberately not "after update OF location": that fires on the columns the
-- UPDATE names, and the room usually changes because the trigger above
-- derived it from a new parent_id, not because anybody set it. Moving a
-- cupboard into another room would have left its shelves behind. The
-- is-distinct-from check inside makes firing on every update cheap.
create trigger trg_storage_moves_children
  after update on public.storage_places
  for each row execute function public.storage_moves_children();

-- ---------------------------------------------------------------------
-- Placements point at a storage place, not specifically a box
-- ---------------------------------------------------------------------
alter table public.equipment_placements rename column box_id to storage_id;
alter index idx_placement_one_per_box rename to idx_placement_one_per_storage;
alter index idx_placement_box rename to idx_placement_storage;
alter table public.equipment_placements
  rename constraint placement_is_box_or_room to placement_is_storage_or_room;

-- ---------------------------------------------------------------------
-- place_equipment, in the new vocabulary
-- ---------------------------------------------------------------------
-- Both old signatures go. 0020 added the p_add argument with a default,
-- which created a SECOND overload rather than replacing the first — so the
-- original four-argument version, the one with no limit checking in it, was
-- still sitting there answering calls that happened to omit p_add.
drop function if exists public.place_equipment(uuid, uuid, text, integer);
drop function if exists public.place_equipment(uuid, uuid, text, integer, boolean);

create or replace function public.place_equipment(
  p_equipment_id uuid,
  p_storage_id uuid,
  p_location text,
  p_quantity integer,
  p_add boolean default false
)
returns void
language plpgsql
as $$
declare
  owned     integer;
  item      text;
  existing  integer := 0;
  target    integer;
  elsewhere integer;
begin
  if (p_storage_id is null) = (p_location is null) then
    raise exception 'A placement needs exactly one of a storage place or a room';
  end if;

  select quantity, name into owned, item
    from public.equipment where id = p_equipment_id;
  if not found then
    raise exception 'Equipment % not found', p_equipment_id;
  end if;

  select coalesce(sum(quantity), 0) into existing
    from public.equipment_placements
   where equipment_id = p_equipment_id
     and (p_storage_id is not null and storage_id = p_storage_id
          or p_location is not null and lower(location) = lower(p_location));

  target := case when p_add then existing + p_quantity else p_quantity end;

  if target <= 0 then
    delete from public.equipment_placements
     where equipment_id = p_equipment_id
       and (p_storage_id is not null and storage_id = p_storage_id
            or p_location is not null and lower(location) = lower(p_location));
    return;
  end if;

  select coalesce(sum(quantity), 0) into elsewhere
    from public.equipment_placements
   where equipment_id = p_equipment_id
     and not (p_storage_id is not null and storage_id = p_storage_id
              or p_location is not null and lower(location) = lower(p_location));

  if elsewhere + target > owned then
    raise exception
      'Only % of % % not already placed somewhere else. Raise the quantity on the item first.',
      owned - elsewhere, owned, item
      using errcode = 'check_violation';
  end if;

  if p_storage_id is not null then
    insert into public.equipment_placements (equipment_id, storage_id, quantity)
    values (p_equipment_id, p_storage_id, target)
    on conflict (equipment_id, storage_id) where storage_id is not null
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
-- Removing a storage place empties the whole subtree into the room
--
-- A cupboard's shelves cascade away with it, and their placements with them,
-- so without this the kit on those shelves would silently stop being
-- anywhere. Everything in the subtree is tipped out into the room the
-- cupboard was in, which is where it physically is once the cupboard goes.
-- ---------------------------------------------------------------------
drop function if exists public.delete_equipment_box(uuid, boolean);

create or replace function public.delete_storage_place(
  p_storage_id uuid,
  p_keep_contents boolean default true
)
returns void
language plpgsql
as $$
declare
  place public.storage_places%rowtype;
  item  record;
begin
  select * into place from public.storage_places where id = p_storage_id;
  if not found then
    raise exception 'Storage place % not found', p_storage_id;
  end if;

  if p_keep_contents then
    for item in
      with recursive subtree as (
        select id from public.storage_places where id = p_storage_id
        union all
        select s.id from public.storage_places s
          join subtree t on s.parent_id = t.id
      )
      select p.equipment_id, sum(p.quantity) as quantity
        from public.equipment_placements p
        join subtree t on p.storage_id = t.id
       group by p.equipment_id
    loop
      insert into public.equipment_placements (equipment_id, location, quantity)
      values (item.equipment_id, place.location, item.quantity)
      on conflict (equipment_id, lower(location)) where location is not null
      do update set quantity = public.equipment_placements.quantity + excluded.quantity;
    end loop;
  end if;

  delete from public.storage_places where id = p_storage_id;
end;
$$;

-- ---------------------------------------------------------------------
-- merge_equipment folds placements; it named the old column
-- ---------------------------------------------------------------------
create or replace function public.merge_equipment(keep_id uuid, drop_id uuid)
returns void
language plpgsql
as $$
declare
  keeper  public.equipment%rowtype;
  dropped public.equipment%rowtype;
begin
  if keep_id = drop_id then
    raise exception 'Cannot merge an item into itself';
  end if;

  select * into keeper from public.equipment where id = keep_id;
  if not found then
    raise exception 'Equipment % not found', keep_id;
  end if;

  select * into dropped from public.equipment where id = drop_id;
  if not found then
    raise exception 'Equipment % not found', drop_id;
  end if;

  update public.equipment_loans set equipment_id = keep_id where equipment_id = drop_id;

  update public.event_equipment ee
     set quantity = ee.quantity + dup.quantity
    from public.event_equipment dup
   where ee.equipment_id = keep_id
     and dup.equipment_id = drop_id
     and dup.event_id = ee.event_id;

  delete from public.event_equipment
   where equipment_id = drop_id
     and event_id in (
       select event_id from public.event_equipment where equipment_id = keep_id
     );

  update public.event_equipment set equipment_id = keep_id where equipment_id = drop_id;

  update public.equipment_placements p
     set quantity = p.quantity + dup.quantity
    from public.equipment_placements dup
   where p.equipment_id = keep_id
     and dup.equipment_id = drop_id
     and (p.storage_id is not null and p.storage_id = dup.storage_id
          or p.location is not null and lower(p.location) = lower(dup.location));

  delete from public.equipment_placements dup
   where dup.equipment_id = drop_id
     and exists (
       select 1 from public.equipment_placements p
        where p.equipment_id = keep_id
          and (p.storage_id is not null and p.storage_id = dup.storage_id
               or p.location is not null and lower(p.location) = lower(dup.location))
     );

  update public.equipment_placements set equipment_id = keep_id where equipment_id = drop_id;

  update public.equipment
     set quantity = keeper.quantity + dropped.quantity,
         notes = case
           when dropped.notes is null or btrim(dropped.notes) = '' then keeper.notes
           when keeper.notes  is null or btrim(keeper.notes)  = '' then dropped.notes
           when btrim(keeper.notes) = btrim(dropped.notes)         then keeper.notes
           else keeper.notes || chr(10) || dropped.notes
         end,
         condition = case
           when 'Broken'       in (keeper.condition, dropped.condition) then 'Broken'
           when 'Missing'      in (keeper.condition, dropped.condition) then 'Missing'
           when 'Needs Repair' in (keeper.condition, dropped.condition) then 'Needs Repair'
           else keeper.condition
         end,
         date_last_checked = case
           when keeper.date_last_checked is null or dropped.date_last_checked is null then null
           else least(keeper.date_last_checked, dropped.date_last_checked)
         end,
         checked_by = case
           when keeper.date_last_checked is null or dropped.date_last_checked is null then null
           when dropped.date_last_checked < keeper.date_last_checked then dropped.checked_by
           else keeper.checked_by
         end,
         next_check_date = least(keeper.next_check_date, dropped.next_check_date)
   where id = keep_id;

  delete from public.equipment where id = drop_id;
end;
$$;
