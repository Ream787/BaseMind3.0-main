-- Recording that somebody accepted the terms, and which ones.
--
-- The version, not just a yes: "they agreed to something, once" is not worth
-- writing down. Storing which text was on the screen means the terms can
-- change and everyone can be asked again, and it means the answer to "what
-- did they agree to" is a date somebody can go and read.

alter table public.users
  add column terms_accepted_at timestamptz,
  add column terms_version text;

-- Nobody is grandfathered in. Every existing account is asked at its next
-- sign-in, which is the point of adding this at all: an acceptance nobody
-- ever gave is not one you can rely on having.

-- No new policy and no new trigger. users_update already lets somebody write
-- their own row, and protect_user_fields reverts only role and status — the
-- two that would be an escalation. Accepting terms on your own behalf is
-- exactly the kind of thing you should be able to do to your own row, and
-- doing it for somebody else is already impossible: the policy matches on
-- auth.uid() = id.
--
-- An Admin can also write these columns, by the same policy. That is not a
-- way to accept on a member's behalf so much as a way to clear the fields
-- and make somebody read the terms again, which is occasionally what you
-- want and never harmful.
