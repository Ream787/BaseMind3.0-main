-- Saved assistant conversations, and policies that came from a link.
--
-- Chats are PRIVATE to the person who asked. A leader asking "what do I do
-- if a parent refuses to collect their child" is asking on behalf of a real
-- situation, and that shouldn't be group-readable. Row-level security does
-- the enforcing, not the UI.

-- ---------------------------------------------------------------------
-- CHATS
-- ---------------------------------------------------------------------
create table public.policy_chats (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- Taken from the first question asked, so the list reads as a list of
  -- questions rather than "New chat (3)".
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  -- Ordered by this, so the chat you last used is the one at the top.
  updated_at timestamptz not null default now()
);

create index idx_policy_chats_user on public.policy_chats (user_id, updated_at desc);

-- ---------------------------------------------------------------------
-- MESSAGES
--
-- An assistant message stores the CHECKED answer, not the raw model reply:
-- the citations in `result` have already been matched against the documents
-- they claim to quote. Reopening a chat therefore shows exactly what was
-- shown at the time, and never re-displays a quote that failed verification.
--
-- It is a transcript, so it is deliberately not re-verified on load. If a
-- document is edited afterwards, the record of what the assistant said on
-- the day stays what it said on the day.
-- ---------------------------------------------------------------------
create table public.policy_chat_messages (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid not null references public.policy_chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  -- CheckedAnswer for assistant messages: citations, coverage, suggestions.
  -- Null on user messages, which are just their own text.
  result jsonb,
  created_at timestamptz not null default now()
);

create index idx_policy_chat_messages_chat
  on public.policy_chat_messages (chat_id, created_at);

create trigger trg_policy_chats_updated_at before update on public.policy_chats
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: your chats are yours
--
-- Messages are gated on the parent chat rather than carrying their own
-- user_id. One owner per conversation means there is no way for the two to
-- disagree about who a message belongs to.
-- ---------------------------------------------------------------------
alter table public.policy_chats         enable row level security;
alter table public.policy_chat_messages enable row level security;

create policy policy_chats_select on public.policy_chats for select
  using (public.is_active_user() and user_id = auth.uid());

create policy policy_chats_insert on public.policy_chats for insert
  with check (public.is_active_user() and user_id = auth.uid());

create policy policy_chats_update on public.policy_chats for update
  using (public.is_active_user() and user_id = auth.uid())
  with check (public.is_active_user() and user_id = auth.uid());

create policy policy_chats_delete on public.policy_chats for delete
  using (public.is_active_user() and user_id = auth.uid());

create policy policy_chat_messages_select on public.policy_chat_messages for select
  using (public.is_active_user() and exists (
    select 1 from public.policy_chats c
     where c.id = policy_chat_messages.chat_id and c.user_id = auth.uid()));

create policy policy_chat_messages_insert on public.policy_chat_messages for insert
  with check (public.is_active_user() and exists (
    select 1 from public.policy_chats c
     where c.id = policy_chat_messages.chat_id and c.user_id = auth.uid()));

create policy policy_chat_messages_delete on public.policy_chat_messages for delete
  using (public.is_active_user() and exists (
    select 1 from public.policy_chats c
     where c.id = policy_chat_messages.chat_id and c.user_id = auth.uid()));

-- No UPDATE policy on messages on purpose: a transcript that can be edited
-- after the fact is not a transcript.

-- ---------------------------------------------------------------------
-- POLICIES FROM A LINK
--
-- Keeping the URL is what makes "check for update" possible later: the
-- document is re-downloaded from where it came from and replaces itself in
-- place, so the assistant answers from the current version without anyone
-- having to notice that the old one went stale.
-- ---------------------------------------------------------------------
alter table public.policies
  add column source_url text,
  add column source_fetched_at timestamptz;

-- One document per title, so re-importing replaces rather than adding a
-- second copy — two copies of a policy means the assistant quotes whichever
-- it read first, and an edit to one silently doesn't apply.
--
-- Nothing stopped duplicate titles before this, so any that already exist
-- are renamed rather than deleted: the index has to be creatable on a real
-- database, and losing someone's document to a migration would be worse
-- than leaving them a visibly numbered one to tidy up.
do $$
declare
  dup record;
begin
  for dup in
    select id, title,
           row_number() over (partition by lower(title) order by updated_at desc, created_at desc) as rank
      from public.policies
  loop
    if dup.rank > 1 then
      update public.policies
         set title = dup.title || ' (' || dup.rank || ')'
       where id = dup.id;
      raise notice 'Renamed duplicate policy % to "% (%)"', dup.id, dup.title, dup.rank;
    end if;
  end loop;
end $$;

create unique index idx_policies_title_unique on public.policies (lower(title));
