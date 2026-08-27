-- The easter egg's scoreboard.
--
-- Tapping the wordmark ten times opens a maze. Finishing it records a run,
-- and Admins can see who has found it. That is the whole point of hiding
-- something: somebody has to be able to enjoy the fact that people found it.

create table public.maze_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,

  seconds integer not null check (seconds >= 0 and seconds < 86400),
  moves integer not null check (moves >= 0),
  -- Mazes vary, so a time means little without knowing how big it was.
  size integer not null check (size > 0),

  completed_at timestamptz not null default now()
);

create index idx_maze_runs_leaderboard on public.maze_runs (seconds, moves);
create index idx_maze_runs_user on public.maze_runs (user_id);

-- ---------------------------------------------------------------------
-- RLS
--
-- You may record your own runs and see your own. Admins see everyone's,
-- which is the point of the thing.
--
-- Nobody may UPDATE or DELETE, including Admins: there is no policy for
-- either, so both are default-denied. A scoreboard you can edit is not a
-- scoreboard, and the stakes here are exactly low enough that permanent is
-- the right answer.
-- ---------------------------------------------------------------------
alter table public.maze_runs enable row level security;

create policy maze_runs_select on public.maze_runs for select
  using (public.is_active_user()
         and (user_id = auth.uid() or public.current_role() = 'Admin'));

create policy maze_runs_insert on public.maze_runs for insert
  with check (public.is_active_user() and user_id = auth.uid());
