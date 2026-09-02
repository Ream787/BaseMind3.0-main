-- Remembering that we have told somebody they're in.
--
-- Approving is a button, and buttons get pressed twice — on a phone, on a bad
-- connection, by two leaders looking at the same list. Without a record of
-- having sent it, each press is another "welcome to BaseMind" in the same
-- inbox, which reads as a broken app rather than a keen one.

alter table public.users
  add column approval_emailed_at timestamptz;

-- The column means "we have told them about their CURRENT approval", not
-- "we have ever emailed this person". Somebody rejected and later let back in
-- is being approved again, and should hear about it again — so losing Active
-- forgets that we ever said anything.
create or replace function public.forget_approval_email()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from 'Active' and old.status = 'Active' then
    new.approval_emailed_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_forget_approval_email
  before update of status on public.users
  for each row execute function public.forget_approval_email();

-- No new RLS policy. The existing users_update policy already lets an Admin
-- write this row, and the only thing that sets this column is the edge
-- function, which uses the service role and bypasses RLS entirely.
