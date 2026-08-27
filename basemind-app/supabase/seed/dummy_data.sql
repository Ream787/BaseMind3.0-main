-- =====================================================================
-- BaseMind sample data
--
-- Fictional content for trying the app out — the sites, phone numbers and
-- people are invented, not real places or businesses. Run it in the Supabase
-- SQL Editor after migrations 0001-0005 (the menu library needs 0005).
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
delete from public.menus where name like '[sample]%';
delete from public.equipment_loans
  where equipment_id in (select id from public.equipment where name like '[sample]%');
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
--
-- Stock levels are deliberately uneven: the dry goods and tinned shelves
-- are part-full, while anything fresh or frozen sits at zero. That's how a
-- real store cupboard looks between camps, and it's what makes the shopping
-- list worth reading — it only shows the gap.
-- ---------------------------------------------------------------------
insert into public.food_items (name, unit, quantity, category, notes)
values
  -- Dry goods
  ('[sample] Rice',              'kg',      4,    'Dry goods', null),
  ('[sample] Pasta',             'kg',      2.5,  'Dry goods', null),
  ('[sample] Oats',              'kg',      3,    'Dry goods', 'Rolled, not instant - cheaper and fills them up'),
  ('[sample] Maize Meal',        'kg',      5,    'Dry goods', 'Pap for a braai, porridge in winter'),
  ('[sample] Flour',             'kg',      2,    'Dry goods', 'Stokbrood and pancakes'),
  ('[sample] Couscous',          'kg',      0,    'Dry goods', 'Hikes: swells in hot water, no simmering'),
  ('[sample] Instant Noodles',   'packets', 0,    'Dry goods', 'Light and quick on a trek'),
  ('[sample] Brown Lentils',     'kg',      1,    'Dry goods', 'Bulks out a potjie without a cool box'),
  ('[sample] Breakfast Cereal',  'boxes',   0,    'Dry goods', 'One box is about 10 bowls'),
  ('[sample] Soup Powder',       'packets', 6,    'Dry goods', 'Thickens a stew as well as making soup'),
  ('[sample] Stock Cubes',       'units',   24,   'Dry goods', null),
  ('[sample] Peanut Butter',     'jars',    2,    'Dry goods', 'Trail lunches'),
  ('[sample] Jam',               'jars',    2,    'Dry goods', null),
  ('[sample] Raisins',           'kg',      0.5,  'Dry goods', null),
  ('[sample] Sugar',             'kg',      2,    'Dry goods', null),
  ('[sample] Cooking Oil',       'litres',  1.5,  'Dry goods', null),

  -- Tinned
  ('[sample] Baked Beans',       'tins',    18,   'Tinned',    null),
  ('[sample] Chopped Tomatoes',  'tins',    12,   'Tinned',    null),
  ('[sample] Tuna',              'tins',    8,    'Tinned',    'One tin makes about four sandwiches'),
  ('[sample] Sweetcorn',         'tins',    6,    'Tinned',    null),
  ('[sample] Chakalaka',         'tins',    6,    'Tinned',    'Goes with pap at a braai'),
  ('[sample] Kidney Beans',      'tins',    8,    'Tinned',    null),

  -- Frozen and fresh meat
  ('[sample] Mince',             'kg',      0,    'Frozen',    'Buy fresh, do not stockpile'),
  ('[sample] Boerewors',         'kg',      0,    'Frozen',    'Braai night'),
  ('[sample] Braai Chops',       'kg',      0,    'Frozen',    null),
  ('[sample] Chicken Pieces',    'kg',      0,    'Frozen',    'Potjie, curry and foil packets'),
  ('[sample] Stewing Beef',      'kg',      0,    'Frozen',    'Cheap cut - it has all afternoon to soften'),
  ('[sample] Bacon',             'kg',      0,    'Frozen',    null),
  ('[sample] Vienna Sausages',   'packets', 0,    'Frozen',    'Cub-proof lunch'),

  -- Fresh
  ('[sample] Bread',             'loaves',  0,    'Fresh',     'Collect on the way. About 20 slices a loaf'),
  ('[sample] Bread Rolls',       'units',   0,    'Fresh',     null),
  ('[sample] Milk',              'litres',  3,    'Fresh',     null),
  ('[sample] Eggs',              'units',   18,   'Fresh',     null),
  ('[sample] Butter',            'kg',      1,    'Fresh',     null),
  ('[sample] Cheddar Cheese',    'kg',      0,    'Fresh',     null),
  ('[sample] Potatoes',          'kg',      0,    'Fresh',     null),
  ('[sample] Onions',            'kg',      2,    'Fresh',     null),
  ('[sample] Carrots',           'kg',      0,    'Fresh',     null),
  ('[sample] Tomatoes',          'kg',      0,    'Fresh',     null),
  ('[sample] Lettuce',           'heads',   0,    'Fresh',     'Buy on the day or it travels badly'),
  ('[sample] Apples',            'kg',      0,    'Fresh',     null),
  ('[sample] Bananas',           'units',   0,    'Fresh',     null),

  -- Drinks
  ('[sample] Coffee',            'g',       500,  'Drinks',    'Leaders survive on this'),
  ('[sample] Tea Bags',          'units',   200,  'Drinks',    null),
  ('[sample] Hot Chocolate',     'g',       300,  'Drinks',    'For cold evenings'),
  ('[sample] Powdered Milk',     'g',       500,  'Drinks',    'Hikes: no cool box needed'),
  ('[sample] Juice Concentrate', 'litres',  4,    'Drinks',    'Dilutes 1:4'),

  -- Treats
  ('[sample] Marshmallows',      'packets', 4,    'Treats',    'Campfire'),
  ('[sample] Biscuits',          'packets', 6,    'Treats',    null),
  ('[sample] Chocolate Slabs',   'units',   0,    'Treats',    'S''mores'),
  ('[sample] Rusks',             'packets', 2,    'Treats',    'Early starts'),
  ('[sample] Provitas',          'packets', 3,    'Treats',    'They survive a rucksack; bread does not'),
  ('[sample] Biltong',           'kg',      0,    'Treats',    'Trail protein that needs no cooking'),
  ('[sample] Trail Mix',         'kg',      0,    'Treats',    null),

  -- Condiments
  ('[sample] Salt',              'kg',      1,    'Condiments', null),
  ('[sample] Braai Spice',       'g',       200,  'Condiments', null),
  ('[sample] Curry Powder',      'g',       200,  'Condiments', null),
  ('[sample] Mixed Herbs',       'g',       100,  'Condiments', null),
  ('[sample] Tomato Sauce',      'bottles', 2,    'Condiments', null),
  ('[sample] Mayonnaise',        'jars',    1,    'Condiments', null),
  ('[sample] Syrup',             'bottles', 1,    'Condiments', 'Pancakes and pap');

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

-- ---------------------------------------------------------------------
-- LOANS
-- A spread of states: overdue, due in the next few days, out with plenty
-- of time, out with no date set, and two already returned.
-- ---------------------------------------------------------------------
insert into public.equipment_loans
  (equipment_id, quantity, borrower_name, scout_group, position, phone, email,
   borrowed_on, due_back, returned_on, notes)
select q.id, v.qty, v.borrower, v.grp, v.pos, v.phone, v.email,
       v.borrowed, v.due, v.returned, v.notes
  from (values
      -- badly overdue
      ('[sample] Dome Tent (2-man)', 2, 'Thabo Molefe', '1st Riverside', 'PL',
       '082 555 0121', 'thabo.molefe@example.com',
       current_date - 30, current_date - 9, null::date,
       'Took two for a patrol hike. Chase this up.'),
      -- due in a couple of days
      ('[sample] Compass', 4, 'Lerato Dlamini', '1st Riverside', 'APL',
       '083 555 0164', null,
       current_date - 10, current_date + 2, null::date,
       'Map and compass badge work.'),
      -- borrowed by another group, plenty of time
      ('[sample] Pioneering Pole (3m)', 8, 'Nadia Fourie', '3rd Hilltop', 'Scouter',
       null, 'nadia.fourie@example.org',
       current_date - 4, current_date + 21, null::date,
       'Lending to the neighbouring group for their gateway build.'),
      -- out with no return date agreed
      ('[sample] Rugby Ball', 1, 'Sipho Khumalo', '1st Riverside', 'Scout',
       '084 555 0199', null,
       current_date - 6, null::date, null::date,
       'No date agreed - just for troop nights.'),
      -- parent, due next week
      ('[sample] Cast Iron Potjie (no. 3)', 1, 'Marius van Wyk', '1st Riverside', 'Parent',
       '079 555 0107', 'mvanwyk@example.com',
       current_date - 2, current_date + 8, null::date,
       'Borrowed for a group fundraiser braai.'),
      -- already returned, on time
      ('[sample] Bow Saw', 2, 'Thabo Molefe', '1st Riverside', 'PL',
       '082 555 0121', 'thabo.molefe@example.com',
       current_date - 60, current_date - 50, current_date - 52,
       'Returned early, all good.'),
      -- already returned, but late
      ('[sample] Gas Stove (2-burner)', 1, 'Nadia Fourie', '3rd Hilltop', 'Scouter',
       null, 'nadia.fourie@example.org',
       current_date - 80, current_date - 70, current_date - 64,
       'Came back late and with the dodgy regulator.')
  ) as v(item_name, qty, borrower, grp, pos, phone, email, borrowed, due, returned, notes)
  join public.equipment q on q.name = v.item_name;

-- ---------------------------------------------------------------------
-- MENU PRESETS
-- Eleven menus covering all five categories the library filters on, from a
-- single day out to a five-day summer camp, plus vegetarian and cub-friendly
-- versions of a normal weekend.
--
-- Quantities are totals for the menu's `serves` count, not per person, which
-- is how a quartermaster shops. They come from the usual catering rules of
-- thumb rather than being made up:
--
--   dry rice / pasta / couscous   75-100 g a head (scouts land at the top)
--   mince in a sauce              120 g a head; stewing meat 150 g
--   braai meat                    400-500 g an adult, so ~350 g for scouts;
--                                 boerewors alone 300 g, 200 g in a mix
--   bacon                         2 rashers, about 45 g
--   eggs                          2 a head scrambled
--   bread                         20 slices a loaf, 4 slices a head
--   oats                          60 g a head; maize meal 70 g
--   potatoes                      250 g a head
--   milk                          150 ml a head on cereal; 1 litre = 20 mugs
--   tinned tomato / beans         1 tin per 3; tuna 1 tin per 4
--   hot chocolate                 20 g a head
--   hiking days                   450-550 g of dry food a head a day
--
-- Children under 12 count as half an adult for meat, which is why the cub
-- menu is lighter per head than the scout ones.
-- ---------------------------------------------------------------------
insert into public.menus (name, description, serves, day_count, category, event_id)
values
  ('[sample] Standard Weekend Camp',
   'Reliable two-day camp menu. Potjie on the Saturday night.',
   12, 2, 'Camping', null),
  ('[sample] Lightweight Hike',
   'Two days, nothing needing a cool box. Everything carried.',
   8, 2, 'Hiking', null),
  ('[sample] Day Trip',
   'Single day out - lunch and a snack only.',
   12, 1, 'Day trip', null),
  ('[sample] Braai Weekend',
   'Saturday night is the braai. Wors, chops, pap and chakalaka, and enough left over for rolls on Sunday.',
   20, 2, 'Camping', null),
  ('[sample] Summer Camp (5 days)',
   'A full week of standing camp. Repeats nothing, and keeps the two big cooks away from the two longest activity days.',
   24, 5, 'Camping', null),
  ('[sample] Cub Camp',
   'Short, simple cooking a cub can help with. Nothing sharper than a spoon and nothing that needs timing.',
   16, 2, 'Camping', null),
  ('[sample] Vegetarian Weekend',
   'The standard weekend with no meat in it. Lentils and beans do the filling, so nobody leaves hungry.',
   12, 2, 'Camping', null),
  ('[sample] Backwoods Cooking Day',
   'Skills day: everything cooked on an open fire with no pots. Foil packets, stokbrood on a stick, braaibroodjies at dusk.',
   12, 1, 'Day trip', null),
  ('[sample] Winter Camp',
   'Hot food at every meal and something warm before lights out. Heavier than the summer menu on purpose.',
   16, 2, 'Camping', null),
  ('[sample] Backpacking Trek (3 days)',
   'Everything carried on your back for three days. About 500 g of dry food per person per day, no tins bigger than a tuna.',
   6, 3, 'Backpacking', null),
  ('[sample] Hall Sleepover',
   'Indoors with a real kitchen, so one big pot feeds everyone. Overnight, so breakfast is the second meal.',
   20, 2, 'Indoor', null);

-- Every meal in every preset, in one table so the whole week reads at a
-- glance. A meal is identified by (menu, day, name) below, so the same meal
-- name can repeat on another day with its own quantities - "Trail lunch"
-- three days running is exactly what a trek looks like.
insert into public.menu_meals (menu_id, day_number, meal_slot, name, notes)
select m.id, v.day, v.slot, v.meal, v.note
  from public.menus m
  join (values
      -- Standard Weekend Camp
      ('[sample] Standard Weekend Camp', 1, 'Breakfast',       'Oats with milk and coffee',   'Quick start before the hike'),
      ('[sample] Standard Weekend Camp', 1, 'Lunch',           'Cheese and jam sandwiches',   null),
      ('[sample] Standard Weekend Camp', 1, 'Afternoon snack', 'Rusks and tea',               'Back from the hike, before the fire is lit'),
      ('[sample] Standard Weekend Camp', 1, 'Dinner',          'Chicken potjie with rice',    'Patrols cook in turn. Three hours, so start early'),
      ('[sample] Standard Weekend Camp', 2, 'Breakfast',       'Eggs, boerewors and toast',   null),
      ('[sample] Standard Weekend Camp', 2, 'Lunch',           'Leftovers and bread',         'Pack up while eating'),

      -- Lightweight Hike
      ('[sample] Lightweight Hike',      1, 'Breakfast',       'Oats with hot water',         'No milk - carry powdered'),
      ('[sample] Lightweight Hike',      1, 'Lunch',           'Trail lunch',                 'Eaten on the move'),
      ('[sample] Lightweight Hike',      1, 'Dinner',          'Pasta with tinned tomato and tuna', 'One pot, one stove'),
      ('[sample] Lightweight Hike',      2, 'Breakfast',       'Oats and hot chocolate',      null),
      ('[sample] Lightweight Hike',      2, 'Lunch',           'Trail lunch',                 null),

      -- Day Trip
      ('[sample] Day Trip',              1, 'Lunch',           'Sandwiches and fruit',        null),
      ('[sample] Day Trip',              1, 'Afternoon snack', 'Marshmallows over the fire',  null),

      -- Braai Weekend
      ('[sample] Braai Weekend',         1, 'Breakfast',       'Bacon, eggs and toast',       null),
      ('[sample] Braai Weekend',         1, 'Lunch',           'Rolls with cheese and salad', 'Cold lunch - the fire is for tonight'),
      ('[sample] Braai Weekend',         1, 'Dinner',          'Braai with pap and chakalaka', 'Light the fire two hours before you want to eat'),
      ('[sample] Braai Weekend',         1, 'Supper',          'Marshmallows at the fire',    null),
      ('[sample] Braai Weekend',         2, 'Breakfast',       'French toast and syrup',      'Uses up the bread from yesterday'),
      ('[sample] Braai Weekend',         2, 'Lunch',           'Braai leftovers in rolls',    'Cold wors in a roll is a Sunday tradition'),

      -- Summer Camp (5 days)
      ('[sample] Summer Camp (5 days)',  1, 'Breakfast',       'Oats and fruit',              null),
      ('[sample] Summer Camp (5 days)',  1, 'Lunch',           'Sandwiches',                  null),
      ('[sample] Summer Camp (5 days)',  1, 'Dinner',          'Spaghetti bolognaise',        'The easiest big pot on the list - good for the first night'),
      ('[sample] Summer Camp (5 days)',  2, 'Breakfast',       'Eggs and bacon',              null),
      ('[sample] Summer Camp (5 days)',  2, 'Lunch',           'Tuna mayo rolls',             'Made cold while the day hike is packing'),
      ('[sample] Summer Camp (5 days)',  2, 'Dinner',          'Chicken curry and rice',      null),
      ('[sample] Summer Camp (5 days)',  3, 'Breakfast',       'Pancakes',                    'Slow, so put two patrols on it'),
      ('[sample] Summer Camp (5 days)',  3, 'Lunch',           'Soup and bread',              null),
      ('[sample] Summer Camp (5 days)',  3, 'Dinner',          'Braai with pap and chakalaka', 'Halfway treat'),
      ('[sample] Summer Camp (5 days)',  4, 'Breakfast',       'Oats and rusks',              null),
      ('[sample] Summer Camp (5 days)',  4, 'Lunch',           'Wraps with leftovers',        null),
      ('[sample] Summer Camp (5 days)',  4, 'Dinner',          'Beef stew with potatoes',     'Goes on before the afternoon activity and looks after itself'),
      ('[sample] Summer Camp (5 days)',  5, 'Breakfast',       'French toast',                null),
      ('[sample] Summer Camp (5 days)',  5, 'Lunch',           'Pack-up lunch',               'Nothing that needs washing up - the kitchen is already packed'),

      -- Cub Camp
      ('[sample] Cub Camp',              1, 'Breakfast',       'Cereal and milk',             'No cooking on the first morning'),
      ('[sample] Cub Camp',              1, 'Lunch',           'Hot dogs',                    null),
      ('[sample] Cub Camp',              1, 'Afternoon snack', 'Fruit and biscuits',          null),
      ('[sample] Cub Camp',              1, 'Dinner',          'Foil-packet chicken and veg', 'Each cub builds their own packet. 30-45 minutes in the coals'),
      ('[sample] Cub Camp',              1, 'Supper',          'S''mores at the campfire',    null),
      ('[sample] Cub Camp',              2, 'Breakfast',       'Scrambled eggs on toast',     null),
      ('[sample] Cub Camp',              2, 'Lunch',           'Sandwiches and fruit',        null),

      -- Vegetarian Weekend
      ('[sample] Vegetarian Weekend',    1, 'Breakfast',       'Oats with banana and syrup',  null),
      ('[sample] Vegetarian Weekend',    1, 'Lunch',           'Cheese and tomato sandwiches', null),
      ('[sample] Vegetarian Weekend',    1, 'Dinner',          'Lentil and vegetable potjie with rice', 'Lentils go in dry - they cook in the pot'),
      ('[sample] Vegetarian Weekend',    2, 'Breakfast',       'Scrambled eggs on toast',     null),
      ('[sample] Vegetarian Weekend',    2, 'Lunch',           'Bean and sweetcorn wraps',    null),

      -- Backwoods Cooking Day
      ('[sample] Backwoods Cooking Day', 1, 'Lunch',           'Foil-packet chicken and veg', 'Built raw, buried in coals, opened at the table'),
      ('[sample] Backwoods Cooking Day', 1, 'Afternoon snack', 'Stokbrood over the coals',    'Dough wound round a stick, jam once it is cool enough to hold'),
      ('[sample] Backwoods Cooking Day', 1, 'Supper',          'Braaibroodjies and hot chocolate', 'Toasted sandwiches on the grid before everyone goes home'),

      -- Winter Camp
      ('[sample] Winter Camp',           1, 'Breakfast',       'Mieliepap with syrup',        'Hot and cheap, and it holds them until lunch'),
      ('[sample] Winter Camp',           1, 'Lunch',           'Soup and bread rolls',        null),
      ('[sample] Winter Camp',           1, 'Dinner',          'Beef stew with potatoes',     'On the fire from mid-afternoon'),
      ('[sample] Winter Camp',           1, 'Supper',          'Hot chocolate before lights out', 'The one thing nobody forgets to turn up for'),
      ('[sample] Winter Camp',           2, 'Breakfast',       'Bacon, eggs, beans and toast', null),
      ('[sample] Winter Camp',           2, 'Lunch',           'Toasted cheese sandwiches',   null),

      -- Backpacking Trek (3 days)
      ('[sample] Backpacking Trek (3 days)', 1, 'Breakfast',   'Oats with raisins',           null),
      ('[sample] Backpacking Trek (3 days)', 1, 'Lunch',       'Trail lunch',                 'No stove at midday'),
      ('[sample] Backpacking Trek (3 days)', 1, 'Dinner',      'Instant noodles with tuna',   null),
      ('[sample] Backpacking Trek (3 days)', 2, 'Breakfast',   'Oats and hot chocolate',      null),
      ('[sample] Backpacking Trek (3 days)', 2, 'Lunch',       'Trail lunch',                 null),
      ('[sample] Backpacking Trek (3 days)', 2, 'Dinner',      'Couscous with lentils and soup', 'Boil, cover, stand five minutes. Saves fuel'),
      ('[sample] Backpacking Trek (3 days)', 3, 'Breakfast',   'Oats and coffee',             null),
      ('[sample] Backpacking Trek (3 days)', 3, 'Lunch',       'Trail lunch',                 'Eaten at the pick-up point'),

      -- Hall Sleepover
      ('[sample] Hall Sleepover',        1, 'Dinner',          'Spaghetti bolognaise',        'A real kitchen, so one pot does everyone'),
      ('[sample] Hall Sleepover',        1, 'Supper',          'Hot chocolate and biscuits',  null),
      ('[sample] Hall Sleepover',        2, 'Breakfast',       'Cereal and toast',            'Out by nine, so nothing that needs a pan')
  ) as v(menu_name, day, slot, meal, note) on v.menu_name = m.name
 where m.event_id is null;

-- Ingredients, keyed by (menu, day, meal). Quantities are totals for the
-- menu's own `serves` count - applying a preset to a camp scales them.
--
-- Ingredients repeat across meals on purpose: bread turns up at four meals
-- on the summer camp, and the shopping list rolls them into one line.
insert into public.menu_meal_items (meal_id, food_item_id, quantity)
select ml.id, f.id, v.qty
  from public.menu_meals ml
  join public.menus mn on mn.id = ml.menu_id
  join (values
      -- ---- Standard Weekend Camp (12) --------------------------------
      ('[sample] Standard Weekend Camp', 1, 'Oats with milk and coffee',  '[sample] Oats',             0.75),
      ('[sample] Standard Weekend Camp', 1, 'Oats with milk and coffee',  '[sample] Milk',             2.0),
      ('[sample] Standard Weekend Camp', 1, 'Oats with milk and coffee',  '[sample] Sugar',            0.25),
      ('[sample] Standard Weekend Camp', 1, 'Oats with milk and coffee',  '[sample] Coffee',           150.0),
      ('[sample] Standard Weekend Camp', 1, 'Oats with milk and coffee',  '[sample] Tea Bags',         12.0),
      ('[sample] Standard Weekend Camp', 1, 'Cheese and jam sandwiches',  '[sample] Bread',            3.0),
      ('[sample] Standard Weekend Camp', 1, 'Cheese and jam sandwiches',  '[sample] Cheddar Cheese',   0.4),
      ('[sample] Standard Weekend Camp', 1, 'Cheese and jam sandwiches',  '[sample] Jam',              1.0),
      ('[sample] Standard Weekend Camp', 1, 'Cheese and jam sandwiches',  '[sample] Butter',           0.2),
      ('[sample] Standard Weekend Camp', 1, 'Cheese and jam sandwiches',  '[sample] Apples',           1.5),
      ('[sample] Standard Weekend Camp', 1, 'Rusks and tea',              '[sample] Rusks',            1.0),
      ('[sample] Standard Weekend Camp', 1, 'Rusks and tea',              '[sample] Tea Bags',         12.0),
      ('[sample] Standard Weekend Camp', 1, 'Rusks and tea',              '[sample] Milk',             0.5),
      ('[sample] Standard Weekend Camp', 1, 'Chicken potjie with rice',   '[sample] Chicken Pieces',   2.0),
      ('[sample] Standard Weekend Camp', 1, 'Chicken potjie with rice',   '[sample] Rice',             1.2),
      ('[sample] Standard Weekend Camp', 1, 'Chicken potjie with rice',   '[sample] Chopped Tomatoes', 4.0),
      ('[sample] Standard Weekend Camp', 1, 'Chicken potjie with rice',   '[sample] Onions',           0.7),
      ('[sample] Standard Weekend Camp', 1, 'Chicken potjie with rice',   '[sample] Carrots',          1.0),
      ('[sample] Standard Weekend Camp', 1, 'Chicken potjie with rice',   '[sample] Potatoes',         1.5),
      ('[sample] Standard Weekend Camp', 1, 'Chicken potjie with rice',   '[sample] Stock Cubes',      4.0),
      ('[sample] Standard Weekend Camp', 1, 'Chicken potjie with rice',   '[sample] Cooking Oil',      0.2),
      ('[sample] Standard Weekend Camp', 2, 'Eggs, boerewors and toast',  '[sample] Eggs',             24.0),
      ('[sample] Standard Weekend Camp', 2, 'Eggs, boerewors and toast',  '[sample] Boerewors',        1.5),
      ('[sample] Standard Weekend Camp', 2, 'Eggs, boerewors and toast',  '[sample] Bread',            2.0),
      ('[sample] Standard Weekend Camp', 2, 'Eggs, boerewors and toast',  '[sample] Butter',           0.2),
      ('[sample] Standard Weekend Camp', 2, 'Eggs, boerewors and toast',  '[sample] Tomato Sauce',     1.0),
      ('[sample] Standard Weekend Camp', 2, 'Eggs, boerewors and toast',  '[sample] Coffee',           150.0),
      ('[sample] Standard Weekend Camp', 2, 'Leftovers and bread',        '[sample] Bread',            2.0),
      ('[sample] Standard Weekend Camp', 2, 'Leftovers and bread',        '[sample] Butter',           0.15),
      ('[sample] Standard Weekend Camp', 2, 'Leftovers and bread',        '[sample] Milk',             1.0),

      -- ---- Lightweight Hike (8) --------------------------------------
      ('[sample] Lightweight Hike',      1, 'Oats with hot water',        '[sample] Oats',             0.5),
      ('[sample] Lightweight Hike',      1, 'Oats with hot water',        '[sample] Powdered Milk',    100.0),
      ('[sample] Lightweight Hike',      1, 'Oats with hot water',        '[sample] Sugar',            0.15),
      ('[sample] Lightweight Hike',      1, 'Oats with hot water',        '[sample] Raisins',          0.2),
      ('[sample] Lightweight Hike',      1, 'Trail lunch',                '[sample] Provitas',         2.0),
      ('[sample] Lightweight Hike',      1, 'Trail lunch',                '[sample] Peanut Butter',    1.0),
      ('[sample] Lightweight Hike',      1, 'Trail lunch',                '[sample] Biltong',          0.4),
      ('[sample] Lightweight Hike',      1, 'Trail lunch',                '[sample] Trail Mix',        0.5),
      ('[sample] Lightweight Hike',      1, 'Pasta with tinned tomato and tuna', '[sample] Pasta',     0.8),
      ('[sample] Lightweight Hike',      1, 'Pasta with tinned tomato and tuna', '[sample] Chopped Tomatoes', 3.0),
      ('[sample] Lightweight Hike',      1, 'Pasta with tinned tomato and tuna', '[sample] Tuna',      2.0),
      ('[sample] Lightweight Hike',      1, 'Pasta with tinned tomato and tuna', '[sample] Stock Cubes', 2.0),
      ('[sample] Lightweight Hike',      1, 'Pasta with tinned tomato and tuna', '[sample] Mixed Herbs', 20.0),
      ('[sample] Lightweight Hike',      2, 'Oats and hot chocolate',     '[sample] Oats',             0.5),
      ('[sample] Lightweight Hike',      2, 'Oats and hot chocolate',     '[sample] Hot Chocolate',    160.0),
      ('[sample] Lightweight Hike',      2, 'Oats and hot chocolate',     '[sample] Powdered Milk',    100.0),
      ('[sample] Lightweight Hike',      2, 'Trail lunch',                '[sample] Provitas',         2.0),
      ('[sample] Lightweight Hike',      2, 'Trail lunch',                '[sample] Trail Mix',        0.5),
      ('[sample] Lightweight Hike',      2, 'Trail lunch',                '[sample] Biltong',          0.3),

      -- ---- Day Trip (12) ---------------------------------------------
      ('[sample] Day Trip',              1, 'Sandwiches and fruit',       '[sample] Bread',            3.0),
      ('[sample] Day Trip',              1, 'Sandwiches and fruit',       '[sample] Cheddar Cheese',   0.4),
      ('[sample] Day Trip',              1, 'Sandwiches and fruit',       '[sample] Butter',           0.2),
      ('[sample] Day Trip',              1, 'Sandwiches and fruit',       '[sample] Apples',           1.5),
      ('[sample] Day Trip',              1, 'Sandwiches and fruit',       '[sample] Juice Concentrate', 1.0),
      ('[sample] Day Trip',              1, 'Marshmallows over the fire', '[sample] Marshmallows',     3.0),
      ('[sample] Day Trip',              1, 'Marshmallows over the fire', '[sample] Biscuits',         2.0),
      ('[sample] Day Trip',              1, 'Marshmallows over the fire', '[sample] Chocolate Slabs',  4.0),

      -- ---- Braai Weekend (20) ----------------------------------------
      ('[sample] Braai Weekend',         1, 'Bacon, eggs and toast',      '[sample] Bacon',            1.0),
      ('[sample] Braai Weekend',         1, 'Bacon, eggs and toast',      '[sample] Eggs',             40.0),
      ('[sample] Braai Weekend',         1, 'Bacon, eggs and toast',      '[sample] Bread',            4.0),
      ('[sample] Braai Weekend',         1, 'Bacon, eggs and toast',      '[sample] Butter',           0.3),
      ('[sample] Braai Weekend',         1, 'Bacon, eggs and toast',      '[sample] Coffee',           250.0),
      ('[sample] Braai Weekend',         1, 'Bacon, eggs and toast',      '[sample] Milk',             2.0),
      ('[sample] Braai Weekend',         1, 'Bacon, eggs and toast',      '[sample] Tea Bags',         20.0),
      ('[sample] Braai Weekend',         1, 'Rolls with cheese and salad', '[sample] Bread Rolls',     40.0),
      ('[sample] Braai Weekend',         1, 'Rolls with cheese and salad', '[sample] Cheddar Cheese',  0.6),
      ('[sample] Braai Weekend',         1, 'Rolls with cheese and salad', '[sample] Tomatoes',        1.0),
      ('[sample] Braai Weekend',         1, 'Rolls with cheese and salad', '[sample] Lettuce',         2.0),
      ('[sample] Braai Weekend',         1, 'Rolls with cheese and salad', '[sample] Mayonnaise',      1.0),
      ('[sample] Braai Weekend',         1, 'Braai with pap and chakalaka', '[sample] Boerewors',      4.0),
      ('[sample] Braai Weekend',         1, 'Braai with pap and chakalaka', '[sample] Braai Chops',    3.0),
      ('[sample] Braai Weekend',         1, 'Braai with pap and chakalaka', '[sample] Maize Meal',     1.4),
      ('[sample] Braai Weekend',         1, 'Braai with pap and chakalaka', '[sample] Chakalaka',      5.0),
      ('[sample] Braai Weekend',         1, 'Braai with pap and chakalaka', '[sample] Braai Spice',    100.0),
      ('[sample] Braai Weekend',         1, 'Braai with pap and chakalaka', '[sample] Tomato Sauce',   1.0),
      ('[sample] Braai Weekend',         1, 'Marshmallows at the fire',   '[sample] Marshmallows',     5.0),
      ('[sample] Braai Weekend',         1, 'Marshmallows at the fire',   '[sample] Hot Chocolate',    400.0),
      ('[sample] Braai Weekend',         1, 'Marshmallows at the fire',   '[sample] Milk',             3.0),
      ('[sample] Braai Weekend',         2, 'French toast and syrup',     '[sample] Bread',            4.0),
      ('[sample] Braai Weekend',         2, 'French toast and syrup',     '[sample] Eggs',             30.0),
      ('[sample] Braai Weekend',         2, 'French toast and syrup',     '[sample] Milk',             1.5),
      ('[sample] Braai Weekend',         2, 'French toast and syrup',     '[sample] Syrup',            1.0),
      ('[sample] Braai Weekend',         2, 'French toast and syrup',     '[sample] Butter',           0.4),
      ('[sample] Braai Weekend',         2, 'French toast and syrup',     '[sample] Coffee',           250.0),
      ('[sample] Braai Weekend',         2, 'Braai leftovers in rolls',   '[sample] Bread Rolls',      30.0),
      ('[sample] Braai Weekend',         2, 'Braai leftovers in rolls',   '[sample] Tomato Sauce',     1.0),
      ('[sample] Braai Weekend',         2, 'Braai leftovers in rolls',   '[sample] Mayonnaise',       1.0),

      -- ---- Summer Camp, 5 days (24) ----------------------------------
      ('[sample] Summer Camp (5 days)',  1, 'Oats and fruit',             '[sample] Oats',             1.5),
      ('[sample] Summer Camp (5 days)',  1, 'Oats and fruit',             '[sample] Milk',             4.0),
      ('[sample] Summer Camp (5 days)',  1, 'Oats and fruit',             '[sample] Sugar',            0.5),
      ('[sample] Summer Camp (5 days)',  1, 'Oats and fruit',             '[sample] Bananas',          24.0),
      ('[sample] Summer Camp (5 days)',  1, 'Oats and fruit',             '[sample] Coffee',           300.0),
      ('[sample] Summer Camp (5 days)',  1, 'Oats and fruit',             '[sample] Tea Bags',         24.0),
      ('[sample] Summer Camp (5 days)',  1, 'Sandwiches',                 '[sample] Bread',            6.0),
      ('[sample] Summer Camp (5 days)',  1, 'Sandwiches',                 '[sample] Cheddar Cheese',   0.8),
      ('[sample] Summer Camp (5 days)',  1, 'Sandwiches',                 '[sample] Jam',              2.0),
      ('[sample] Summer Camp (5 days)',  1, 'Sandwiches',                 '[sample] Butter',           0.4),
      ('[sample] Summer Camp (5 days)',  1, 'Spaghetti bolognaise',       '[sample] Pasta',            2.4),
      ('[sample] Summer Camp (5 days)',  1, 'Spaghetti bolognaise',       '[sample] Mince',            3.0),
      ('[sample] Summer Camp (5 days)',  1, 'Spaghetti bolognaise',       '[sample] Chopped Tomatoes', 8.0),
      ('[sample] Summer Camp (5 days)',  1, 'Spaghetti bolognaise',       '[sample] Onions',           1.4),
      ('[sample] Summer Camp (5 days)',  1, 'Spaghetti bolognaise',       '[sample] Stock Cubes',      6.0),
      ('[sample] Summer Camp (5 days)',  1, 'Spaghetti bolognaise',       '[sample] Mixed Herbs',      30.0),
      ('[sample] Summer Camp (5 days)',  1, 'Spaghetti bolognaise',       '[sample] Cheddar Cheese',   0.5),
      ('[sample] Summer Camp (5 days)',  2, 'Eggs and bacon',             '[sample] Eggs',             48.0),
      ('[sample] Summer Camp (5 days)',  2, 'Eggs and bacon',             '[sample] Bacon',            1.2),
      ('[sample] Summer Camp (5 days)',  2, 'Eggs and bacon',             '[sample] Bread',            4.0),
      ('[sample] Summer Camp (5 days)',  2, 'Eggs and bacon',             '[sample] Butter',           0.4),
      ('[sample] Summer Camp (5 days)',  2, 'Eggs and bacon',             '[sample] Coffee',           300.0),
      ('[sample] Summer Camp (5 days)',  2, 'Tuna mayo rolls',            '[sample] Bread Rolls',      48.0),
      ('[sample] Summer Camp (5 days)',  2, 'Tuna mayo rolls',            '[sample] Tuna',             6.0),
      ('[sample] Summer Camp (5 days)',  2, 'Tuna mayo rolls',            '[sample] Mayonnaise',       1.0),
      ('[sample] Summer Camp (5 days)',  2, 'Tuna mayo rolls',            '[sample] Lettuce',          2.0),
      ('[sample] Summer Camp (5 days)',  2, 'Chicken curry and rice',     '[sample] Chicken Pieces',   4.0),
      ('[sample] Summer Camp (5 days)',  2, 'Chicken curry and rice',     '[sample] Rice',             2.4),
      ('[sample] Summer Camp (5 days)',  2, 'Chicken curry and rice',     '[sample] Curry Powder',     120.0),
      ('[sample] Summer Camp (5 days)',  2, 'Chicken curry and rice',     '[sample] Onions',           1.4),
      ('[sample] Summer Camp (5 days)',  2, 'Chicken curry and rice',     '[sample] Chopped Tomatoes', 6.0),
      ('[sample] Summer Camp (5 days)',  2, 'Chicken curry and rice',     '[sample] Cooking Oil',      0.4),
      ('[sample] Summer Camp (5 days)',  3, 'Pancakes',                   '[sample] Flour',            2.0),
      ('[sample] Summer Camp (5 days)',  3, 'Pancakes',                   '[sample] Eggs',             24.0),
      ('[sample] Summer Camp (5 days)',  3, 'Pancakes',                   '[sample] Milk',             4.0),
      ('[sample] Summer Camp (5 days)',  3, 'Pancakes',                   '[sample] Sugar',            0.6),
      ('[sample] Summer Camp (5 days)',  3, 'Pancakes',                   '[sample] Cooking Oil',      0.3),
      ('[sample] Summer Camp (5 days)',  3, 'Pancakes',                   '[sample] Syrup',            1.0),
      ('[sample] Summer Camp (5 days)',  3, 'Soup and bread',             '[sample] Soup Powder',      6.0),
      ('[sample] Summer Camp (5 days)',  3, 'Soup and bread',             '[sample] Bread',            5.0),
      ('[sample] Summer Camp (5 days)',  3, 'Soup and bread',             '[sample] Butter',           0.4),
      ('[sample] Summer Camp (5 days)',  3, 'Braai with pap and chakalaka', '[sample] Boerewors',      4.5),
      ('[sample] Summer Camp (5 days)',  3, 'Braai with pap and chakalaka', '[sample] Braai Chops',    3.5),
      ('[sample] Summer Camp (5 days)',  3, 'Braai with pap and chakalaka', '[sample] Maize Meal',     1.7),
      ('[sample] Summer Camp (5 days)',  3, 'Braai with pap and chakalaka', '[sample] Chakalaka',      6.0),
      ('[sample] Summer Camp (5 days)',  3, 'Braai with pap and chakalaka', '[sample] Braai Spice',    120.0),
      ('[sample] Summer Camp (5 days)',  4, 'Oats and rusks',             '[sample] Oats',             1.5),
      ('[sample] Summer Camp (5 days)',  4, 'Oats and rusks',             '[sample] Milk',             4.0),
      ('[sample] Summer Camp (5 days)',  4, 'Oats and rusks',             '[sample] Rusks',            3.0),
      ('[sample] Summer Camp (5 days)',  4, 'Oats and rusks',             '[sample] Coffee',           300.0),
      ('[sample] Summer Camp (5 days)',  4, 'Wraps with leftovers',       '[sample] Bread',            5.0),
      ('[sample] Summer Camp (5 days)',  4, 'Wraps with leftovers',       '[sample] Cheddar Cheese',   0.6),
      ('[sample] Summer Camp (5 days)',  4, 'Wraps with leftovers',       '[sample] Tomatoes',         1.0),
      ('[sample] Summer Camp (5 days)',  4, 'Wraps with leftovers',       '[sample] Mayonnaise',       1.0),
      ('[sample] Summer Camp (5 days)',  4, 'Beef stew with potatoes',    '[sample] Stewing Beef',     3.5),
      ('[sample] Summer Camp (5 days)',  4, 'Beef stew with potatoes',    '[sample] Potatoes',         6.0),
      ('[sample] Summer Camp (5 days)',  4, 'Beef stew with potatoes',    '[sample] Carrots',          2.0),
      ('[sample] Summer Camp (5 days)',  4, 'Beef stew with potatoes',    '[sample] Onions',           1.4),
      ('[sample] Summer Camp (5 days)',  4, 'Beef stew with potatoes',    '[sample] Soup Powder',      3.0),
      ('[sample] Summer Camp (5 days)',  4, 'Beef stew with potatoes',    '[sample] Stock Cubes',      8.0),
      ('[sample] Summer Camp (5 days)',  5, 'French toast',               '[sample] Bread',            5.0),
      ('[sample] Summer Camp (5 days)',  5, 'French toast',               '[sample] Eggs',             36.0),
      ('[sample] Summer Camp (5 days)',  5, 'French toast',               '[sample] Milk',             2.0),
      ('[sample] Summer Camp (5 days)',  5, 'French toast',               '[sample] Syrup',            1.0),
      ('[sample] Summer Camp (5 days)',  5, 'French toast',               '[sample] Butter',           0.5),
      ('[sample] Summer Camp (5 days)',  5, 'Pack-up lunch',              '[sample] Bread',            4.0),
      ('[sample] Summer Camp (5 days)',  5, 'Pack-up lunch',              '[sample] Peanut Butter',    2.0),
      ('[sample] Summer Camp (5 days)',  5, 'Pack-up lunch',              '[sample] Jam',              1.0),
      ('[sample] Summer Camp (5 days)',  5, 'Pack-up lunch',              '[sample] Apples',           3.0),

      -- ---- Cub Camp (16) ---------------------------------------------
      ('[sample] Cub Camp',              1, 'Cereal and milk',            '[sample] Breakfast Cereal', 3.0),
      ('[sample] Cub Camp',              1, 'Cereal and milk',            '[sample] Milk',             3.0),
      ('[sample] Cub Camp',              1, 'Cereal and milk',            '[sample] Sugar',            0.25),
      ('[sample] Cub Camp',              1, 'Cereal and milk',            '[sample] Bananas',          16.0),
      ('[sample] Cub Camp',              1, 'Hot dogs',                   '[sample] Vienna Sausages',  3.0),
      ('[sample] Cub Camp',              1, 'Hot dogs',                   '[sample] Bread Rolls',      32.0),
      ('[sample] Cub Camp',              1, 'Hot dogs',                   '[sample] Tomato Sauce',     1.0),
      ('[sample] Cub Camp',              1, 'Fruit and biscuits',         '[sample] Apples',           2.0),
      ('[sample] Cub Camp',              1, 'Fruit and biscuits',         '[sample] Biscuits',         3.0),
      ('[sample] Cub Camp',              1, 'Fruit and biscuits',         '[sample] Juice Concentrate', 1.0),
      ('[sample] Cub Camp',              1, 'Foil-packet chicken and veg', '[sample] Chicken Pieces',  2.5),
      ('[sample] Cub Camp',              1, 'Foil-packet chicken and veg', '[sample] Potatoes',        4.0),
      ('[sample] Cub Camp',              1, 'Foil-packet chicken and veg', '[sample] Carrots',         1.2),
      ('[sample] Cub Camp',              1, 'Foil-packet chicken and veg', '[sample] Onions',          1.0),
      ('[sample] Cub Camp',              1, 'Foil-packet chicken and veg', '[sample] Butter',          0.3),
      ('[sample] Cub Camp',              1, 'Foil-packet chicken and veg', '[sample] Braai Spice',     80.0),
      ('[sample] Cub Camp',              1, 'S''mores at the campfire',   '[sample] Marshmallows',     4.0),
      ('[sample] Cub Camp',              1, 'S''mores at the campfire',   '[sample] Biscuits',         2.0),
      ('[sample] Cub Camp',              1, 'S''mores at the campfire',   '[sample] Chocolate Slabs',  4.0),
      ('[sample] Cub Camp',              2, 'Scrambled eggs on toast',    '[sample] Eggs',             32.0),
      ('[sample] Cub Camp',              2, 'Scrambled eggs on toast',    '[sample] Bread',            4.0),
      ('[sample] Cub Camp',              2, 'Scrambled eggs on toast',    '[sample] Butter',           0.3),
      ('[sample] Cub Camp',              2, 'Scrambled eggs on toast',    '[sample] Milk',             0.5),
      ('[sample] Cub Camp',              2, 'Sandwiches and fruit',       '[sample] Bread',            4.0),
      ('[sample] Cub Camp',              2, 'Sandwiches and fruit',       '[sample] Peanut Butter',    1.0),
      ('[sample] Cub Camp',              2, 'Sandwiches and fruit',       '[sample] Jam',              1.0),
      ('[sample] Cub Camp',              2, 'Sandwiches and fruit',       '[sample] Apples',           2.0),

      -- ---- Vegetarian Weekend (12) -----------------------------------
      ('[sample] Vegetarian Weekend',    1, 'Oats with banana and syrup', '[sample] Oats',             0.75),
      ('[sample] Vegetarian Weekend',    1, 'Oats with banana and syrup', '[sample] Milk',             2.0),
      ('[sample] Vegetarian Weekend',    1, 'Oats with banana and syrup', '[sample] Bananas',          12.0),
      ('[sample] Vegetarian Weekend',    1, 'Oats with banana and syrup', '[sample] Syrup',            1.0),
      ('[sample] Vegetarian Weekend',    1, 'Oats with banana and syrup', '[sample] Coffee',           150.0),
      ('[sample] Vegetarian Weekend',    1, 'Cheese and tomato sandwiches', '[sample] Bread',          3.0),
      ('[sample] Vegetarian Weekend',    1, 'Cheese and tomato sandwiches', '[sample] Cheddar Cheese', 0.4),
      ('[sample] Vegetarian Weekend',    1, 'Cheese and tomato sandwiches', '[sample] Tomatoes',       0.8),
      ('[sample] Vegetarian Weekend',    1, 'Cheese and tomato sandwiches', '[sample] Butter',         0.2),
      ('[sample] Vegetarian Weekend',    1, 'Cheese and tomato sandwiches', '[sample] Mayonnaise',     1.0),
      ('[sample] Vegetarian Weekend',    1, 'Lentil and vegetable potjie with rice', '[sample] Brown Lentils', 0.9),
      ('[sample] Vegetarian Weekend',    1, 'Lentil and vegetable potjie with rice', '[sample] Rice',   1.2),
      ('[sample] Vegetarian Weekend',    1, 'Lentil and vegetable potjie with rice', '[sample] Chopped Tomatoes', 4.0),
      ('[sample] Vegetarian Weekend',    1, 'Lentil and vegetable potjie with rice', '[sample] Onions', 0.7),
      ('[sample] Vegetarian Weekend',    1, 'Lentil and vegetable potjie with rice', '[sample] Carrots', 1.0),
      ('[sample] Vegetarian Weekend',    1, 'Lentil and vegetable potjie with rice', '[sample] Potatoes', 1.5),
      ('[sample] Vegetarian Weekend',    1, 'Lentil and vegetable potjie with rice', '[sample] Stock Cubes', 4.0),
      ('[sample] Vegetarian Weekend',    1, 'Lentil and vegetable potjie with rice', '[sample] Curry Powder', 40.0),
      ('[sample] Vegetarian Weekend',    2, 'Scrambled eggs on toast',    '[sample] Eggs',             24.0),
      ('[sample] Vegetarian Weekend',    2, 'Scrambled eggs on toast',    '[sample] Bread',            3.0),
      ('[sample] Vegetarian Weekend',    2, 'Scrambled eggs on toast',    '[sample] Butter',           0.25),
      ('[sample] Vegetarian Weekend',    2, 'Scrambled eggs on toast',    '[sample] Cheddar Cheese',   0.2),
      ('[sample] Vegetarian Weekend',    2, 'Bean and sweetcorn wraps',   '[sample] Kidney Beans',     4.0),
      ('[sample] Vegetarian Weekend',    2, 'Bean and sweetcorn wraps',   '[sample] Sweetcorn',        3.0),
      ('[sample] Vegetarian Weekend',    2, 'Bean and sweetcorn wraps',   '[sample] Bread',            3.0),
      ('[sample] Vegetarian Weekend',    2, 'Bean and sweetcorn wraps',   '[sample] Cheddar Cheese',   0.3),
      ('[sample] Vegetarian Weekend',    2, 'Bean and sweetcorn wraps',   '[sample] Tomato Sauce',     1.0),

      -- ---- Backwoods Cooking Day (12) --------------------------------
      ('[sample] Backwoods Cooking Day', 1, 'Foil-packet chicken and veg', '[sample] Chicken Pieces',  2.0),
      ('[sample] Backwoods Cooking Day', 1, 'Foil-packet chicken and veg', '[sample] Potatoes',        3.0),
      ('[sample] Backwoods Cooking Day', 1, 'Foil-packet chicken and veg', '[sample] Carrots',         1.0),
      ('[sample] Backwoods Cooking Day', 1, 'Foil-packet chicken and veg', '[sample] Onions',          0.7),
      ('[sample] Backwoods Cooking Day', 1, 'Foil-packet chicken and veg', '[sample] Butter',          0.2),
      ('[sample] Backwoods Cooking Day', 1, 'Foil-packet chicken and veg', '[sample] Braai Spice',     60.0),
      ('[sample] Backwoods Cooking Day', 1, 'Stokbrood over the coals',   '[sample] Flour',            1.5),
      ('[sample] Backwoods Cooking Day', 1, 'Stokbrood over the coals',   '[sample] Butter',           0.3),
      ('[sample] Backwoods Cooking Day', 1, 'Stokbrood over the coals',   '[sample] Salt',             0.05),
      ('[sample] Backwoods Cooking Day', 1, 'Stokbrood over the coals',   '[sample] Jam',              1.0),
      ('[sample] Backwoods Cooking Day', 1, 'Braaibroodjies and hot chocolate', '[sample] Bread',      3.0),
      ('[sample] Backwoods Cooking Day', 1, 'Braaibroodjies and hot chocolate', '[sample] Cheddar Cheese', 0.5),
      ('[sample] Backwoods Cooking Day', 1, 'Braaibroodjies and hot chocolate', '[sample] Tomatoes',   0.6),
      ('[sample] Backwoods Cooking Day', 1, 'Braaibroodjies and hot chocolate', '[sample] Onions',     0.3),
      ('[sample] Backwoods Cooking Day', 1, 'Braaibroodjies and hot chocolate', '[sample] Butter',     0.25),
      ('[sample] Backwoods Cooking Day', 1, 'Braaibroodjies and hot chocolate', '[sample] Hot Chocolate', 240.0),
      ('[sample] Backwoods Cooking Day', 1, 'Braaibroodjies and hot chocolate', '[sample] Milk',       2.0),

      -- ---- Winter Camp (16) ------------------------------------------
      ('[sample] Winter Camp',           1, 'Mieliepap with syrup',       '[sample] Maize Meal',       1.2),
      ('[sample] Winter Camp',           1, 'Mieliepap with syrup',       '[sample] Milk',             2.0),
      ('[sample] Winter Camp',           1, 'Mieliepap with syrup',       '[sample] Syrup',            1.0),
      ('[sample] Winter Camp',           1, 'Mieliepap with syrup',       '[sample] Sugar',            0.3),
      ('[sample] Winter Camp',           1, 'Mieliepap with syrup',       '[sample] Coffee',           200.0),
      ('[sample] Winter Camp',           1, 'Mieliepap with syrup',       '[sample] Tea Bags',         16.0),
      ('[sample] Winter Camp',           1, 'Soup and bread rolls',       '[sample] Soup Powder',      4.0),
      ('[sample] Winter Camp',           1, 'Soup and bread rolls',       '[sample] Bread Rolls',      32.0),
      ('[sample] Winter Camp',           1, 'Soup and bread rolls',       '[sample] Butter',           0.3),
      ('[sample] Winter Camp',           1, 'Soup and bread rolls',       '[sample] Cheddar Cheese',   0.3),
      ('[sample] Winter Camp',           1, 'Beef stew with potatoes',    '[sample] Stewing Beef',     2.4),
      ('[sample] Winter Camp',           1, 'Beef stew with potatoes',    '[sample] Potatoes',         4.0),
      ('[sample] Winter Camp',           1, 'Beef stew with potatoes',    '[sample] Carrots',          1.3),
      ('[sample] Winter Camp',           1, 'Beef stew with potatoes',    '[sample] Onions',           1.0),
      ('[sample] Winter Camp',           1, 'Beef stew with potatoes',    '[sample] Stock Cubes',      6.0),
      ('[sample] Winter Camp',           1, 'Beef stew with potatoes',    '[sample] Soup Powder',      2.0),
      ('[sample] Winter Camp',           1, 'Beef stew with potatoes',    '[sample] Cooking Oil',      0.2),
      ('[sample] Winter Camp',           1, 'Hot chocolate before lights out', '[sample] Hot Chocolate', 320.0),
      ('[sample] Winter Camp',           1, 'Hot chocolate before lights out', '[sample] Milk',        3.0),
      ('[sample] Winter Camp',           1, 'Hot chocolate before lights out', '[sample] Biscuits',    2.0),
      ('[sample] Winter Camp',           2, 'Bacon, eggs, beans and toast', '[sample] Bacon',          0.8),
      ('[sample] Winter Camp',           2, 'Bacon, eggs, beans and toast', '[sample] Eggs',           32.0),
      ('[sample] Winter Camp',           2, 'Bacon, eggs, beans and toast', '[sample] Baked Beans',    6.0),
      ('[sample] Winter Camp',           2, 'Bacon, eggs, beans and toast', '[sample] Bread',          4.0),
      ('[sample] Winter Camp',           2, 'Bacon, eggs, beans and toast', '[sample] Butter',         0.3),
      ('[sample] Winter Camp',           2, 'Bacon, eggs, beans and toast', '[sample] Coffee',         200.0),
      ('[sample] Winter Camp',           2, 'Toasted cheese sandwiches',  '[sample] Bread',            4.0),
      ('[sample] Winter Camp',           2, 'Toasted cheese sandwiches',  '[sample] Cheddar Cheese',   0.6),
      ('[sample] Winter Camp',           2, 'Toasted cheese sandwiches',  '[sample] Butter',           0.35),
      ('[sample] Winter Camp',           2, 'Toasted cheese sandwiches',  '[sample] Tomatoes',         0.6),

      -- ---- Backpacking Trek, 3 days (6) ------------------------------
      ('[sample] Backpacking Trek (3 days)', 1, 'Oats with raisins',      '[sample] Oats',             0.4),
      ('[sample] Backpacking Trek (3 days)', 1, 'Oats with raisins',      '[sample] Powdered Milk',    80.0),
      ('[sample] Backpacking Trek (3 days)', 1, 'Oats with raisins',      '[sample] Sugar',            0.1),
      ('[sample] Backpacking Trek (3 days)', 1, 'Oats with raisins',      '[sample] Raisins',          0.15),
      ('[sample] Backpacking Trek (3 days)', 1, 'Trail lunch',            '[sample] Provitas',         2.0),
      ('[sample] Backpacking Trek (3 days)', 1, 'Trail lunch',            '[sample] Peanut Butter',    1.0),
      ('[sample] Backpacking Trek (3 days)', 1, 'Trail lunch',            '[sample] Biltong',          0.3),
      ('[sample] Backpacking Trek (3 days)', 1, 'Instant noodles with tuna', '[sample] Instant Noodles', 12.0),
      ('[sample] Backpacking Trek (3 days)', 1, 'Instant noodles with tuna', '[sample] Tuna',          3.0),
      ('[sample] Backpacking Trek (3 days)', 1, 'Instant noodles with tuna', '[sample] Stock Cubes',   3.0),
      ('[sample] Backpacking Trek (3 days)', 2, 'Oats and hot chocolate', '[sample] Oats',             0.4),
      ('[sample] Backpacking Trek (3 days)', 2, 'Oats and hot chocolate', '[sample] Hot Chocolate',    120.0),
      ('[sample] Backpacking Trek (3 days)', 2, 'Oats and hot chocolate', '[sample] Powdered Milk',    80.0),
      ('[sample] Backpacking Trek (3 days)', 2, 'Trail lunch',            '[sample] Provitas',         2.0),
      ('[sample] Backpacking Trek (3 days)', 2, 'Trail lunch',            '[sample] Trail Mix',        0.4),
      ('[sample] Backpacking Trek (3 days)', 2, 'Trail lunch',            '[sample] Chocolate Slabs',  3.0),
      ('[sample] Backpacking Trek (3 days)', 2, 'Couscous with lentils and soup', '[sample] Couscous', 0.6),
      ('[sample] Backpacking Trek (3 days)', 2, 'Couscous with lentils and soup', '[sample] Brown Lentils', 0.3),
      ('[sample] Backpacking Trek (3 days)', 2, 'Couscous with lentils and soup', '[sample] Soup Powder', 2.0),
      ('[sample] Backpacking Trek (3 days)', 2, 'Couscous with lentils and soup', '[sample] Stock Cubes', 3.0),
      ('[sample] Backpacking Trek (3 days)', 2, 'Couscous with lentils and soup', '[sample] Cooking Oil', 0.1),
      ('[sample] Backpacking Trek (3 days)', 3, 'Oats and coffee',        '[sample] Oats',             0.4),
      ('[sample] Backpacking Trek (3 days)', 3, 'Oats and coffee',        '[sample] Powdered Milk',    80.0),
      ('[sample] Backpacking Trek (3 days)', 3, 'Oats and coffee',        '[sample] Coffee',           80.0),
      ('[sample] Backpacking Trek (3 days)', 3, 'Oats and coffee',        '[sample] Sugar',            0.1),
      ('[sample] Backpacking Trek (3 days)', 3, 'Trail lunch',            '[sample] Trail Mix',        0.4),
      ('[sample] Backpacking Trek (3 days)', 3, 'Trail lunch',            '[sample] Biltong',          0.25),
      ('[sample] Backpacking Trek (3 days)', 3, 'Trail lunch',            '[sample] Raisins',          0.2),

      -- ---- Hall Sleepover (20) ---------------------------------------
      ('[sample] Hall Sleepover',        1, 'Spaghetti bolognaise',       '[sample] Pasta',            2.0),
      ('[sample] Hall Sleepover',        1, 'Spaghetti bolognaise',       '[sample] Mince',            2.4),
      ('[sample] Hall Sleepover',        1, 'Spaghetti bolognaise',       '[sample] Chopped Tomatoes', 7.0),
      ('[sample] Hall Sleepover',        1, 'Spaghetti bolognaise',       '[sample] Onions',           1.2),
      ('[sample] Hall Sleepover',        1, 'Spaghetti bolognaise',       '[sample] Stock Cubes',      5.0),
      ('[sample] Hall Sleepover',        1, 'Spaghetti bolognaise',       '[sample] Mixed Herbs',      25.0),
      ('[sample] Hall Sleepover',        1, 'Spaghetti bolognaise',       '[sample] Cheddar Cheese',   0.4),
      ('[sample] Hall Sleepover',        1, 'Hot chocolate and biscuits', '[sample] Hot Chocolate',    400.0),
      ('[sample] Hall Sleepover',        1, 'Hot chocolate and biscuits', '[sample] Milk',             4.0),
      ('[sample] Hall Sleepover',        1, 'Hot chocolate and biscuits', '[sample] Biscuits',         3.0),
      ('[sample] Hall Sleepover',        2, 'Cereal and toast',           '[sample] Breakfast Cereal', 4.0),
      ('[sample] Hall Sleepover',        2, 'Cereal and toast',           '[sample] Milk',             4.0),
      ('[sample] Hall Sleepover',        2, 'Cereal and toast',           '[sample] Bread',            4.0),
      ('[sample] Hall Sleepover',        2, 'Cereal and toast',           '[sample] Butter',           0.3),
      ('[sample] Hall Sleepover',        2, 'Cereal and toast',           '[sample] Jam',              1.0),
      ('[sample] Hall Sleepover',        2, 'Cereal and toast',           '[sample] Coffee',           250.0)
  ) as v(menu_name, day, meal_name, food_name, qty)
    on v.menu_name = mn.name and v.day = ml.day_number and v.meal_name = ml.name
  join public.food_items f on f.name = v.food_name
 where mn.event_id is null;

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
  where event_id in (select id from public.events where name like '[sample]%')
union all select 'equipment_loans', count(*) from public.equipment_loans
  where equipment_id in (select id from public.equipment where name like '[sample]%')
union all select 'menus (presets)', count(*) from public.menus where name like '[sample]%'
union all select 'menu_meals',      count(*) from public.menu_meals
  where menu_id in (select id from public.menus where name like '[sample]%')
union all select 'menu_meal_items', count(*) from public.menu_meal_items
  where meal_id in (select id from public.menu_meals
                     where menu_id in (select id from public.menus where name like '[sample]%'));

-- ---------------------------------------------------------------------
-- Should come back empty.
--
-- Ingredients are matched to meals and to the food store by name, and an
-- inner join drops a row it can't match instead of complaining. A meal that
-- ends up with nothing in it is how a typo in either name shows itself.
-- ---------------------------------------------------------------------
select mn.name as menu, ml.day_number, ml.name as meal_with_no_ingredients
  from public.menu_meals ml
  join public.menus mn on mn.id = ml.menu_id
 where mn.name like '[sample]%'
   and not exists (select 1 from public.menu_meal_items i where i.meal_id = ml.id)
 order by mn.name, ml.day_number;
