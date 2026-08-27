-- Where the units of a thing actually are.
--
-- Until now an item had one room and one box, which cannot say "four tents in
-- the loft and two in the container", and cannot say "five of this rope in
-- the cooking box". Both are ordinary facts about a scout store, and both
-- were being worked around by entering the same kit twice under slightly
-- different names — the very mess the tidy-up pass exists to clean up.
--
-- A placement is "N of item X are in this box" or "N of item X are loose in
-- this room". An item can have as many as it likes.
--
-- The item's own `quantity` stays what it means today: how many the group
-- owns in total. Placements say where those units are, and they do NOT have
-- to add up to the total — kit genuinely goes missing, sits in a car boot, or
-- has not been filed yet. That gap is shown rather than hidden, and it keeps
-- loans, camp packing lists and the shopping list working off the total
-- exactly as they do now.

create table public.equipment_placements (
  id uuid primary key default uuid_generate_v4(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,

  -- Exactly one of these. In a box, the room is the box's room — storing it
  -- again here would let the two drift apart the first time a box is moved.
  box_id uuid references public.equipment_boxes(id) on delete cascade,
  location text,

  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint placement_is_box_or_room check ((box_id is null) <> (location is null))
);

-- One row per item per place; adjust the quantity rather than adding a second.
-- Two partial indexes because NULLs are distinct to a unique constraint, so a
-- single index over both columns would not actually stop duplicates.
create unique index idx_placement_one_per_box
  on public.equipment_placements (equipment_id, box_id) where box_id is not null;
create unique index idx_placement_one_per_room
  on public.equipment_placements (equipment_id, lower(location)) where location is not null;

create index idx_placement_equipment on public.equipment_placements (equipment_id);
create index idx_placement_box on public.equipment_placements (box_id) where box_id is not null;

create trigger trg_equipment_placements_updated_at
  before update on public.equipment_placements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Move what we already know into placements
--
-- Every item that exists somewhere gets one placement holding all of it:
-- in its box if it had one, otherwise loose in its room. Nothing is lost and
-- nothing needs re-entering.
-- ---------------------------------------------------------------------
insert into public.equipment_placements (equipment_id, box_id, location, quantity)
select e.id,
       e.box_id,
       case when e.box_id is null then e.location end,
       e.quantity
  from public.equipment e
 where e.quantity > 0
   and (e.box_id is not null or coalesce(btrim(e.location), '') <> '');

-- Items recorded as a quantity of 0 get no placement, deliberately. Zero of
-- something is not somewhere, and rounding it up to one so the row appears
-- in a room would be inventing stock. They show in the All items view as
-- "Not placed yet", which is both true and a prompt to go and count them.

-- equipment.box_id is superseded: a box's contents are its placements now.
-- Leaving it would mean two answers to "which box is this in", and they
-- would disagree the first time someone splits a stack across two boxes.
alter table public.equipment drop column box_id;

-- ---------------------------------------------------------------------
-- Put some of an item in a place, in one call.
--
-- Adding to a box is "there are five of these in here", not "insert a row" —
-- and whether a row already exists for that pairing is not something the
-- person tapping the button should have to know. Passing 0 removes it.
--
-- SECURITY INVOKER: the caller's RLS applies to every statement inside.
-- ---------------------------------------------------------------------
create or replace function public.place_equipment(
  p_equipment_id uuid,
  p_box_id uuid,
  p_location text,
  p_quantity integer
)
returns void
language plpgsql
as $$
begin
  if (p_box_id is null) = (p_location is null) then
    raise exception 'A placement needs exactly one of a box or a room';
  end if;

  if p_quantity <= 0 then
    delete from public.equipment_placements
     where equipment_id = p_equipment_id
       and (p_box_id is not null and box_id = p_box_id
            or p_location is not null and lower(location) = lower(p_location));
    return;
  end if;

  if p_box_id is not null then
    insert into public.equipment_placements (equipment_id, box_id, quantity)
    values (p_equipment_id, p_box_id, p_quantity)
    on conflict (equipment_id, box_id) where box_id is not null
    do update set quantity = excluded.quantity;
  else
    insert into public.equipment_placements (equipment_id, location, quantity)
    values (p_equipment_id, p_location, p_quantity)
    on conflict (equipment_id, lower(location)) where location is not null
    do update set quantity = excluded.quantity;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS: the same model as the equipment the placement describes.
-- ---------------------------------------------------------------------
alter table public.equipment_placements enable row level security;

create policy equipment_placements_select on public.equipment_placements for select
  using (public.is_active_user());

create policy equipment_placements_insert on public.equipment_placements for insert
  with check (public.is_active_user()
              and public.current_role() in ('Admin','Manager','Member'));

create policy equipment_placements_update on public.equipment_placements for update
  using (public.is_active_user()
         and public.current_role() in ('Admin','Manager','Member'))
  with check (public.is_active_user()
              and public.current_role() in ('Admin','Manager','Member'));

create policy equipment_placements_delete on public.equipment_placements for delete
  using (public.is_active_user()
         and public.current_role() in ('Admin','Manager','Member'));

alter publication supabase_realtime add table public.equipment_placements;

-- ---------------------------------------------------------------------
-- Merging has to carry placements across too
--
-- equipment_placements cascades from equipment, so the merge added in 0013
-- would now delete the loser's placements on its way out and quietly lose
-- the record of where those units were. Same shape as the packing-list fold
-- above it: add the quantities where both rows sat in the same place, and
-- repoint the rest.
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

  update public.equipment_loans
     set equipment_id = keep_id
   where equipment_id = drop_id;

  -- Packing lists: fold where a camp listed both, then repoint the rest.
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

  update public.event_equipment
     set equipment_id = keep_id
   where equipment_id = drop_id;

  -- Placements: same fold, once for boxes and once for rooms.
  update public.equipment_placements p
     set quantity = p.quantity + dup.quantity
    from public.equipment_placements dup
   where p.equipment_id = keep_id
     and dup.equipment_id = drop_id
     and (p.box_id is not null and p.box_id = dup.box_id
          or p.location is not null and lower(p.location) = lower(dup.location));

  delete from public.equipment_placements dup
   where dup.equipment_id = drop_id
     and exists (
       select 1 from public.equipment_placements p
        where p.equipment_id = keep_id
          and (p.box_id is not null and p.box_id = dup.box_id
               or p.location is not null and lower(p.location) = lower(dup.location))
     );

  update public.equipment_placements
     set equipment_id = keep_id
   where equipment_id = drop_id;

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
