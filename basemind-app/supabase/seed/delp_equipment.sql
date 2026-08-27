-- =====================================================================
-- 14th DELP equipment list
--
-- The group's real inventory, taken from "14th DELP Equipment List.xlsx"
-- (sheets: Pioneering, Camping Equipment, Ropes, Tools, Kitchen).
--
-- Run in the Supabase SQL Editor after migrations 0012 and 0015.
--
-- Safe to re-run: each row is inserted only if nothing of that name is
-- already there, so running it twice adds nothing and — importantly —
-- never overwrites a quantity or condition somebody has since corrected
-- in the app. It deletes nothing.
--
-- LOCATION is set to 'Unassigned' throughout. The spreadsheet doesn't say
-- where anything lives, and the column can't be null. Set the real rooms
-- in the app afterwards and the "By room" view starts earning its keep.
--
-- CONDITION is 'Good' for everything, for the same reason: the sheet
-- doesn't record it, and inventing wear would be worse than a flat start.
--
-- ---------------------------------------------------------------------
-- THE LABEL SYSTEM
--
-- Coloured bands encode LENGTH, so the right stave or rope can be pulled
-- from a pile without measuring:
--
--   Staves and poles        2m red · 2.1m blue · 2.3m yellow · 1m yellow
--   Barrels                 mixed colours, no scheme
--
--   Ropes, per the legend on the Ropes sheet:
--     0.5m brown · 1m yellow · 2m green · 3m white · 4m red
--     5m black  · 6m blue   · 8m yellow&green
--     9m, 10m, 12m, 13m, 14m and 15m have no colour assigned yet.
--
--   A rope's OWN colour is its type and thickness, not its length:
--     green = 8mm outdoor braid · red = 10mm outdoor braid
--     white = PolySteel
--
-- Two things in the sheet contradict each other, so they are recorded
-- below as they actually are and flagged rather than quietly "fixed":
--
--   1. The legend gives 2m = green, but the 2m ropes are marked PINK.
--      That looks deliberate rather than wrong: the 8mm rope is itself
--      green, so a green band on it would be invisible. The legend is
--      what's out of date. Recorded as pink, which is what's on the rope.
--
--   2. 1m staves and 2.3m staves are BOTH yellow. That defeats the point
--      of the scheme for those two, and no third colour distinguishes
--      them. Recorded as-is; worth re-banding one of them.
-- =====================================================================

begin;

insert into public.equipment (name, category, location, quantity, condition, label_colour, notes)
select v.name, v.category, 'Unassigned', v.quantity, 'Good', v.label_colour, v.notes
  from (values
      -- ---- Pioneering sheet ----------------------------------------
      ('2m Stave', 'Staving', 60, 'red',
       'Red band. The bulk of the staving.'),
      ('2.1m Pioneering Pole', 'Pioneering', 32, 'blue',
       'Blue band.'),
      ('2.3m Stave', 'Staving', 18, 'yellow',
       'Yellow band — the same colour as the 1m staves, so the band alone does not tell them apart.'),
      ('1m Stave', 'Staving', 0, 'yellow',
       'Yellow band. Quantity not recorded on the sheet — needs counting.'),
      ('Barrel', 'Pioneering', 42, null,
       'Sheet records the colour as "various" — the barrels are mixed, which is a description of them rather than a length band.'),
      ('Tent', 'Camping', 4, null,
       'Green. That is the tent''s own colour, not a marking band. Listed on the Pioneering sheet under category Camping.'),

      -- ---- Camping Equipment sheet ---------------------------------
      ('Tentco Gazebo', 'Camping', 2, null, null),
      ('Tentco Gazebo Side (windows)', 'Camping', 2, null, null),
      ('Tentco Gazebo Side (doors)', 'Camping', 2, null, null),
      ('Blue Gazebo', 'Camping', 0, null,
       'Blue is the gazebo itself, not a marking band. Quantity not recorded on the sheet — needs counting.'),

      -- ---- Ropes sheet: cut rope the group actually has -------------
      -- Rows with an amount of 0 are left out; they are lengths the
      -- scheme allows for rather than rope on the shelf. Listed at the
      -- bottom of this file so nothing is lost.
      ('2m Rope (8mm outdoor braid)', 'Ropes', 8, 'pink',
       'For staving. NOT YET MARKED. Pink rather than the legend''s green, because the rope itself is green.'),
      ('4m Rope (8mm outdoor braid)', 'Ropes', 28, 'red',
       'For staving. Marked.'),
      ('5m Rope (8mm outdoor braid)', 'Ropes', 38, 'black',
       'For staving. Marked.'),
      ('6m Rope (8mm outdoor braid)', 'Ropes', 16, 'blue',
       'For staving. NOT YET MARKED.'),

      -- ---- Ropes sheet: uncut stock --------------------------------
      -- Quantity is METRES here, not a count of items. The equipment
      -- table has no unit column, so the note carries that.
      ('Outdoor Braid Rope, 8mm (uncut)', 'Ropes', 300, null,
       'Quantity is METRES, approximate (~300m). The rope is green, which is what marks it as 8mm braid — that is its type, not a length band. Cut from this for staving lengths.'),
      ('Outdoor Braid Rope, 10mm (uncut)', 'Ropes', 250, null,
       'Quantity is METRES (250m). The rope is red, which is what marks it as 10mm braid. Cut from this for pioneering lengths.'),

      -- ---- Tools sheet ---------------------------------------------
      ('Foldable Shovel', 'Tools', 3, null, null),
      ('Frapping Mallet (half circle)', 'Tools', 4, null,
       'Spelled "malets" on the sheet.'),
      ('Frapping Mallet (full circle)', 'Tools', 2, null,
       'Spelled "malets" on the sheet.'),
      ('Small Axe', 'Tools', 0, null,
       'Quantity not recorded on the sheet — needs counting.'),
      ('Big Axe', 'Tools', 1, null, null),
      ('Spade', 'Tools', 0, null,
       'Quantity not recorded on the sheet — needs counting.'),
      ('Pick Axe', 'Tools', 0, null,
       'Quantity not recorded on the sheet — needs counting.')
  ) as v(name, category, quantity, label_colour, notes)
 -- Skip anything already in the inventory under that name.
 --
 -- Matching on name ALONE is deliberate, and it is the cautious choice
 -- rather than the precise one. The same name in two different rooms is
 -- perfectly legitimate — a first aid kit in the store and another in the
 -- minibus are two real things — so name is not a key here. But this seed
 -- puts everything in 'Unassigned', and matching on (name, location) would
 -- mean that once you have filed "Tent" in the Loft, a second run inserts a
 -- fresh "Tent" in 'Unassigned' and you have two.
 --
 -- Skipping can therefore be wrong in the other direction: if you already
 -- had an unrelated "Tent", this seed's tent is left out. That is why the
 -- query below lists what was skipped, so a false match is visible rather
 -- than silent.
 where not exists (
   select 1 from public.equipment e where lower(e.name) = lower(v.name)
 );

-- Everything this file adds starts life loose in its room. Where kit is
-- lives in placements now, and an item with none would sit under "not
-- placed" instead of appearing in the room it was just filed in.
insert into public.equipment_placements (equipment_id, location, quantity)
select e.id, e.location, e.quantity
  from public.equipment e
 where e.location = 'Unassigned'
   and e.quantity > 0
   and not exists (
     select 1 from public.equipment_placements p where p.equipment_id = e.id
   );

commit;

-- ---------------------------------------------------------------------
-- Anything skipped because that name was already in use.
--
-- Normally empty. A row here means either you have already run this file,
-- or you had an item of that name already — check the location and
-- quantity, because the sheet's version was NOT added.
-- ---------------------------------------------------------------------
select e.name, e.location, e.quantity, e.category
  from public.equipment e
 where lower(e.name) in (
   '2m stave', '2.1m pioneering pole', '2.3m stave', '1m stave', 'barrel', 'tent',
   'tentco gazebo', 'tentco gazebo side (windows)', 'tentco gazebo side (doors)',
   'blue gazebo', '2m rope (8mm outdoor braid)', '4m rope (8mm outdoor braid)',
   '5m rope (8mm outdoor braid)', '6m rope (8mm outdoor braid)',
   'outdoor braid rope, 8mm (uncut)', 'outdoor braid rope, 10mm (uncut)',
   'foldable shovel', 'frapping mallet (half circle)', 'frapping mallet (full circle)',
   'small axe', 'big axe', 'spade', 'pick axe'
 )
   and e.location <> 'Unassigned'
 order by e.name;

-- ---------------------------------------------------------------------
-- What you should see afterwards: 23 rows, 8 of them carrying a length band.
-- ---------------------------------------------------------------------
select category, count(*) as items, sum(quantity) as total_quantity
  from public.equipment
 where location = 'Unassigned'
 group by category
 order by category;

-- The label system, as it now stands in the database.
select label_colour, string_agg(name, ', ' order by name) as items
  from public.equipment
 where label_colour is not null
 group by label_colour
 order by label_colour;

-- ---------------------------------------------------------------------
-- DELIBERATELY NOT INSERTED
--
-- Rope lengths listed on the Ropes sheet with an amount of 0. These are
-- lengths the marking scheme allows for, not rope in the store, and
-- adding them would put ten items reading "0" into the inventory:
--
--   3m   8mm outdoor braid   (no marking colour set)
--   2m, 3m, 4m, 5m, 6m   10mm outdoor braid   (red rope, pioneering)
--   5m, 6m, 7m, 8m       PolySteel            (white rope, pioneering)
--
-- The Kitchen sheet is empty, so there is nothing from it here.
--
-- If you would rather have the zero rows in the list as placeholders to
-- fill in, say so and they are four lines away.
-- ---------------------------------------------------------------------
