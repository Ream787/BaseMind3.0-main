-- =====================================================================
-- Removes everything dummy_data.sql inserted, and nothing else.
--
-- Every seeded row is named with a '[sample]' prefix, so this only deletes
-- those. Anything you added yourself is left alone, as are user accounts.
-- =====================================================================

begin;

-- Child rows first so the foreign keys stay happy. (The event_* tables
-- cascade from events anyway, but being explicit means this also cleans up
-- sample food/equipment that was attached to a real event of your own.)
delete from public.event_food
  where event_id in (select id from public.events where name like '[sample]%')
     or food_item_id in (select id from public.food_items where name like '[sample]%');

delete from public.event_equipment
  where event_id in (select id from public.events where name like '[sample]%')
     or equipment_id in (select id from public.equipment where name like '[sample]%');

delete from public.events        where name like '[sample]%';
delete from public.camping_sites where name like '[sample]%';
delete from public.food_items    where name like '[sample]%';
delete from public.equipment     where name like '[sample]%';

commit;

-- Should all come back 0.
select 'equipment'     as table_name, count(*) from public.equipment     where name like '[sample]%'
union all select 'camping_sites', count(*) from public.camping_sites where name like '[sample]%'
union all select 'food_items',    count(*) from public.food_items    where name like '[sample]%'
union all select 'events',        count(*) from public.events        where name like '[sample]%';
