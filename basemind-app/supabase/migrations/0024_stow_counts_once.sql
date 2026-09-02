-- Putting away kit that is already counted in the box must not count it twice.
--
-- 0023 treated every stow as a move: take N off the room's loose pile, add N
-- to the place. That is right when the two piles are different kit, and
-- exactly wrong when they are the same kit filed twice — which is the state
-- the put-away button exists to clear.
--
-- Four tents, all four loose in the loft and all four in Box 1. Lift four off
-- the floor, add four to a box that already claims four, and the placements
-- now say eight tents out of four owned, so place_equipment refuses. Every
-- pure duplicate failed, meaning the feature failed at the only job it had.
--
-- The signal for which case you are in is already in the data: placements
-- that add up to more than the group owns are lying, and the surplus is the
-- duplicate. So the units coming off the loose pile are split — the ones the
-- place is already counting are simply dropped, and only the genuinely
-- unaccounted-for ones are added.

create or replace function public.stow_equipment(
  p_equipment_id uuid,
  p_storage_id uuid,
  p_quantity integer
)
returns void
language plpgsql
as $$
declare
  room      text;
  loose     integer;
  owned     integer;
  placed    integer;
  taken     integer;
  duplicate integer;
  to_add    integer;
begin
  if p_quantity <= 0 then
    raise exception 'Stow at least one';
  end if;

  select location into room from public.storage_places where id = p_storage_id;
  if not found then
    raise exception 'Storage place % not found', p_storage_id;
  end if;

  select quantity into owned from public.equipment where id = p_equipment_id;
  if not found then
    raise exception 'Equipment % not found', p_equipment_id;
  end if;

  -- How many of it are lying loose in the room this place stands in. Only
  -- that room: kit loose in a different store is somewhere else, and quietly
  -- teleporting it would be inventing a fact rather than recording one.
  select quantity into loose
    from public.equipment_placements
   where equipment_id = p_equipment_id
     and location is not null
     and lower(location) = lower(room);
  loose := coalesce(loose, 0);

  -- Everything filed anywhere, counted BEFORE the loose pile is disturbed:
  -- how far past the owned total it reaches is how much of what follows is a
  -- second record of kit already accounted for.
  select coalesce(sum(quantity), 0) into placed
    from public.equipment_placements
   where equipment_id = p_equipment_id;

  taken     := least(loose, p_quantity);
  duplicate := least(taken, greatest(0, placed - owned));
  to_add    := p_quantity - duplicate;

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

  -- Whatever was not already counted in the place gets filed there. Anything
  -- beyond what came off the loose pile has to come from units that are not
  -- placed anywhere, and place_equipment refuses if there aren't enough —
  -- which rolls back the lines above with it, so a refusal never costs
  -- anybody the pile they started with.
  if to_add > 0 then
    perform public.place_equipment(p_equipment_id, p_storage_id, null, to_add, true);
  end if;
end;
$$;
