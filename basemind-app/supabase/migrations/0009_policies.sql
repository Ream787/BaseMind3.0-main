-- Policies: the group's rule documents, and the text the assistant answers from.
--
-- Two copies of each document are kept on purpose:
--   storage_path -> the original PDF, so anyone can open the real thing
--   content      -> its extracted text, which is what gets sent to the model
--
-- Answers cite `content`, and citations are checked against it before being
-- shown, so a quote can always be traced back to a real document.

create table public.policies (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  category text,

  -- Path in the 'policies' storage bucket. Null if the text was pasted
  -- rather than uploaded.
  storage_path text,
  -- Extracted plain text. Empty means nothing readable was found — a scanned
  -- PDF, most likely — and the assistant can't use it.
  content text not null default '',
  page_count integer,

  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_policies_title on public.policies (title);

-- Full-text search, so policies stay findable without the assistant — and
-- so search still works offline against cached rows.
create index idx_policies_content_search
  on public.policies using gin (to_tsvector('english', title || ' ' || content));

create trigger trg_policies_updated_at before update on public.policies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- Everyone signed in may read policies — that's the point of having them.
-- Only Group Managers and Admins may add or change them, because what the
-- assistant answers from is only as trustworthy as who can edit it.
-- ---------------------------------------------------------------------
alter table public.policies enable row level security;

create policy policies_select on public.policies for select
  using (public.is_active_user());

create policy policies_insert on public.policies for insert
  with check (public.is_active_user()
              and public.current_role() in ('Admin','Manager'));

create policy policies_update on public.policies for update
  using (public.is_active_user()
         and public.current_role() in ('Admin','Manager'))
  with check (public.is_active_user()
              and public.current_role() in ('Admin','Manager'));

create policy policies_delete on public.policies for delete
  using (public.is_active_user()
         and public.current_role() in ('Admin','Manager'));

alter publication supabase_realtime add table public.policies;

-- ---------------------------------------------------------------------
-- STORAGE for the original PDFs
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('policies', 'policies', false)
on conflict (id) do nothing;

create policy policies_storage_read on storage.objects for select
  using (bucket_id = 'policies' and public.is_active_user());

create policy policies_storage_write on storage.objects for insert
  with check (bucket_id = 'policies'
              and public.is_active_user()
              and public.current_role() in ('Admin','Manager'));

create policy policies_storage_delete on storage.objects for delete
  using (bucket_id = 'policies'
         and public.is_active_user()
         and public.current_role() in ('Admin','Manager'));

-- ---------------------------------------------------------------------
-- Feature switch, so it can be turned off like everything else.
-- ---------------------------------------------------------------------
insert into public.feature_flags (key, label, description, sort_order)
values ('policies', 'Policies', 'Policy documents and the assistant that answers from them', 9)
on conflict (key) do nothing;
