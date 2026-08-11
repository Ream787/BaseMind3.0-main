-- BaseMind: single-group equipment tracker with role-based access control.
-- Run this once against a fresh Supabase project via the SQL Editor
-- (or `supabase db push` if you're using the CLI).

create extension if not exists "uuid-ossp";

-- =====================================================================
-- USERS PROFILE TABLE
-- =====================================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null default '',
  phone text,
  role text not null check (role in ('Admin','Manager','Member','Viewer')) default 'Viewer',
  status text not null check (status in ('Pending','Active','Rejected')) default 'Pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- EQUIPMENT TABLE
-- =====================================================================
create table public.equipment (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text,
  quantity integer not null default 1 check (quantity >= 0),
  location text not null,
  condition text not null check (condition in ('Good','Needs Repair','Broken','Missing')) default 'Good',
  notes text,
  date_last_checked date,
  next_check_date date,
  checked_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_equipment_condition on public.equipment(condition);

-- =====================================================================
-- updated_at TRIGGERS
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger trg_equipment_updated_at before update on public.equipment
  for each row execute function public.set_updated_at();

-- =====================================================================
-- AUTO-CREATE PROFILE ROW ON SIGNUP
-- role/status are hard-coded here regardless of what the client sends,
-- so self-registration can never grant itself elevated access.
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, name, phone, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'phone',
    'Viewer',
    'Pending'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- RLS HELPER FUNCTIONS
-- SECURITY DEFINER so they bypass RLS internally — this avoids the
-- self-referential-policy recursion you get from querying `users` from
-- inside a policy defined ON `users`.
-- =====================================================================
create or replace function public.current_role()
returns text language sql security definer stable set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_active_user()
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from public.users where id = auth.uid() and status = 'Active');
$$;

-- =====================================================================
-- Lock role/status against self-escalation.
-- RLS's WITH CHECK can gate a whole row but not individual columns, so a
-- user allowed to UPDATE their own row could otherwise set role='Admin'
-- themselves. This trigger silently reverts those two columns back to
-- their previous value unless the actor is an Active Admin.
-- =====================================================================
create or replace function public.protect_user_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() is distinct from 'Admin' then
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$;

create trigger trg_protect_user_fields before update on public.users
  for each row execute function public.protect_user_fields();

-- =====================================================================
-- RLS: users
-- =====================================================================
alter table public.users enable row level security;

create policy users_select on public.users for select
  using (auth.uid() = id or public.is_active_user());

create policy users_update on public.users for update
  using (auth.uid() = id or (public.current_role() = 'Admin' and public.is_active_user()))
  with check (auth.uid() = id or (public.current_role() = 'Admin' and public.is_active_user()));

create policy users_delete on public.users for delete
  using (public.current_role() = 'Admin' and public.is_active_user());

-- No INSERT policy: the only path in is the SECURITY DEFINER trigger
-- above, which bypasses RLS. Client-initiated inserts are default-denied.

-- =====================================================================
-- RLS: equipment
-- Pending/Rejected users fail is_active_user() on every policy below, so
-- they're blocked at the database even if they call the REST API
-- directly with a valid JWT — not just hidden from the UI.
-- =====================================================================
alter table public.equipment enable row level security;

create policy equipment_select on public.equipment for select
  using (public.is_active_user());

create policy equipment_insert on public.equipment for insert
  with check (public.is_active_user() and public.current_role() in ('Admin','Manager','Member'));

create policy equipment_update on public.equipment for update
  using (public.is_active_user() and public.current_role() in ('Admin','Manager','Member'))
  with check (public.is_active_user() and public.current_role() in ('Admin','Manager','Member'));

create policy equipment_delete on public.equipment for delete
  using (public.is_active_user() and public.current_role() in ('Admin','Manager'));

-- =====================================================================
-- REALTIME
-- =====================================================================
alter publication supabase_realtime add table public.equipment;

-- =====================================================================
-- FIRST ADMIN BOOTSTRAP
-- There's no admin yet to approve the first user, so: sign up normally
-- through the app's /register page, then run this once (with your own
-- email) in the SQL Editor to promote that account:
--
--   update public.users set role = 'Admin', status = 'Active'
--   where email = 'you@example.com';
-- =====================================================================
