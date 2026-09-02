-- Make a profile for somebody who arrived through Google or Apple.
--
-- The trigger was written for the registration form, which sends exactly the
-- three fields it reads. An OAuth provider sends its own shapes:
--
--   Google  name, full_name, email, avatar_url
--   Apple   full_name — and only on the FIRST authorisation, never again —
--           often with a privaterelay.appleid.com address instead of a real
--           one, which is the person's actual address as far as we are
--           concerned and must be stored as given.
--
-- So Apple sign-ups were landing with a blank name, and the app fell back to
-- showing an address nobody recognises in the approvals list — an admin
-- deciding whether to let somebody in wants a name.
--
-- No username either way, which is correct: one invented here is one nobody
-- knows they have, and they sign in with the button rather than by typing it.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, username, name, phone, role, status)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'username', ''),
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      ''
    ),
    new.raw_user_meta_data->>'phone',
    'Viewer',
    'Pending'
  );
  return new;
end;
$$;

-- Everyone through this door is Pending, exactly as before. A Google account
-- is proof of an email address and nothing else — it says nothing about
-- whether the person is in the group — so approval stays where it was.
