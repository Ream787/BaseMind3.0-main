-- ======================================================================
-- BaseMind Lab — demonstration data.
--
-- Optional. Run it to see the new pages with something in them; skip it
-- and every page still works, empty.
--
-- Everything inserted here is invented. The names are not real young
-- people, and nothing in the medical or contact columns describes anyone.
-- That matters more than usual for this schema: `lab.members` is the one
-- place in BaseMind that holds details about children, so the sample data
-- must obviously be sample data.
--
-- Rows that need a camp or a piece of equipment are guarded — if the
-- app's own tables are empty, those sections are skipped rather than
-- failing the whole file.
--
-- To undo just the demonstration data, run remove_lab_seed.sql.
-- Everything here is tagged so it can be found again.
-- ======================================================================

-- ---------------------------------------------------------------------
-- Patrols. Six, in six of the eight avatar hues.
-- ---------------------------------------------------------------------
insert into lab.patrols (name, colour, motto, emblem, sort_order) values
  ('Eagles',   1, 'Higher and further',      'bird',     1),
  ('Foxes',    3, 'Quick and quiet',         'fox',      2),
  ('Otters',   2, 'Never dry, never still',  'wave',     3),
  ('Badgers',  4, 'Dig in',                  'leaf',     4),
  ('Kestrels', 5, 'Watch, then act',         'feather',  5),
  ('Ravens',   6, 'Loud on purpose',         'moon',     6);

-- ---------------------------------------------------------------------
-- Members.
--
-- Spread across the patrols, with a handful of the awkward cases a real
-- roster has: no patrol yet, a long medical note, an empty parent phone.
-- Pages that only ever get tidy data are pages that break on Thursday.
-- ---------------------------------------------------------------------
insert into lab.members
  (first_name, last_name, patrol_id, date_of_birth, joined_on, rank,
   parent_name, parent_phone, parent_email, medical_notes, dietary_notes,
   allergies, photo_consent, swim_ability, notes)
select v.first_name, v.last_name, p.id, v.dob::date, v.joined::date, v.rank,
       v.parent, v.phone, v.email, v.medical, v.dietary, v.allergies,
       v.consent, v.swim, v.notes
  from (values
    ('Amara',  'Bello',    'Eagles',   '2013-03-04', '2024-09-10', 'Patrol Leader',
     'J. Bello',   '07700 900101', 'bello@example.invalid', null, null, null, true, 'Confident', 'Keen on climbing'),
    ('Tom',    'Ferreira', 'Eagles',   '2013-11-22', '2024-09-10', 'Second',
     'M. Ferreira','07700 900102', 'ferreira@example.invalid', 'Inhaler — carries his own, blue, in his day sack.', null, 'Pollen', true, 'Confident', null),
    ('Nia',    'Okafor',   'Eagles',   '2014-01-30', '2025-01-14', null,
     'C. Okafor',  '07700 900103', null, null, 'Vegetarian', null, true, 'Weak', null),
    ('Jonas',  'Petersen', 'Eagles',   '2014-06-18', '2025-01-14', null,
     'K. Petersen','07700 900104', 'petersen@example.invalid', null, null, null, false, 'Confident', 'Photo consent not given — check before posting anything'),

    ('Ruby',   'Sandberg', 'Foxes',    '2013-05-09', '2024-09-10', 'Patrol Leader',
     'L. Sandberg','07700 900105', 'sandberg@example.invalid', null, 'No pork', null, true, 'Confident', null),
    ('Ewan',   'MacLeod',  'Foxes',    '2013-08-27', '2024-09-10', 'Second',
     'S. MacLeod', '07700 900106', null, null, null, 'Peanuts — EpiPen in the first aid box, plus one in his bag.', true, 'Average', null),
    ('Priya',  'Raman',    'Foxes',    '2014-02-11', '2025-03-04', null,
     'A. Raman',   '07700 900107', 'raman@example.invalid', null, 'Vegetarian', null, true, 'Confident', null),
    ('Callum', 'Hughes',   'Foxes',    '2014-09-02', '2025-03-04', null,
     'D. Hughes',  null,           'hughes@example.invalid', null, null, null, true, 'Non-swimmer', 'No phone number on file — email only'),

    ('Sofia',  'Marchetti','Otters',   '2013-04-15', '2024-09-10', 'Patrol Leader',
     'R. Marchetti','07700 900108','marchetti@example.invalid', null, null, null, true, 'Confident', 'Swims for the county'),
    ('Ben',    'Achterberg','Otters',  '2013-12-01', '2024-11-05', null,
     'T. Achterberg','07700 900109', null, 'Wears hearing aids. Get his attention before giving instructions; he lip-reads well in good light.', null, null, true, 'Average', null),
    ('Leila',  'Haddad',   'Otters',   '2014-07-19', '2025-01-14', null,
     'N. Haddad',  '07700 900110', 'haddad@example.invalid', null, 'Halal', null, true, 'Confident', null),
    ('Marcus', 'Dube',     'Otters',   '2014-10-08', '2025-03-04', null,
     'P. Dube',    '07700 900111', null, null, null, null, false, 'Weak', null),

    ('Hana',   'Yoshida',  'Badgers',  '2013-06-25', '2024-09-10', 'Patrol Leader',
     'E. Yoshida', '07700 900112', 'yoshida@example.invalid', null, null, null, true, 'Confident', null),
    ('Freddie','Osei',     'Badgers',  '2013-10-13', '2024-09-10', 'Second',
     'B. Osei',    '07700 900113', null, null, null, null, true, 'Average', null),
    ('Iris',   'Novak',    'Badgers',  '2014-03-21', '2025-01-14', null,
     'G. Novak',   '07700 900114', 'novak@example.invalid', 'Type 1 diabetes. Manages her own pump. Hypo kit lives in the green pouch — ask her where it is at the start of every camp.', null, null, true, 'Confident', null),
    ('Sam',    'Whitfield','Badgers',  '2014-08-30', '2025-03-04', null,
     'H. Whitfield','07700 900115', null, null, 'Coeliac', 'Gluten', true, 'Average', null),

    ('Zoya',   'Kaur',     'Kestrels', '2013-02-14', '2024-09-10', 'Patrol Leader',
     'V. Kaur',    '07700 900116', 'kaur@example.invalid', null, 'Vegetarian', null, true, 'Confident', null),
    ('Oli',    'Brennan',  'Kestrels', '2013-09-06', '2024-09-10', null,
     'F. Brennan', '07700 900117', null, null, null, null, true, 'Confident', null),
    ('Meera',  'Iyer',     'Kestrels', '2014-05-03', '2025-01-14', null,
     'W. Iyer',    '07700 900118', 'iyer@example.invalid', null, null, null, true, 'Weak', null),
    ('Jakub',  'Nowak',    'Kestrels', '2014-11-17', '2025-03-04', null,
     'Z. Nowak',   '07700 900119', null, null, null, null, true, 'Average', null),

    ('Esme',   'Laurent',  'Ravens',   '2013-07-07', '2024-09-10', 'Patrol Leader',
     'Q. Laurent', '07700 900120', 'laurent@example.invalid', null, null, null, true, 'Confident', null),
    ('Danny',  'Fitzgerald','Ravens',  '2013-12-29', '2024-11-05', null,
     'U. Fitzgerald','07700 900121', null, null, null, null, true, 'Average', null),
    ('Aisha',  'Rahman',   'Ravens',   '2014-04-12', '2025-01-14', null,
     'Y. Rahman',  '07700 900122', 'rahman@example.invalid', null, 'Halal', null, true, 'Confident', null),
    ('Theo',   'Vermeulen','Ravens',   '2014-09-23', '2025-03-04', null,
     'X. Vermeulen','07700 900123', null, null, null, null, true, 'Non-swimmer', null),

    -- Just joined, not yet in a patrol. The roster has to render this.
    ('Noor',   'Bakker',   null,       '2015-01-08', '2026-08-01', null,
     'I. Bakker',  '07700 900124', 'bakker@example.invalid', null, null, null, false, null, 'Joined this month — patrol to be decided')
  ) as v(first_name, last_name, patrol, dob, joined, rank, parent, phone, email,
         medical, dietary, allergies, consent, swim, notes)
  left join lab.patrols p on p.name = v.patrol;

-- ---------------------------------------------------------------------
-- Badges and their requirements.
-- ---------------------------------------------------------------------
insert into lab.badges (name, description, category, colour, sort_order) values
  ('Camper',       'Camping under canvas, and looking after yourself while you do', 'Activity',   4, 1),
  ('Cook',         'Planning, cooking and clearing up a meal for other people',      'Activity',   3, 2),
  ('Navigator',    'Map, compass and knowing where you are without either',          'Activity',   6, 3),
  ('Fire Lighter', 'Building, lighting and putting out a fire safely',               'Activity',   5, 4),
  ('First Aid',    'What to do in the first few minutes',                            'Staged',     1, 5),
  ('Hikes Away',   'Nights out on foot, counted',                                    'Staged',     2, 6),
  ('Naturalist',   'Recognising what lives where you camp',                          'Interest',   7, 7),
  ('Pioneer',      'Lashings, spars and things that hold weight',                    'Activity',   8, 8);

insert into lab.badge_requirements (badge_id, text, sort_order)
select b.id, r.text, r.sort_order
  from (values
    ('Camper', 'Pitch and strike a tent with your patrol, without help', 1),
    ('Camper', 'Pack your own kit for a weekend, using a kit list', 2),
    ('Camper', 'Keep your tent and its surroundings tidy for a whole camp', 3),
    ('Camper', 'Camp for a total of six nights', 4),
    ('Cook',   'Plan a meal for six people, including what it costs', 1),
    ('Cook',   'Cook it on a stove or an open fire', 2),
    ('Cook',   'Wash up afterwards to a standard the next patrol would accept', 3),
    ('Cook',   'Explain how you kept the food safe to eat', 4),
    ('Navigator', 'Set a map using a compass', 1),
    ('Navigator', 'Give a six-figure grid reference for where you are standing', 2),
    ('Navigator', 'Follow a route of at least two kilometres you planned yourself', 3),
    ('Fire Lighter', 'Choose and prepare a fire site, and say why it is the right one', 1),
    ('Fire Lighter', 'Light a fire using no more than two matches', 2),
    ('Fire Lighter', 'Put it out and leave no trace it was there', 3),
    ('First Aid', 'Know how to get help, and what to say when you do', 1),
    ('First Aid', 'Deal with a small cut, a graze and a sting', 2),
    ('First Aid', 'Put someone in the recovery position', 3),
    ('Hikes Away', 'One night away on foot', 1),
    ('Hikes Away', 'Five nights away on foot', 2),
    ('Hikes Away', 'Ten nights away on foot', 3),
    ('Naturalist', 'Identify six trees on the site you camp at', 1),
    ('Naturalist', 'Keep a record of what you saw over one weekend', 2),
    ('Pioneer', 'Tie six knots and say what each is for', 1),
    ('Pioneer', 'Make a square lashing and a diagonal lashing', 2),
    ('Pioneer', 'Build something with your patrol that takes your weight', 3)
  ) as r(badge, text, sort_order)
  join lab.badges b on b.name = r.badge;

-- A scattering of awards, so the progression page has a shape to it
-- rather than a column of zeroes. Patrol Leaders have more, which is
-- roughly how it goes.
insert into lab.member_badges (member_id, badge_id, awarded_on)
select m.id, b.id, current_date - (random() * 200)::integer
  from lab.members m
  join lab.badges b on true
 where m.rank = 'Patrol Leader' and b.sort_order <= 4
    or (m.rank = 'Second' and b.sort_order <= 2)
    or (m.rank is null and b.sort_order = 1 and m.joined_on < current_date - 200);

insert into lab.member_requirements (member_id, requirement_id, done_on)
select m.id, r.id, current_date - (random() * 90)::integer
  from lab.members m
  join lab.badge_requirements r on true
  join lab.badges b on b.id = r.badge_id
 where b.name = 'Navigator'
   and r.sort_order <= 2
   and m.active
   and not exists (
     select 1 from lab.member_badges mb
      where mb.member_id = m.id and mb.badge_id = b.id
   );

-- ---------------------------------------------------------------------
-- Patrol points.
-- ---------------------------------------------------------------------
insert into lab.point_awards (patrol_id, points, reason, awarded_at)
select p.id, v.points, v.reason, now() - (v.days_ago || ' days')::interval
  from (values
    ('Eagles',   30, 'Inspection — best tent line',            3),
    ('Eagles',   10, 'First to be ready for the hike',         9),
    ('Foxes',    25, 'Won the pioneering challenge',           3),
    ('Foxes',    15, 'Cleared up the kitchen without asking', 12),
    ('Otters',   40, 'Backwoods cooking — the judges cried',   3),
    ('Otters',  -10, 'Left the axe out in the rain',           8),
    ('Badgers',  20, 'Inspection',                             3),
    ('Badgers',  35, 'Wide game winners',                     16),
    ('Kestrels', 15, 'Best flag break',                        3),
    ('Kestrels', 20, 'Helped the new members with their kit',  6),
    ('Ravens',   45, 'Won the camp cooking competition',       3),
    ('Ravens',    5, 'Loudest campfire song, as promised',     4)
  ) as v(patrol, points, reason, days_ago)
  join lab.patrols p on p.name = v.patrol;

-- ---------------------------------------------------------------------
-- The activity library.
-- ---------------------------------------------------------------------
insert into lab.activities
  (name, description, kind, duration_minutes, indoors, outdoors,
   min_people, max_people, kit_needed, instructions, risk_notes, favourite)
values
  ('British Bulldog', 'Everyone runs, one person catches, it escalates.', 'Game', 15, true, true, 8, 40,
   'A big space and clear boundaries',
   'Mark two ends of the hall. One catcher in the middle. Everyone runs end to end; anyone caught joins the middle. Last one running starts the next round.',
   'Hard floor and enthusiasm. Ban sliding tackles before, not after.', true),
  ('Wink Murder', 'One murderer, a circle of suspects, a lot of accusing.', 'Game', 10, true, false, 8, 30,
   'Nothing', 'Everyone sits in a circle with eyes closed. Tap one person to be the murderer. They wink at people to eliminate them; the rest guess who.', null, false),
  ('Knot Relay', 'Six knots, two teams, one length of rope each.', 'Skill', 20, true, true, 6, 30,
   'Two ropes per patrol, a knot card each',
   'Call a knot. One member from each patrol runs up, ties it, runs back. Points for correct before fast.',
   'Rope burns if they pull against each other. They will try.', true),
  ('Map Symbols Kim''s Game', 'Twenty symbols on a tray, one minute to look.', 'Skill', 15, true, false, 4, 24,
   'Printed OS symbols, a tea towel', 'Show the tray for a minute, cover it, write down what you remember. Patrols pool answers.', null, false),
  ('Backwoods Cooking', 'Cook something edible with no pans.', 'Cooking', 90, false, true, 6, 30,
   'Foil, a fire, food, tongs, water bucket',
   'Each patrol gets ingredients and no equipment beyond foil. Judged on edible first, ambitious second.',
   'Fire, hot foil, raw chicken. Brief on all three. Hand washing before and after.', true),
  ('Pioneering: Camp Gateway', 'Spars, lashings, and something you can walk under.', 'Skill', 120, false, true, 6, 24,
   'Spars, sisal, mallets',
   'Square lashings on the uprights, diagonal on the braces. Test it with a leader''s weight before anyone walks under it.',
   'Falling spars. Hard hats if it goes above head height, and nobody underneath while it is being raised.', false),
  ('Night Line', 'A rope through the woods, and a blindfold.', 'Outdoor', 45, false, true, 6, 30,
   'Fifty metres of rope, blindfolds', 'Run a rope between trees with obstacles along it. Patrols follow it blindfolded, in silence, hand over hand.',
   'Trip hazards are the point, so walk it first in daylight and take out anything that could take an eye.', true),
  ('Compass Course', 'Bearings and paces, around a field.', 'Skill', 60, false, true, 4, 30,
   'Compasses, marker canes, a course card',
   'Set eight canes out. Each patrol gets a start point, a bearing and a distance, and collects a letter at each cane.', null, false),
  ('Fire Lighting Competition', 'First patrol to burn through a string.', 'Skill', 45, false, true, 6, 30,
   'Firesteels, tinder, string, buckets of water',
   'String at 30cm above the fire site. First to burn through wins. One match, or a firesteel for more points.',
   'Fire. Buckets full, sleeves up, hair tied back, and a leader on each fire.', true),
  ('Blindfold Tent Pitch', 'You know how the tent works. Prove it.', 'Skill', 30, false, true, 4, 24,
   'One tent per patrol, blindfolds',
   'Whole patrol blindfolded except one, who may only talk. Points for a tent that would survive the night.',
   'Pegs and mallets near blindfolded people. One leader per patrol watching hands.', false),
  ('Camp Fire Songs', 'The loud ones, then the quiet ones, then bed.', 'Campfire', 30, false, true, 6, 60,
   'A fire, a song book, someone shameless', 'Start loud and silly, finish quiet. Never end on the loud one — nobody sleeps after that.', null, true),
  ('Kim''s Game', 'Twenty objects, one minute, no talking.', 'Game', 10, true, true, 4, 30,
   'Twenty odd objects, a tray, a cloth', null, null, false),
  ('Stretcher Race', 'Build a stretcher, carry a leader, do not drop them.', 'Skill', 30, false, true, 8, 30,
   'Two poles and a blanket per patrol', 'Build it, carry a volunteer twenty metres, swap and carry back.',
   'Dropping people. Volunteers of a sensible size, and no running.', false),
  ('Scavenger Hunt', 'A list of things, twenty minutes, defined boundaries.', 'Outdoor', 25, false, true, 6, 40,
   'A printed list per patrol', null, 'Boundaries in writing and out loud. Whistle means come back now.', false),
  ('Axe and Saw Training', 'How to use them, and when not to.', 'Skill', 45, false, true, 2, 12,
   'Axe, bow saw, chopping block, gloves',
   'One at a time, in a marked area, everyone else outside it. Cover the blade the second you stop.',
   'The obvious one. Small groups only, and never with an audience close enough to be hit.', false),
  ('Water Rocket', 'A bottle, a pump, and everyone standing well back.', 'Craft', 40, false, true, 4, 30,
   'Bottles, a launcher, a pump, water', null, 'Eye protection, and nobody in front of it. They go higher than you expect.', true),
  ('Escape Room in a Box', 'Six padlocks, one box, forty minutes.', 'Game', 40, true, false, 4, 24,
   'A box, assorted locks, printed clues', null, null, false),
  ('First Aid Scenarios', 'Casualties in the woods, made up on purpose.', 'Skill', 45, true, true, 6, 24,
   'Bandages, casualty cards, fake blood if you are feeling dramatic',
   'Set up three scenes. Patrols rotate. Debrief each one before moving on.',
   'Fake blood on a real casualty confuses real first aiders. Take it off afterwards.', false),
  ('Wide Game: Capture the Flag', 'Two bases, two flags, one field, and dusk.', 'Game', 60, false, true, 12, 60,
   'Two flags, torches, boundary markers', null, 'Dark, uneven ground, collisions. Walking pace after sunset, and a whistle signal everyone has heard.', true),
  ('Bridge Building', 'Cross the gap without touching the floor.', 'Skill', 90, true, true, 6, 24,
   'Spars, rope, a gap',
   'Patrols build across a marked gap. Judged on whether a leader can cross it, not on how it looks.',
   'Structures collapsing under load. Test before anyone stands on it.', false);

-- ---------------------------------------------------------------------
-- Programmes.
-- ---------------------------------------------------------------------
insert into lab.programmes (title, meets_on, theme, location, lead_person, notes) values
  ('Knots and fire',      current_date + 3,  'Camp skills',  'The hut',        'Sam',    'Fire in the car park, not the field — the grass is dry.'),
  ('Navigation night',    current_date + 10, 'Camp skills',  'The hut',        'Priya',  null),
  ('Wide game',           current_date + 17, 'Games',        'Bluebell Wood',  'Alex',   'Torches. Remind everyone the week before.'),
  ('Camp preparation',    current_date - 4,  'Camp',         'The hut',        'Sam',    'Kit issued, tents checked, patrol lists up.');

insert into lab.programme_slots (programme_id, title, activity_id, minutes, lead_person, sort_order)
select p.id, v.title, a.id, v.minutes, v.lead, v.sort_order
  from (values
    ('Knots and fire', 'Flag break and notices',   null,                         10, 'Sam',   1),
    ('Knots and fire', 'Knot Relay',               'Knot Relay',                 20, 'Priya', 2),
    ('Knots and fire', 'Fire Lighting Competition','Fire Lighting Competition',  45, 'Sam',   3),
    ('Knots and fire', 'Camp Fire Songs',          'Camp Fire Songs',            15, 'Alex',  4),
    ('Knots and fire', 'Close and dismiss',        null,                         10, 'Sam',   5),
    ('Navigation night','Flag break and notices',  null,                         10, 'Priya', 1),
    ('Navigation night','Map Symbols Kim''s Game', 'Map Symbols Kim''s Game',    15, 'Priya', 2),
    ('Navigation night','Compass Course',          'Compass Course',             50, 'Alex',  3),
    ('Navigation night','British Bulldog',         'British Bulldog',            15, 'Sam',   4),
    ('Wide game',      'Brief and boundaries',     null,                         10, 'Alex',  1),
    ('Wide game',      'Wide Game: Capture the Flag','Wide Game: Capture the Flag',60,'Alex', 2),
    ('Wide game',      'Hot chocolate and home',   null,                         15, 'Sam',   3)
  ) as v(programme, title, activity, minutes, lead, sort_order)
  join lab.programmes p on p.title = v.programme
  left join lab.activities a on a.name = v.activity;

-- ---------------------------------------------------------------------
-- Kit lists.
-- ---------------------------------------------------------------------
insert into lab.kit_lists (name, description, kind) values
  ('Weekend camp',  'Standard list for a two-night camp under canvas.', 'Camp'),
  ('Summer camp',   'A week away. Same as a weekend, but more of it.',  'Camp'),
  ('Day hike',      'What to carry for a day on foot.',                 'Hike'),
  ('Normal meeting','What to bring on a Thursday.',                     'Meeting');

insert into lab.kit_list_items (kit_list_id, item, quantity, weight_grams, essential, note, sort_order)
select k.id, v.item, v.qty, v.grams, v.essential, v.note, v.sort_order
  from (values
    ('Weekend camp', 'Sleeping bag',              1, 1400, true,  'Three season or better', 1),
    ('Weekend camp', 'Roll mat',                  1,  400, true,  null, 2),
    ('Weekend camp', 'Rucksack',                  1, 1200, true,  'Big enough for all of this, in one bag', 3),
    ('Weekend camp', 'Waterproof coat',           1,  500, true,  'Actually waterproof, not a showerproof one', 4),
    ('Weekend camp', 'Walking boots',             1, 1100, true,  'Worn in before the camp, not on it', 5),
    ('Weekend camp', 'Trainers',                  1,  700, false, 'For around camp', 6),
    ('Weekend camp', 'Warm layer (fleece/jumper)',2,  400, true,  null, 7),
    ('Weekend camp', 'T-shirts',                  3,  150, true,  null, 8),
    ('Weekend camp', 'Trousers',                  2,  400, true,  'Not jeans. Jeans stay wet all weekend.', 9),
    ('Weekend camp', 'Underwear and socks',       3,   80, true,  'Spare socks are the difference between a good camp and a bad one', 10),
    ('Weekend camp', 'Woolly hat',                1,   80, true,  'Yes, even in summer', 11),
    ('Weekend camp', 'Torch',                     1,  150, true,  'Head torch is better. Spare batteries.', 12),
    ('Weekend camp', 'Water bottle',              1,  150, true,  null, 13),
    ('Weekend camp', 'Plate, bowl, mug, cutlery', 1,  400, true,  'Named. All of it.', 14),
    ('Weekend camp', 'Wash kit and towel',        1,  600, true,  null, 15),
    ('Weekend camp', 'Sun cream',                 1,  100, false, null, 16),
    ('Weekend camp', 'Scout uniform',             1,  400, true,  'Worn for flag break and travelling', 17),
    ('Weekend camp', 'Bin bag',                   2,   20, false, 'For wet clothes. There will be wet clothes.', 18),

    ('Day hike', 'Day sack',                      1,  600, true,  null, 1),
    ('Day hike', 'Waterproof coat',               1,  500, true,  null, 2),
    ('Day hike', 'Waterproof trousers',           1,  300, false, null, 3),
    ('Day hike', 'Walking boots',                 1, 1100, true,  null, 4),
    ('Day hike', 'Water (1.5 litres)',            1, 1500, true,  'Carry it all. There is no tap on the hill.', 5),
    ('Day hike', 'Packed lunch',                  1,  500, true,  null, 6),
    ('Day hike', 'Extra snacks',                  1,  200, true,  'More than you think', 7),
    ('Day hike', 'Hat and gloves',                1,  150, true,  null, 8),
    ('Day hike', 'Map and compass',               1,  200, true,  'And know how to use them', 9),
    ('Day hike', 'Whistle',                       1,   20, true,  null, 10),
    ('Day hike', 'Small first aid kit',           1,  250, true,  null, 11),
    ('Day hike', 'Survival bag',                  1,  120, true,  null, 12),

    ('Normal meeting', 'Uniform',                 1, null, true,  null, 1),
    ('Normal meeting', 'Subs',                    1, null, false, null, 2),
    ('Normal meeting', 'Coat',                    1, null, true,  'We go outside in all weather', 3),
    ('Normal meeting', 'Water bottle',            1, null, false, null, 4)
  ) as v(list, item, qty, grams, essential, note, sort_order)
  join lab.kit_lists k on k.name = v.list;

-- ---------------------------------------------------------------------
-- Noticeboard, polls and the wishlist.
-- ---------------------------------------------------------------------
insert into lab.announcements (title, body, pinned, expires_on) values
  ('Summer camp deposits due',
   'Deposits of £25 are due by the end of the month. Cash at the hut or bank transfer — reference is the young person''s name, not "camp".',
   true, current_date + 21),
  ('New store layout',
   'The store has been reorganised. Tents are now on the left as you walk in, cooking on the right, and the shelf by the door is returns-to-be-checked only. Please do not put anything back on that shelf unless it needs checking.',
   false, null),
  ('Thursday is outdoors',
   'Full kit for outdoors this Thursday — coats and boots. We are in the wood, not the hut.',
   false, current_date + 5);

insert into lab.polls (question, detail, multi, closes_on) values
  ('Where for summer camp?', 'Three sites, all available the last week of July. Pick one.', false, current_date + 14),
  ('Which nights can you help at camp?', 'Leaders only — tick every night you can be there.', true, current_date + 10);

insert into lab.poll_options (poll_id, label, sort_order)
select p.id, v.label, v.sort_order
  from (values
    ('Where for summer camp?', 'Gilwell Park',      1),
    ('Where for summer camp?', 'Broadstone Warren', 2),
    ('Where for summer camp?', 'Youlbury',          3),
    ('Which nights can you help at camp?', 'Friday',   1),
    ('Which nights can you help at camp?', 'Saturday', 2),
    ('Which nights can you help at camp?', 'Sunday',   3)
  ) as v(question, label, sort_order)
  join lab.polls p on p.question = v.question;

insert into lab.wishlist (item, why, estimated_cents, status) values
  ('Two new patrol tents', 'The green ones leak and have been patched twice. Both are older than the members using them.', 48000, 'Requested'),
  ('Six firesteels',       'So fire lighting stops depending on a box of damp matches.', 4200, 'Approved'),
  ('A proper first aid kit for the minibus', 'The one in there is a plaster box.', 3500, 'Requested'),
  ('Bell tent',            'For leaders, so the store tent stops being a bedroom.', 32000, 'Declined'),
  ('Twenty compasses',     'We borrow the district''s every time, and one day they will say no.', 18000, 'Bought');

-- ---------------------------------------------------------------------
-- Anything that needs a camp or a piece of equipment.
--
-- Guarded, because the app's own tables may be empty on a fresh project
-- and a missing camp should not take the whole seed file down with it.
-- ---------------------------------------------------------------------
do $do$
declare
  ev uuid;
  eq uuid;
  site uuid;
begin
  select id into ev from public.events order by start_date desc limit 1;
  select id into eq from public.equipment order by created_at limit 1;
  select id into site from public.camping_sites order by created_at limit 1;

  if ev is not null then
    -- Attendance for everyone, then a realistic scattering of answers.
    perform lab.roll_call(ev);

    update lab.attendance set status = 'Coming', paid = true, consent_form_in = true
     where event_id = ev
       and member_id in (select id from lab.members where rank is not null);

    update lab.attendance set status = 'Coming'
     where event_id = ev and status = 'Unknown'
       and member_id in (select id from lab.members order by last_name limit 12);

    update lab.attendance set status = 'Not coming', notes = 'Family away that weekend'
     where event_id = ev and status = 'Unknown'
       and member_id in (select id from lab.members order by first_name limit 2);

    insert into lab.tasks (event_id, title, detail, status, due_on, priority, sort_order) values
      (ev, 'Book the minibus',        'District office, ask for the long-wheelbase one.', 'Done',  current_date - 5, 1, 1),
      (ev, 'Chase consent forms',     'Four still outstanding.',                          'Doing', current_date + 2, 1, 2),
      (ev, 'Check the tents',         'Pitch every one in the car park first.',           'Doing', current_date + 4, 2, 3),
      (ev, 'Shopping',                'Use the shopping list off the camp plan.',         'Todo',  current_date + 6, 2, 4),
      (ev, 'Print the safety plan',   'Two copies — one for the box, one for the wall.',  'Todo',  current_date + 6, 1, 5),
      (ev, 'Sort the wood',           null,                                               'Todo',  null,             3, 6),
      (ev, 'Confirm with the site',   'Phone, do not email. They do not read email.',     'Blocked', current_date + 1, 1, 7);

    insert into lab.duties (event_id, day_number, duty, patrol_id)
    select ev, d.day, d.duty, p.id
      from (values
        (1, 'Cook',       'Eagles'),
        (1, 'Wash up',    'Foxes'),
        (1, 'Wood and water','Otters'),
        (2, 'Cook',       'Badgers'),
        (2, 'Wash up',    'Kestrels'),
        (2, 'Wood and water','Ravens'),
        (3, 'Cook',       'Otters'),
        (3, 'Wash up',    'Eagles'),
        (3, 'Wood and water','Foxes')
      ) as d(day, duty, patrol)
      join lab.patrols p on p.name = d.patrol;

    insert into lab.budgets (event_id, charge_per_head_cents, subs_collected_cents, grant_cents, notes)
    values (ev, 3500, 42000, 5000, 'Grant is the district''s activity fund — already in the account.');

    insert into lab.expenses (event_id, description, category, amount_cents, spent_on, reimbursed) values
      (ev, 'Site fees',            'Site',      18000, current_date - 20, true),
      (ev, 'Food shop',            'Food',      21450, current_date - 3,  false),
      (ev, 'Gas cylinders',        'Equipment',  4200, current_date - 3,  false),
      (ev, 'Minibus fuel',         'Transport',  6800, current_date - 1,  false),
      (ev, 'Prizes for the wide game', 'Programme', 1200, current_date - 2, true);

    insert into lab.risk_assessments (title, event_id, assessor, assessed_on, review_on)
    values ('Weekend camp — general', ev, 'Sam', current_date - 10, current_date + 355);

    insert into lab.risk_lines (assessment_id, hazard, who_at_risk, likelihood, severity, controls, sort_order)
    select ra.id, v.hazard, v.who, v.likelihood, v.severity, v.controls, v.sort_order
      from (values
        ('Cooking on gas and open fires', 'Everyone', 3, 4,
         'Fire area marked and fenced. Buckets of water at each fire. No loose clothing, hair tied back. Leader present whenever a fire is lit. Gas turned off at the cylinder after every meal.', 1),
        ('Axes and saws', 'Those using them', 2, 5,
         'Marked cutting area, one person in it at a time. Training before use. Tools covered and stored when not in use.', 2),
        ('Getting lost on the wide game', 'Members', 3, 3,
         'Boundaries walked in daylight and described twice. Whistle signal agreed. Head count at the start and the end. Nobody alone.', 3),
        ('Cold and wet weather', 'Everyone', 4, 3,
         'Kit list checked at the start. Spare warm kit in the leaders'' tent. Hot drinks available. Tents checked for leaks before dark.', 4),
        ('Allergies and medical needs', 'Named members', 2, 5,
         'Medical forms read before the camp by every leader. EpiPens and inhalers carried, plus spares in the first aid box. Catering briefed on the allergy list.', 5)
      ) as v(hazard, who, likelihood, severity, controls, sort_order)
      join lab.risk_assessments ra on ra.event_id = ev and ra.title = 'Weekend camp — general';

    insert into lab.incidents
      (event_id, happened_at, kind, who_involved, what_happened, action_taken,
       first_aid_given, parents_informed)
    values
      (ev, now() - interval '9 days', 'Near miss', 'Two members',
       'A guy line across the path between the tents and the toilets. Somebody caught it in the dark but did not fall.',
       'Line re-pegged outside the path and marked with tape. All lines checked at dusk from now on.',
       false, false),
      (ev, now() - interval '8 days', 'Injury', 'One member',
       'Small burn to the fingers from a hot pan handle during washing up.',
       'Held under cold running water for ten minutes, dressed. Cloth handles now hung by the wash-up point.',
       true, true);
  end if;

  if eq is not null then
    insert into lab.maintenance_logs (equipment_id, logged_on, kind, detail, cost_cents) values
      (eq, current_date - 60, 'Check',  'Pitched and inspected. Small tear in the flysheet, not through.', 0),
      (eq, current_date - 30, 'Repair', 'Tear patched with tent tape both sides.', 850),
      (eq, current_date - 2,  'Check',  'Patch holding. Back in the store.', 0);
  end if;

  if site is not null then
    insert into lab.site_reviews (site_id, rating, comment, stayed_on) values
      (site, 4, 'Good site, well drained, and the warden actually answers the phone. The far field floods — ask for the top one.', current_date - 90),
      (site, 5, 'Wood provided, proper fire pits, and toilets that did not make anyone cry.', current_date - 300);
  end if;
end $do$;
