-- ======================================================================
-- Remove the Lab experiment, completely.
--
-- This is the reason everything went into its own schema. Run this and
-- the database is back to exactly what `supabase/migrations/` describes:
-- equipment, camps, food, menus, safety, forms and policies, untouched
-- and unaware any of it happened.
--
-- What it does NOT touch, on purpose:
--   * anything in `public` — no table, column, row or policy
--   * the `policies` storage bucket
--   * users, roles and approvals
--
-- Foreign keys pointing from lab into public are dropped along with the
-- tables holding them, so public rows lose a dependent, not a value.
-- ======================================================================

-- The publication would otherwise keep a dangling reference to tables
-- that are about to stop existing.
do $do$
declare t record;
begin
  for t in
    select tablename from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'lab'
  loop
    execute format('alter publication supabase_realtime drop table lab.%I', t.tablename);
  end loop;
end $do$;

-- Storage policies live in `storage`, not in `lab`, so the cascade below
-- cannot reach them.
drop policy if exists lab_photos_read on storage.objects;
drop policy if exists lab_photos_write on storage.objects;
drop policy if exists lab_photos_delete on storage.objects;

-- Empty the bucket before removing it: storage refuses to drop a bucket
-- with objects still in it, and a half-run teardown is worse than none.
delete from storage.objects where bucket_id = 'lab-photos';
delete from storage.buckets where id = 'lab-photos';

drop schema if exists lab cascade;
