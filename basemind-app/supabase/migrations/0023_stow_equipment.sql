-- Putting something in a box has to take it out of the room.
--
-- place_equipment could only ever ADD to a place. So "put the four tents in
-- this box" left four tents loose in the loft AND four in the box, and the
-- room went on listing kit that was standing in a box three feet away. Worse,
-- once the limit check arrived in 0020 the same action started failing
-- outright — all four are already placed, so there are none spare to put
-- anywhere — which made stowing a full pile impossible rather than merely
-- wrong.
--
-- Both are the same missing idea: stowing is a MOVE. The units come off the
-- loose pile in that place's room and go into the place.

create or replace function public.stow_equipment(
  p_equipment_id uuid,
  p_storage_id uuid,
  p_quantity integer
)
returns void
language plpgsql
as $$
declare
  room  text;
  loose integer;
  taken integer;
begin
  if p_quantity <= 0 then
    raise exception 'Stow at least one';
  end if;

  select location into room from public.storage_places where id = p_storage_id;
  if not found then
    raise exception 'Storage place % not found', p_storage_id;
  end if;

  -- How many of it are lying loose in the room this place stands in. Only
  -- that room: kit loose in a different store is somewhere else, and quietly
  -- teleporting it would be inventing a fact rather than recording one.
  select quantity into loose
    from public.equipment_placements
   where equipment_id = p_equipment_id
     and location is not null
     and lower(location) = lower(room);

  taken := least(coalesce(loose, 0), p_quantity);

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

  -- Then file them. Anything beyond what came off the loose pile has to come
  -- from units that aren't placed anywhere, and place_equipment refuses if
  -- there aren't enough — which rolls back the line above with it, so a
  -- refusal never costs anybody the pile they started with.
  perform public.place_equipment(p_equipment_id, p_storage_id, null, p_quantity, true);
end;
$$;
