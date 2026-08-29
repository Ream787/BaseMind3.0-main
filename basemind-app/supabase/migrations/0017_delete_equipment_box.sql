-- Getting rid of a box without getting rid of what was in it.
--
-- equipment_placements.box_id cascades, so a plain DELETE takes the box's
-- placements with it and the kit silently becomes "not placed" — the record
-- of six mallets being in the container is gone, and nobody finds out until
-- somebody goes looking for mallets.
--
-- Usually the box is being retired and its contents are staying in the room,
-- so that is what this offers: tip the contents out onto the floor of the
-- room, then remove the box. Emptying it for real stays available for the
-- case where the box and its contents are both actually gone.
create or replace function public.delete_equipment_box(
  p_box_id uuid,
  p_keep_contents boolean default true
)
returns void
language plpgsql
as $$
declare
  box public.equipment_boxes%rowtype;
  item record;
begin
  select * into box from public.equipment_boxes where id = p_box_id;
  if not found then
    raise exception 'Box % not found', p_box_id;
  end if;

  if p_keep_contents then
    for item in
      select equipment_id, quantity
        from public.equipment_placements
       where box_id = p_box_id
    loop
      -- Add to whatever is already loose in that room rather than replacing
      -- it. Two mallets on the shelf and four in the box is six mallets in
      -- the room, and the unique index would reject a second row anyway.
      insert into public.equipment_placements (equipment_id, location, quantity)
      values (item.equipment_id, box.location, item.quantity)
      on conflict (equipment_id, lower(location)) where location is not null
      do update set quantity = public.equipment_placements.quantity + excluded.quantity;
    end loop;
  end if;

  -- The box's own placements go with it either way: they described things
  -- being in a box that no longer exists.
  delete from public.equipment_boxes where id = p_box_id;
end;
$$;
