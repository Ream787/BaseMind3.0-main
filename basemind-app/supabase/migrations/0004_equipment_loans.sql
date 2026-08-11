-- Borrowing: who has what, and when it's due back.
--
-- Borrower details are stored on the loan itself rather than in a people
-- table. Borrowers are occasional and often from other groups, so a full
-- contacts table would be more to maintain than it's worth; the UI offers
-- autocomplete from previous loans to save retyping.

create table public.equipment_loans (
  id uuid primary key default uuid_generate_v4(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),

  borrower_name text not null,
  scout_group text,
  -- Free text rather than an enum: PL, APL, Scouter, Rover, Parent and
  -- whatever else a group uses. Not every borrower holds a position.
  position text,
  phone text,
  email text,

  borrowed_on date not null default current_date,
  due_back date,
  -- NULL while the item is still out; set when it comes back.
  returned_on date,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint loans_due_after_borrowed
    check (due_back is null or due_back >= borrowed_on),
  constraint loans_returned_after_borrowed
    check (returned_on is null or returned_on >= borrowed_on)
);

-- Outstanding loans are the common query (the loans page, and the
-- availability count on every equipment row), so index for it.
create index idx_equipment_loans_outstanding
  on public.equipment_loans (equipment_id)
  where returned_on is null;

create index idx_equipment_loans_due_back
  on public.equipment_loans (due_back)
  where returned_on is null;

create trigger trg_equipment_loans_updated_at before update on public.equipment_loans
  for each row execute function public.set_updated_at();

-- =====================================================================
-- RLS - same role model as the rest of the app
-- =====================================================================
alter table public.equipment_loans enable row level security;

create policy equipment_loans_select on public.equipment_loans for select
  using (public.is_active_user());

create policy equipment_loans_insert on public.equipment_loans for insert
  with check (public.is_active_user()
              and public.current_role() in ('Admin','Manager','Member'));

-- Members can lend out and mark returned; deleting a loan erases the record
-- that it ever happened, so that stays with Admin/Manager.
create policy equipment_loans_update on public.equipment_loans for update
  using (public.is_active_user()
         and public.current_role() in ('Admin','Manager','Member'))
  with check (public.is_active_user()
              and public.current_role() in ('Admin','Manager','Member'));

create policy equipment_loans_delete on public.equipment_loans for delete
  using (public.is_active_user()
         and public.current_role() in ('Admin','Manager'));

alter publication supabase_realtime add table public.equipment_loans;
