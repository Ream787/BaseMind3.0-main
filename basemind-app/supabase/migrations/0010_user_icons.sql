-- Person icons: a little camp badge for everyone.
--
-- Nothing here is required for an icon to exist. The badge is derived from
-- the user's id in the browser, so every account has one from the moment it
-- is created and it renders offline. These two columns only record a *choice*:
--
--   avatar_emblem -> an emblem key, or 'initials' for letters instead of a
--                    picture; null means "work it out from the id"
--   avatar_colour -> 1-8, matching the --avatar-N hues in the stylesheet;
--                    null means the same
--
-- Both are nullable and both are cosmetic. A null in either means the browser
-- falls back to the value the id would have chosen, so half a choice still
-- gives a whole badge.
--
-- Written to be safe to run twice. An earlier version of this file also added
-- an avatar_url column and an 'avatars' storage bucket for AI-generated
-- icons; that feature was dropped, and the block at the bottom clears it away
-- if you already ran it.

alter table public.users
  add column if not exists avatar_emblem text,
  add column if not exists avatar_colour smallint;

-- Named explicitly rather than inlined, so re-running can check for it. An
-- inline check would get a generated name and be added a second time.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_avatar_colour_range'
  ) then
    alter table public.users
      add constraint users_avatar_colour_range
      check (avatar_colour is null or avatar_colour between 1 and 8);
  end if;
end $$;

-- Deliberately no check constraint on avatar_emblem. The emblem list lives in
-- the app and will grow; a constraint here would mean a migration every time
-- one is added, and an unknown key already falls back to the derived badge
-- rather than breaking anything.

-- No RLS changes needed: users_update already lets someone edit their own row
-- (and an Admin edit anyone's), and protect_user_fields guards only role and
-- status, which these are not.

-- ---------------------------------------------------------------------
-- CLEARING AWAY THE GENERATED-ICON VERSION
--
-- Only does anything if you ran the earlier version of this file. It drops
-- the bucket that held the generated pictures and the column that pointed at
-- them. THIS DELETES THOSE IMAGES — that is the intent, they are unreachable
-- once the column is gone, but read it before you run it.
--
-- Note that removing the rows in storage.objects does not reclaim the files
-- in the storage backend; delete the bucket from the dashboard if you want
-- the space back.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from storage.buckets where id = 'avatars') then
    drop policy if exists avatars_storage_read on storage.objects;
    drop policy if exists avatars_storage_write on storage.objects;
    drop policy if exists avatars_storage_update on storage.objects;
    drop policy if exists avatars_storage_delete on storage.objects;

    delete from storage.objects where bucket_id = 'avatars';
    delete from storage.buckets where id = 'avatars';
  end if;
end $$;

alter table public.users drop column if exists avatar_url;
