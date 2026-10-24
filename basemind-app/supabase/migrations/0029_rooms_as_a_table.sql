-- ---------------------------------------------------------------------
-- A room is a thing, not a spelling
--
-- A room used to be a string, typed into three separate columns:
-- equipment.location, equipment_placements.location and
-- storage_places.location. Nothing joined them up. They were compared as
-- lower(location) = lower(...) in every function that cared, kept unique
-- by a functional index on lower(location), and passed between functions
-- as text. Renaming "Room 5" meant three UPDATEs and hoping; one typo
-- invented a sixth room, which is why this app grew a cleanup tool whose
-- whole job was finding rooms that differed only by capitals.
--
-- public.rooms now holds each room once. Everything points at it by id,
-- so a rename is one UPDATE and "room 5" cannot coexist with "Room 5".
--
-- equipment.location goes entirely. It duplicated what placements
-- already said, and could only ever name one room for kit that is split
-- between two. Where the placements did not add up to the quantity
-- owned, the shortfall is filed as loose in the room the column named,
-- so nothing it recorded is lost.
--
-- WRITTEN IDEMPOTENTLY ON PURPOSE. Each group runs its own database and
-- they are not all at the same migration, and the 14th Delport database
-- already had the rooms half of this applied directly on 2026-10-19
-- (recorded there as `rooms_as_a_table`). The guards below mean this file
-- can be run against a database that has some, none, or all of it —
-- including that one, where it serves to pick up the stow_equipment
-- change at the end, which it never received.
-- ---------------------------------------------------------------------

create table if not exists public.rooms (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  notes      text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_name_not_blank check (btrim(name) <> '')
);

comment on table public.rooms is
  'Fixed places in the building that kit lives in - rooms, the hall store, the den. One row per room; equipment placements and storage places point here by id.';

-- Case- and space-insensitive, which is what the old lower(location)
-- comparisons were reaching for with nowhere to put the rule.
create unique index if not exists idx_rooms_name on public.rooms (lower(btrim(name)));
create index if not exists idx_rooms_order on public.rooms (sort_order, name);

drop trigger if exists trg_rooms_updated_at on public.rooms;
create trigger trg_rooms_updated_at before update on public.rooms
  for each row execute function public.set_updated_at();

alter table public.rooms enable row level security;

drop policy if exists rooms_select on public.rooms;
drop policy if exists rooms_insert on public.rooms;
drop policy if exists rooms_update on public.rooms;
drop policy if exists rooms_delete on public.rooms;

-- The same ladder as equipment and storage_places.
create policy rooms_select on public.rooms for select
  using (public.is_active_user());
create policy rooms_insert on public.rooms for insert
  with check (public.is_active_user() and public.current_role() in ('Admin','Manager','Member'));
create policy rooms_update on public.rooms for update
  using (public.is_active_user() and public.current_role() in ('Admin','Manager','Member'))
  with check (public.is_active_user() and public.current_role() in ('Admin','Manager','Member'));
create policy rooms_delete on public.rooms for delete
  using (public.is_active_user() and public.current_role() in ('Admin','Manager'));

do $realtime$
begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null;
end $realtime$;

-- ---------------------------------------------------------------------
-- Every room anybody ever typed, once each. min() settles it where the
-- same room was spelled two ways.
-- ---------------------------------------------------------------------
do $backfill$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'equipment' and column_name = 'location'
  ) then
    insert into public.rooms (name)
    select min(btrim(name))
    from (
      select location as name from public.equipment            where location is not null
      union all
      select location         from public.equipment_placements where location is not null
      union all
      select location         from public.storage_places       where location is not null
    ) typed
    where btrim(name) <> ''
    group by lower(btrim(name))
    on conflict do nothing;
  end if;
end $backfill$;

-- ---------------------------------------------------------------------
-- The foreign keys. on delete restrict: emptying a room is a decision
-- somebody makes, not a side effect of deleting the room.
-- ---------------------------------------------------------------------
alter table public.equipment_placements
  add column if not exists room_id uuid references public.rooms(id) on delete restrict;
alter table public.storage_places
  add column if not exists room_id uuid references public.rooms(id) on delete restrict;

do $wire$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'equipment' and column_name = 'location'
  ) then
    -- What equipment.location was saying, kept before the column goes:
    -- file the shortfall between owned and placed as loose in that room.
    -- Done through the old text column while its unique index still
    -- governs. Items placed in MORE than they own have a negative
    -- shortfall and are left exactly as they are.
    insert into public.equipment_placements (equipment_id, location, quantity)
    select e.id, e.location, e.quantity - coalesce(p.placed, 0)
      from public.equipment e
      left join (
        select equipment_id, sum(quantity) as placed
          from public.equipment_placements group by equipment_id
      ) p on p.equipment_id = e.id
     where e.location is not null
       and btrim(e.location) <> ''
       and e.quantity - coalesce(p.placed, 0) > 0
    on conflict (equipment_id, lower(location)) where location is not null
    do update set quantity = public.equipment_placements.quantity + excluded.quantity;

    update public.equipment_placements p
       set room_id = r.id
      from public.rooms r
     where p.location is not null
       and p.room_id is null
       and lower(btrim(p.location)) = lower(btrim(r.name));

    update public.storage_places s
       set room_id = r.id
      from public.rooms r
     where s.room_id is null
       and lower(btrim(s.location)) = lower(btrim(r.name));

    -- Nothing may be stranded: a placement naming a room, or any storage
    -- place, without a room_id means the backfill missed a spelling.
    if exists (
      select 1 from public.equipment_placements
       where location is not null and room_id is null
    ) then
      raise exception 'rooms backfill left placements with a room name but no room_id';
    end if;
    if exists (select 1 from public.storage_places where room_id is null) then
      raise exception 'rooms backfill left storage places with no room_id';
    end if;

    -- Out with the text. The index, the check and the trigger name these
    -- columns, so Postgres refuses the drop until they go; the check and
    -- the trigger come back below against room_id.
    drop index if exists public.idx_placement_one_per_room;
    drop index if exists public.idx_storage_places_location;
    alter table public.equipment_placements drop constraint if exists placement_is_storage_or_room;
    drop trigger if exists trg_storage_inherits_room on public.storage_places;

    alter table public.equipment_placements drop column location;
    alter table public.storage_places       drop column location;
    alter table public.equipment            drop column location;
  end if;
end $wire$;

-- A storage place stands in a room. The old column said so with NOT NULL
-- and a default of the literal string 'Unassigned'; this says it without
-- inventing a room called Unassigned to do it.
alter table public.storage_places alter column room_id set not null;

alter table public.equipment_placements drop constraint if exists placement_is_storage_or_room;
alter table public.equipment_placements
  add constraint placement_is_storage_or_room
  check ((storage_id is null) <> (room_id is null));

create unique index if not exists idx_placement_one_per_room
  on public.equipment_placements (equipment_id, room_id) where room_id is not null;
create index if not exists idx_placement_room
  on public.equipment_placements (room_id) where room_id is not null;
create index if not exists idx_storage_places_room on public.storage_places (room_id);

comment on column public.equipment_placements.room_id is
  'The room this kit is loose in. Exactly one of room_id and storage_id is set.';
comment on column public.storage_places.room_id is
  'The room this box/cupboard/trailer stands in. A nested place inherits the room of its parent.';

-- ---------------------------------------------------------------------
-- The functions, now that a room has an id.
--
-- Each also gains `set search_path = public`, which the Supabase linter
-- flags across this database.
-- ---------------------------------------------------------------------

drop function if exists public.place_equipment(uuid, uuid, text, integer, boolean);
drop function if exists public.place_equipment(uuid, uuid, uuid, integer, boolean);

create function public.place_equipment(
  p_equipment_id uuid,
  p_storage_id   uuid,
  p_room_id      uuid,
  p_quantity     integer,
  p_add          boolean default false
) returns void language plpgsql set search_path = public as $fn$
declare
  owned     integer;
  item      text;
  existing  integer := 0;
  target    integer;
  elsewhere integer;
begin
  if (p_storage_id is null) = (p_room_id is null) then
    raise exception 'A placement needs exactly one of a storage place or a room';
  end if;

  select quantity, name into owned, item
    from public.equipment where id = p_equipment_id;
  if not found then
    raise exception 'Equipment % not found', p_equipment_id;
  end if;

  if p_room_id is not null
     and not exists (select 1 from public.rooms where id = p_room_id) then
    raise exception 'Room % not found', p_room_id;
  end if;

  -- Matching on ids, so two spellings of one room can no longer count as
  -- two places. coalesce stops a NULL comparison turning the whole
  -- predicate into "unknown".
  select coalesce(sum(quantity), 0) into existing
    from public.equipment_placements
   where equipment_id = p_equipment_id
     and (coalesce(storage_id = p_storage_id, false)
          or coalesce(room_id = p_room_id, false));

  target := case when p_add then existing + p_quantity else p_quantity end;

  if target <= 0 then
    delete from public.equipment_placements
     where equipment_id = p_equipment_id
       and (coalesce(storage_id = p_storage_id, false)
            or coalesce(room_id = p_room_id, false));
    return;
  end if;

  select coalesce(sum(quantity), 0) into elsewhere
    from public.equipment_placements
   where equipment_id = p_equipment_id
     and not (coalesce(storage_id = p_storage_id, false)
              or coalesce(room_id = p_room_id, false));

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
    insert into public.equipment_placements (equipment_id, room_id, quantity)
    values (p_equipment_id, p_room_id, target)
    on conflict (equipment_id, room_id) where room_id is not null
    do update set quantity = excluded.quantity;
  end if;
end;
$fn$;

-- stow_equipment keeps 0028's shape and its jsonb report. Worth noting:
-- the 14th Delport database never received that version and still had the
-- older void-returning one, so the app has been reading `moved`, `added`
-- and `trimmed` off nothing there. Running this file fixes that too.
drop function if exists public.stow_equipment(uuid, uuid, integer);

create function public.stow_equipment(
  p_equipment_id uuid,
  p_storage_id   uuid,
  p_quantity     integer
) returns jsonb language plpgsql set search_path = public as $fn$
declare
  room      uuid;
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

  select room_id into room from public.storage_places where id = p_storage_id;
  if not found then
    raise exception 'Storage place % not found', p_storage_id;
  end if;

  select quantity, name into owned, item
    from public.equipment where id = p_equipment_id;
  if not found then
    raise exception 'Equipment % not found', p_equipment_id;
  end if;

  -- What is lying loose in the room this place stands in. Only that room:
  -- kit loose somewhere else is somewhere else, and moving it silently
  -- would be inventing a fact rather than recording one.
  select coalesce(sum(quantity), 0) into loose
    from public.equipment_placements
   where equipment_id = p_equipment_id
     and room_id = room;

  taken := least(loose, p_quantity);
  if taken > 0 then
    if loose - taken <= 0 then
      delete from public.equipment_placements
       where equipment_id = p_equipment_id
         and room_id = room;
    else
      update public.equipment_placements
         set quantity = loose - taken
       where equipment_id = p_equipment_id
         and room_id = room;
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

  -- Anything still over the owned total was already a phantom elsewhere.
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
$fn$;

create or replace function public.delete_storage_place(
  p_storage_id    uuid,
  p_keep_contents boolean default true
) returns void language plpgsql set search_path = public as $fn$
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
      -- Tipped out into the room the place stood in.
      insert into public.equipment_placements (equipment_id, room_id, quantity)
      values (item.equipment_id, place.room_id, item.quantity)
      on conflict (equipment_id, room_id) where room_id is not null
      do update set quantity = public.equipment_placements.quantity + excluded.quantity;
    end loop;
  end if;

  delete from public.storage_places where id = p_storage_id;
end;
$fn$;

create or replace function public.storage_inherits_room()
returns trigger language plpgsql set search_path = public as $fn$
declare
  parent_room uuid;
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
    select parent_id, room_id into walker, parent_room
      from public.storage_places where id = walker;
  end loop;

  new.room_id := parent_room;
  return new;
end;
$fn$;

-- Watching room_id now. A trigger declared UPDATE OF <column> depends on
-- that column by name, which is why it had to be dropped above.
drop trigger if exists trg_storage_inherits_room on public.storage_places;
create trigger trg_storage_inherits_room
  before insert or update of parent_id, room_id on public.storage_places
  for each row execute function public.storage_inherits_room();

create or replace function public.storage_moves_children()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if new.room_id is distinct from old.room_id then
    update public.storage_places
       set room_id = new.room_id
     where parent_id = new.id;
  end if;
  return new;
end;
$fn$;

create or replace function public.trim_placements(
  p_equipment_id uuid,
  p_protect      uuid default null
) returns integer language plpgsql set search_path = public as $fn$
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

  -- Loose piles go first: kit somebody deliberately filed in a box is the
  -- more considered record of where it is.
  for row_id, row_qty in
    select id, quantity
      from public.equipment_placements
     where equipment_id = p_equipment_id
       and (p_protect is null or id <> p_protect)
     order by (room_id is not null) desc, quantity desc, id
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
$fn$;

create or replace function public.merge_equipment(keep_id uuid, drop_id uuid)
returns void language plpgsql set search_path = public as $fn$
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

  -- Two placements are the same place when they are the same storage
  -- place or the same room. Same-room used to mean comparing two strings
  -- with lower() and hoping.
  update public.equipment_placements p
     set quantity = p.quantity + dup.quantity
    from public.equipment_placements dup
   where p.equipment_id = keep_id
     and dup.equipment_id = drop_id
     and (p.storage_id is not null and p.storage_id = dup.storage_id
          or p.room_id is not null and p.room_id = dup.room_id);

  delete from public.equipment_placements dup
   where dup.equipment_id = drop_id
     and exists (
       select 1 from public.equipment_placements p
        where p.equipment_id = keep_id
          and (p.storage_id is not null and p.storage_id = dup.storage_id
               or p.room_id is not null and p.room_id = dup.room_id)
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
$fn$;

-- ---------------------------------------------------------------------
-- Reading it back
--
-- "Which room is this item in" is a question about placements now: loose
-- in a room, or in a place standing in one. Unlike the old column this
-- can answer "some in Room 5, some in the hall store", which is the
-- truth for kit that is split up.
--
-- security_invoker so the caller's RLS applies, not the view owner's.
-- ---------------------------------------------------------------------
drop view if exists public.equipment_rooms;
create view public.equipment_rooms with (security_invoker = on) as
select p.equipment_id,
       r.id   as room_id,
       r.name as room_name,
       sum(p.quantity) as quantity
  from public.equipment_placements p
  left join public.storage_places s on s.id = p.storage_id
  join public.rooms r on r.id = coalesce(p.room_id, s.room_id)
 group by p.equipment_id, r.id, r.name;

comment on view public.equipment_rooms is
  'Which rooms each item is in and how many are there, counting both loose placements and the contents of storage places.';

-- Get-or-create by name, for the "type a room that is not in the list
-- yet" case the old free-text field handled by accident. SECURITY
-- INVOKER, so RLS still decides: a Viewer calling this gets nothing.
create or replace function public.room_id_for(p_name text)
returns uuid language plpgsql set search_path = public as $fn$
declare found uuid;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'A room needs a name';
  end if;

  select id into found from public.rooms
   where lower(btrim(name)) = lower(btrim(p_name));
  if found is not null then
    return found;
  end if;

  insert into public.rooms (name) values (btrim(p_name)) returning id into found;
  return found;
end;
$fn$;
