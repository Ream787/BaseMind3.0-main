-- Official forms: upload a fillable PDF once, then generate filled copies.
--
-- Only the mapping lives here; the PDF itself goes in Supabase Storage. The
-- app never alters the stored original — it loads it, fills a copy in the
-- browser and downloads that, so the blank form stays reusable.

create table public.camp_forms (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  -- Path within the 'camp-forms' storage bucket.
  storage_path text not null,
  -- { "<pdf field name>": "<BaseMind data key>" }, e.g.
  -- { "Camp_Name": "event.name", "Leader_Cell": "safety.leader_phone" }
  field_map jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_camp_forms_updated_at before update on public.camp_forms
  for each row execute function public.set_updated_at();

alter table public.camp_forms enable row level security;

create policy camp_forms_select on public.camp_forms for select
  using (public.is_active_user());

create policy camp_forms_insert on public.camp_forms for insert
  with check (public.is_active_user()
              and public.current_role() in ('Admin','Manager','Member'));

create policy camp_forms_update on public.camp_forms for update
  using (public.is_active_user()
         and public.current_role() in ('Admin','Manager','Member'))
  with check (public.is_active_user()
              and public.current_role() in ('Admin','Manager','Member'));

create policy camp_forms_delete on public.camp_forms for delete
  using (public.is_active_user() and public.current_role() in ('Admin','Manager'));

alter publication supabase_realtime add table public.camp_forms;

-- ---------------------------------------------------------------------
-- STORAGE
-- Private bucket: these are your group's official forms, not public files.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('camp-forms', 'camp-forms', false)
on conflict (id) do nothing;

create policy camp_forms_storage_read on storage.objects for select
  using (bucket_id = 'camp-forms' and public.is_active_user());

create policy camp_forms_storage_write on storage.objects for insert
  with check (bucket_id = 'camp-forms'
              and public.is_active_user()
              and public.current_role() in ('Admin','Manager','Member'));

create policy camp_forms_storage_delete on storage.objects for delete
  using (bucket_id = 'camp-forms'
         and public.is_active_user()
         and public.current_role() in ('Admin','Manager'));
