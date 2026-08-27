-- Boxes: the layer between a room and the kit inside it.
--
-- "Where is it?" was answered down to the room, which is fine for a tent and
-- useless for a mallet. Kit actually lives in boxes, and a box is what you
-- carry to camp, hand to a patrol and check back in afterwards. This adds
-- that layer so the question can be answered the way people ask it: which
-- box, in which store.
--
-- Each box carries a QR sticker. Scanning it opens the box, so checking kit
-- is done standing over the box with a phone rather than afterwards from
-- memory, which is the whole point.

create table public.equipment_boxes (
  id uuid primary key default uuid_generate_v4(),

  -- What the QR sticker encodes. Short and human-readable on purpose: the
  -- camera fails often enough — bad light, cracked screen, a sticker that
  -- has been in a damp store all winter — that typing it in has to stay a
  -- real option. Generated without I, O, 0 or 1 so it can be read aloud.
  code text not null,

  name text not null default 'New box',
  -- The store or room the box lives in. Free text and not a foreign key,
  -- matching equipment.location, so the two agree about what a room is.
  location text not null default 'Unassigned',
  notes text,

  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Codes are matched case-insensitively: a code read off a sticker and typed
-- in by hand should find the box whichever way it is capitalised.
create unique index idx_equipment_boxes_code on public.equipment_boxes (upper(code));
create index idx_equipment_boxes_location on public.equipment_boxes (location);

-- ---------------------------------------------------------------------
-- Kit knows which box it is in
--
-- ON DELETE SET NULL, emphatically not CASCADE: deleting a box means the
-- box is gone, not that six mallets stopped existing. The kit falls back to
-- being loose in its room, which is recoverable; deleting it is not.
-- ---------------------------------------------------------------------
alter table public.equipment
  add column box_id uuid references public.equipment_boxes(id) on delete set null;

create index idx_equipment_box on public.equipment (box_id) where box_id is not null;

create trigger trg_equipment_boxes_updated_at before update on public.equipment_boxes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: the same model as equipment itself. Anyone active can look in a
-- box; Members and above can create one and put things in it; only
-- Managers and Admins can delete one.
-- ---------------------------------------------------------------------
alter table public.equipment_boxes enable row level security;

create policy equipment_boxes_select on public.equipment_boxes for select
  using (public.is_active_user());

create policy equipment_boxes_insert on public.equipment_boxes for insert
  with check (public.is_active_user()
              and public.current_role() in ('Admin','Manager','Member'));

create policy equipment_boxes_update on public.equipment_boxes for update
  using (public.is_active_user()
         and public.current_role() in ('Admin','Manager','Member'))
  with check (public.is_active_user()
              and public.current_role() in ('Admin','Manager','Member'));

create policy equipment_boxes_delete on public.equipment_boxes for delete
  using (public.is_active_user()
         and public.current_role() in ('Admin','Manager'));

alter publication supabase_realtime add table public.equipment_boxes;
