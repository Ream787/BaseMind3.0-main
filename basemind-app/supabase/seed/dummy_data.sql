-- =====================================================================
-- BaseMind sample data
--
-- Fictional content for trying the app out — the sites, phone numbers and
-- people are invented, not real places or businesses. Run it in the Supabase
-- SQL Editor after migrations 0001-0003.
--
-- Safe to re-run: it clears its own rows first (see the DELETEs below), so
-- you won't end up with duplicates. It does NOT touch user accounts.
--
-- To remove it all again, run seed/remove_dummy_data.sql.
--
-- Dates are relative to whenever you run this, so the calendar always has
-- something in the past, something running now, and several coming up.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Clear any previous run of this seed (child rows first for the FKs)
-- ---------------------------------------------------------------------
delete from public.event_food
  where event_id in (select id from public.events where name like '[sample]%');
delete from public.event_equipment
  where event_id in (select id from public.events where name like '[sample]%');
delete from public.events        where name like '[sample]%';
delete from public.camping_sites where name like '[sample]%';
delete from public.food_items    where name like '[sample]%';
delete from public.equipment     where name like '[sample]%';

-- ---------------------------------------------------------------------
-- EQUIPMENT
-- Spread across four rooms and six categories so the "By room" and
-- "By category" views both have something to show. A few items are in
-- poor condition to exercise the "needs attention" badges.
-- ---------------------------------------------------------------------
insert into public.equipment
  (name, category, quantity, location, condition, notes, date_last_checked, next_check_date)
values
  -- Store Room / Camping
  ('[sample] Patrol Tent (6-man)', 'Camping', 4, 'Store Room', 'Good',
   'Green canvas, one per patrol', current_date - 40, current_date + 50),
  ('[sample] Dome Tent (2-man)', 'Camping', 6, 'Store Room', 'Good',
   'For leaders and small hikes', current_date - 40, current_date + 50),
  ('[sample] Ground Sheet', 'Camping', 10, 'Store Room', 'Needs Repair',
   'Two have tears along the seam', current_date - 90, current_date - 5),
  ('[sample] Tent Pegs (bundle of 20)', 'Camping', 12, 'Store Room', 'Good',
   null, current_date - 40, current_date + 50),
  ('[sample] Mallet', 'Camping', 5, 'Store Room', 'Broken',
   'One handle split at winter camp', current_date - 20, current_date + 10),

  -- Loft / Pioneering
  ('[sample] Pioneering Pole (3m)', 'Pioneering', 20, 'Loft', 'Good',
   'Check for splits before use', current_date - 60, current_date + 30),
  ('[sample] Sisal Rope (10m)', 'Pioneering', 15, 'Loft', 'Good',
   null, current_date - 60, current_date + 30),
  ('[sample] Guy Line Set', 'Pioneering', 8, 'Loft', 'Missing',
   'Two sets not returned after last camp', current_date - 30, current_date + 5),
  ('[sample] Block and Tackle', 'Pioneering', 2, 'Loft', 'Good',
   null, current_date - 60, current_date + 120),

  -- Container / Cooking
  ('[sample] Dixie Set', 'Cooking', 6, 'Container', 'Good',
   'Nested aluminium pots', current_date - 15, current_date + 75),
  ('[sample] Gas Stove (2-burner)', 'Cooking', 3, 'Container', 'Needs Repair',
   'One regulator leaks - do not use', current_date - 15, current_date + 5),
  ('[sample] Gas Bottle (9kg)', 'Cooking', 2, 'Container', 'Good',
   'Check level before every camp', current_date - 15, current_date + 75),
  ('[sample] Cast Iron Potjie (no. 3)', 'Cooking', 2, 'Container', 'Good',
   'Season after each use', current_date - 15, current_date + 75),
  ('[sample] Cooking Utensil Box', 'Cooking', 3, 'Container', 'Good',
   null, current_date - 15, current_date + 75),

  -- Quartermaster Store / mixed
  ('[sample] First Aid Kit (large)', 'First Aid', 2, 'Quartermaster Store', 'Needs Repair',
   'Restock plasters and burn gel', current_date - 10, current_date + 20),
  ('[sample] First Aid Kit (belt)', 'First Aid', 6, 'Quartermaster Store', 'Good',
   null, current_date - 10, current_date + 80),
  ('[sample] Compass', 'Navigation', 12, 'Quartermaster Store', 'Good',
   null, current_date - 45, current_date + 135),
  ('[sample] Map Case', 'Navigation', 8, 'Quartermaster Store', 'Good',
   null, current_date - 45, current_date + 135),
  ('[sample] Hand Axe', 'Tools', 4, 'Quartermaster Store', 'Good',
   'Sharpen before camp', current_date - 25, current_date + 65),
  ('[sample] Bow Saw', 'Tools', 3, 'Quartermaster Store', 'Good',
   null, current_date - 25, current_date + 65),
  ('[sample] Spade', 'Tools', 4, 'Quartermaster Store', 'Broken',
   'One handle snapped', current_date - 25, current_date - 2),
  ('[sample] Rugby Ball', 'Games', 2, 'Quartermaster Store', 'Good',
   null, current_date - 100, current_date + 80),
  ('[sample] Rope Quoits Set', 'Games', 1, 'Quartermaster Store', 'Good',
   'Wide games kit', current_date - 100, current_date + 80),
  -- deliberately blank category, to show the "Uncategorised" bucket
  ('[sample] Spare Tarpaulin', null, 3, 'Loft', 'Good',
   'No category set on purpose', current_date - 70, current_date + 20);

-- Mark a few items as last checked by whoever set the group up, if anyone
-- has signed up yet. Harmless no-op on an empty users table.
update public.equipment
   set checked_by = (select id from public.users order by created_at limit 1)
 where name like '[sample]%'
   and condition <> 'Good'
   and exists (select 1 from public.users);

-- ---------------------------------------------------------------------
-- CAMPING SITES (all fictional)
-- ---------------------------------------------------------------------
insert into public.camping_sites (name, phone, email, address, description, notes)
values
  ('[sample] Kloofzicht Scout Camp',
   '011 555 0142', 'bookings@kloofzicht.example',
   'R512 Hartbeespoort Road, North West',
   'Large grassed site with a stream, ablution block and a covered hall. '
   'Good for district-size camps and pioneering projects.',
   'Book at least six weeks ahead. Gate code changes each season - phone first.'),

  ('[sample] Rietvlei Outdoor Centre',
   '012 555 0198', 'info@rietvlei-outdoor.example',
   'Rietvlei Nature Reserve, Pretoria',
   'Smaller bushveld site with basic ablutions and a fire pit. '
   'Water on tap but no electricity.',
   'Bring your own firewood - no collecting on the reserve.'),

  ('[sample] Bergview Hiking Base',
   '013 555 0176', 'bergview@example.org',
   'Off the R532, Mpumalanga',
   'Trailhead base camp for weekend hikes. Bunkhouse for 20 plus space '
   'for tents. Steep access road.',
   'Minibus struggles on the last kilometre in the wet - use the lower car park.'),

  ('[sample] Old Mill Farm',
   '021 555 0113', null,
   'Elgin Valley, Western Cape',
   'Working farm with a field set aside for scout groups. Cold water only.',
   'Farmer prefers a phone call to email. No camping during harvest in March.');

-- ---------------------------------------------------------------------
-- FOOD STORE
-- Mixed units so the shopping list has to keep them straight.
-- ---------------------------------------------------------------------
insert into public.food_items (name, unit, quantity, category, notes)
values
  ('[sample] Rice',              'kg',      4,    'Dry goods', null),
  ('[sample] Pasta',             'kg',      2.5,  'Dry goods', null),
  ('[sample] Baked Beans',       'tins',    18,   'Tinned',    null),
  ('[sample] Chopped Tomatoes',  'tins',    12,   'Tinned',    null),
  ('[sample] Mince',             'kg',      0,    'Frozen',    'Buy fresh, do not stockpile'),
  ('[sample] Boerewors',         'kg',      0,    'Frozen',    'Braai night'),
  ('[sample] Bread',             'loaves',  0,    'Fresh',     'Collect on the way'),
  ('[sample] Milk',              'litres',  3,    'Fresh',     null),
  ('[sample] Eggs',              'units',   18,   'Fresh',     null),
  ('[sample] Coffee',            'g',       500,  'Drinks',    'Leaders survive on this'),
  ('[sample] Tea Bags',          'units',   200,  'Drinks',    null),
  ('[sample] Sugar',             'kg',      2,    'Dry goods', null),
  ('[sample] Cooking Oil',       'litres',  1.5,  'Dry goods', null),
  ('[sample] Hot Chocolate',     'g',       300,  'Drinks',    'For cold evenings'),
  ('[sample] Marshmallows',      'packets', 4,    'Treats',    'Campfire');

-- ---------------------------------------------------------------------
-- EVENTS
-- One finished, one running right now, three coming up.
-- ---------------------------------------------------------------------
insert into public.events (name, start_date, end_date, site_id, notes)
values
  ('[sample] Winter Camp',
   current_date - 35, current_date - 33,
   (select id from public.camping_sites where name = '[sample] Kloofzicht Scout Camp'),
   'Finished - kept here so you can see a past event.'),

  ('[sample] Weekend Patrol Camp',
   current_date - 1, current_date + 1,
   (select id from public.camping_sites where name = '[sample] Rietvlei Outdoor Centre'),
   'Running right now. Patrols cook for themselves.'),

  ('[sample] Spring Hike',
   current_date + 12, current_date + 13,
   (select id from public.camping_sites where name = '[sample] Bergview Hiking Base'),
   'Two-day hike. Everything carried, so keep the kit light.'),

  ('[sample] Pioneering Weekend',
   current_date + 40, current_date + 42,
   (select id from public.camping_sites where name = '[sample] Kloofzicht Scout Camp'),
   'Building a monkey bridge and a camp gateway.'),

  ('[sample] District Camporee',
   current_date + 85, current_date + 88,
   (select id from public.camping_sites where name = '[sample] Old Mill Farm'),
   'Four other groups attending. Numbers to be confirmed.');

-- ---------------------------------------------------------------------
-- PACKING LIST for the Spring Hike (light, no heavy kit)
-- ---------------------------------------------------------------------
insert into public.event_equipment (event_id, equipment_id, quantity)
select e.id, q.id, v.qty
  from public.events e
  join (values
      ('[sample] Dome Tent (2-man)',        4),
      ('[sample] Compass',                  6),
      ('[sample] Map Case',                 6),
      ('[sample] First Aid Kit (belt)',     3),
      ('[sample] Gas Stove (2-burner)',     2),
      ('[sample] Dixie Set',                3)
  ) as v(item_name, qty) on true
  join public.equipment q on q.name = v.item_name
 where e.name = '[sample] Spring Hike';

-- ---------------------------------------------------------------------
-- PACKING LIST for the Pioneering Weekend (the heavy kit)
-- ---------------------------------------------------------------------
insert into public.event_equipment (event_id, equipment_id, quantity)
select e.id, q.id, v.qty
  from public.events e
  join (values
      ('[sample] Patrol Tent (6-man)',      4),
      ('[sample] Ground Sheet',             8),
      ('[sample] Tent Pegs (bundle of 20)', 8),
      ('[sample] Mallet',                   4),
      ('[sample] Pioneering Pole (3m)',     20),
      ('[sample] Sisal Rope (10m)',         15),
      ('[sample] Block and Tackle',         2),
      ('[sample] Hand Axe',                 3),
      ('[sample] Bow Saw',                  2),
      ('[sample] First Aid Kit (large)',    1),
      ('[sample] Cast Iron Potjie (no. 3)', 2),
      ('[sample] Gas Bottle (9kg)',         1)
  ) as v(item_name, qty) on true
  join public.equipment q on q.name = v.item_name
 where e.name = '[sample] Pioneering Weekend';

-- ---------------------------------------------------------------------
-- FOOD PLAN for the Pioneering Weekend
--
-- Chosen so the shopping list is worth looking at: some items the store
-- already covers (they show as "Covered" and stay off the list), some are
-- short by a whole amount, and Milk is short by 0.5 litres to prove the
-- fractional maths comes out clean.
-- ---------------------------------------------------------------------
insert into public.event_food (event_id, food_item_id, quantity)
select e.id, f.id, v.qty
  from public.events e
  join (values
      ('[sample] Rice',             6.0),   -- have 4      -> buy 2 kg
      ('[sample] Baked Beans',      12.0),  -- have 18     -> covered
      ('[sample] Mince',            5.0),   -- have 0      -> buy 5 kg
      ('[sample] Boerewors',        4.0),   -- have 0      -> buy 4 kg
      ('[sample] Bread',            8.0),   -- have 0      -> buy 8 loaves
      ('[sample] Milk',             3.5),   -- have 3      -> buy 0.5 litres
      ('[sample] Eggs',             36.0),  -- have 18     -> buy 18
      ('[sample] Coffee',           500.0), -- have 500    -> covered exactly
      ('[sample] Sugar',            2.0),   -- have 2      -> covered exactly
      ('[sample] Cooking Oil',      2.0),   -- have 1.5    -> buy 0.5 litres
      ('[sample] Marshmallows',     6.0)    -- have 4      -> buy 2 packets
  ) as v(food_name, qty) on true
  join public.food_items f on f.name = v.food_name
 where e.name = '[sample] Pioneering Weekend';

-- ---------------------------------------------------------------------
-- FOOD PLAN for the Weekend Patrol Camp (smaller, mostly covered)
-- ---------------------------------------------------------------------
insert into public.event_food (event_id, food_item_id, quantity)
select e.id, f.id, v.qty
  from public.events e
  join (values
      ('[sample] Pasta',            2.0),   -- have 2.5 -> covered
      ('[sample] Chopped Tomatoes', 8.0),   -- have 12  -> covered
      ('[sample] Bread',            4.0),   -- have 0   -> buy 4 loaves
      ('[sample] Milk',             2.0),   -- have 3   -> covered
      ('[sample] Hot Chocolate',    400.0)  -- have 300 -> buy 100 g
  ) as v(food_name, qty) on true
  join public.food_items f on f.name = v.food_name
 where e.name = '[sample] Weekend Patrol Camp';

commit;

-- ---------------------------------------------------------------------
-- What you should see afterwards
-- ---------------------------------------------------------------------
select 'equipment'     as table_name, count(*) from public.equipment     where name like '[sample]%'
union all select 'camping_sites', count(*) from public.camping_sites where name like '[sample]%'
union all select 'food_items',    count(*) from public.food_items    where name like '[sample]%'
union all select 'events',        count(*) from public.events        where name like '[sample]%'
union all select 'event_equipment', count(*) from public.event_equipment
  where event_id in (select id from public.events where name like '[sample]%')
union all select 'event_food',    count(*) from public.event_food
  where event_id in (select id from public.events where name like '[sample]%');
