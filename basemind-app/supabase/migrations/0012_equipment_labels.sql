-- The colour-band label system, as a field rather than a note.
--
-- The 14th's kit is marked with coloured bands that encode length, so a
-- leader can pick the right stave or rope out of a pile at arm's length
-- without measuring anything. Two separate schemes, same idea:
--
--   staves and poles   the band is the length     (2m red, 2.1m blue, 2.3m yellow)
--   ropes              the band is the length     (see the legend in the seed)
--                      and the rope's OWN colour is its type and thickness
--                      (green 8mm braid, red 10mm braid, white PolySteel)
--
-- It lives in its own column rather than inside `notes` because it is the
-- thing you search on when you are standing in the store looking for "the
-- red ones", and free text buried in a sentence can't be filtered or
-- counted. Left null for kit that carries no band, which is most of it.
--
-- Free text, not an enum: the group already uses "various" for the mixed
-- barrels and "yellow&green" for a two-colour band, and a constraint would
-- reject both rather than describe the shelf as it actually is.
alter table public.equipment
  add column label_colour text;

comment on column public.equipment.label_colour is
  'Colour of the physical band marking this item, where the group uses one. '
  'Encodes length for staves, poles and ropes.';

-- Finding "the red ones" is the whole point of the scheme, so make that
-- lookup cheap. Partial, because most kit carries no band at all.
create index idx_equipment_label_colour on public.equipment (lower(label_colour))
  where label_colour is not null;
