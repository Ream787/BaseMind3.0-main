-- Fix: protect_user_fields() blocked the first-admin bootstrap.
--
-- The trigger reverted role/status on any UPDATE where the caller wasn't an
-- Admin. Statements run from the SQL Editor (or with the service_role key)
-- carry no JWT, so auth.uid() is NULL and current_role() returns NULL —
-- "distinct from 'Admin'" — meaning the documented bootstrap UPDATE reported
-- success while silently changing nothing.
--
-- Callers with no JWT already bypass RLS entirely and are fully trusted, and
-- the users_update RLS policy blocks anon clients from touching rows at all,
-- so skipping the guard when auth.uid() is NULL doesn't widen client access.
-- The guard still applies to every logged-in user, which is the case it
-- exists for: stopping a Member/Viewer from promoting themselves.

create or replace function public.protect_user_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and public.current_role() is distinct from 'Admin' then
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$;
