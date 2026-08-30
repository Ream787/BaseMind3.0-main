-- Usernames, so an account doesn't require an email address.
--
-- Plenty of scouts don't have an email, or have one a parent reads. Requiring
-- one to sign in meant either sharing an adult's inbox or not having an
-- account. A username costs nothing and is what people would use anyway.
--
-- HOW THE SIGN-IN WORKS, because it is not obvious from here:
--
-- Supabase Auth is built around an email, so every account still has one
-- underneath. When somebody registers WITHOUT an email, the app derives a
-- fixed one from the username — <username>@basemind.invalid — and signs in
-- with that. Nothing is sent to it; .invalid is the reserved TLD that can
-- never resolve, precisely so it cannot collide with a real address.
--
-- The consequence, which is worth being clear about: an account with no
-- email cannot have its password reset by email. An Admin can reset it from
-- the Supabase dashboard. Accounts registered WITH an email keep working
-- exactly as before, reset included.

alter table public.users
  add column username text;

-- Case-insensitively unique: "Rudi" and "rudi" must not be two people.
create unique index idx_users_username on public.users (lower(username))
  where username is not null;

-- ---------------------------------------------------------------------
-- Give everyone who already exists a username
--
-- Taken from the part of their email before the @, cleaned to the character
-- set the app allows, and numbered if two people would collide. Nobody has
-- to do anything; their email sign-in is unaffected either way.
-- ---------------------------------------------------------------------
with candidates as (
  select id,
         regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_.-]', '', 'g') as base,
         row_number() over (
           partition by regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_.-]', '', 'g')
           order by created_at
         ) as n
    from public.users
   where username is null
)
update public.users u
   set username = case when c.n = 1 then c.base else c.base || c.n end
  from candidates c
 where u.id = c.id
   and length(c.base) > 0;

-- ---------------------------------------------------------------------
-- New sign-ups carry their username through from the registration form
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, username, name, phone, role, status)
  values (
    new.id,
    new.email,
    -- Null rather than a guess when the form didn't send one: a username
    -- invented here would be one nobody knows they have.
    nullif(new.raw_user_meta_data->>'username', ''),
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'phone',
    'Viewer',
    'Pending'
  );
  return new;
end;
$$;
