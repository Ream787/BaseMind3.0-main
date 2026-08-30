-- Somewhere for "this is broken" to go.
--
-- Until now the only route from "the scanner won't open" to anyone who can
-- fix it was a WhatsApp message that nobody keeps. A report needs to carry
-- the boring context with it — which page, which browser, whether the phone
-- was online — because that is exactly what the person reporting it does not
-- think to include and exactly what makes the difference between a fixable
-- report and "it doesn't work".

create table public.bug_reports (
  id uuid primary key default uuid_generate_v4(),

  -- Nullable so a report survives the account that made it being removed;
  -- the report is still useful, the follow-up question is not.
  reported_by uuid references public.users(id) on delete set null,

  -- What happened, in their words. Kept as two fields rather than one: a
  -- list of reports needs a line you can scan, and a body nobody reads until
  -- they open it.
  summary text not null check (btrim(summary) <> ''),
  detail text,

  -- The page they were on. Collected automatically, because "the equipment
  -- page" and "/boxes/BM-7K3QX2" are very different amounts of help.
  page text,

  -- Browser, screen size, whether they were online, which build they were
  -- running. A blob rather than columns: it is read by a person looking at
  -- one report, never filtered or joined on, and every new thing worth
  -- collecting would otherwise be a migration.
  context jsonb not null default '{}'::jsonb,

  status text not null default 'Open'
    check (status in ('Open', 'Looking at it', 'Fixed', 'Not a bug')),
  -- What was done about it, for the person who reported it to read.
  resolution text,
  resolved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bug_reports_status on public.bug_reports (status, created_at desc);
create index idx_bug_reports_reporter on public.bug_reports (reported_by);

create trigger trg_bug_reports_updated_at before update on public.bug_reports
  for each row execute function public.set_updated_at();

-- Closing one stamps the date, and reopening clears it. Doing this in the
-- database rather than in the dialog keeps the two in step no matter which
-- screen changed the status.
create or replace function public.stamp_bug_resolution()
returns trigger language plpgsql as $$
begin
  if new.status in ('Fixed', 'Not a bug') and old.status not in ('Fixed', 'Not a bug') then
    new.resolved_at := now();
  elsif new.status not in ('Fixed', 'Not a bug') then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_bug_reports_resolution
  before update of status on public.bug_reports
  for each row execute function public.stamp_bug_resolution();

-- ---------------------------------------------------------------------
-- RLS
--
-- Anyone active may report a bug — a leader who cannot use half the app is
-- exactly the person who needs to tell somebody. You see your own reports
-- and nobody else's; Managers and Admins see all of them, because they are
-- the ones who act on them.
--
-- Deliberately not readable by everyone: a report says what somebody was
-- doing and what went wrong for them, and a wall of other people's problems
-- is neither useful nor theirs to read.
-- ---------------------------------------------------------------------
alter table public.bug_reports enable row level security;

create policy bug_reports_select on public.bug_reports for select
  using (public.is_active_user()
         and (reported_by = auth.uid()
              or public.current_role() in ('Admin','Manager')));

create policy bug_reports_insert on public.bug_reports for insert
  with check (public.is_active_user() and reported_by = auth.uid());

-- Only the people who triage them. The reporter cannot edit their own after
-- the fact: a report is a record of what was seen at the time, and one that
-- can be quietly rewritten is worth less than one that cannot.
create policy bug_reports_update on public.bug_reports for update
  using (public.is_active_user() and public.current_role() in ('Admin','Manager'))
  with check (public.is_active_user() and public.current_role() in ('Admin','Manager'));

create policy bug_reports_delete on public.bug_reports for delete
  using (public.is_active_user() and public.current_role() = 'Admin');

alter publication supabase_realtime add table public.bug_reports;
