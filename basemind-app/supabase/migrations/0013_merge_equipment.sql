-- Merging two rows that turned out to be the same thing.
--
-- The inventory grows by hand, so the same kit gets entered twice under
-- slightly different names. Tidying that up by deleting one row is a trap:
-- both equipment_loans and event_equipment reference equipment ON DELETE
-- CASCADE, so a plain delete silently takes the loan history and the camp
-- packing lists with it. Somebody tidying up their inventory would quietly
-- lose the record of who still has the thing.
--
-- So the merge moves the references first and deletes last, in one
-- transaction. SECURITY INVOKER (the default) on purpose: the caller's RLS
-- applies to every statement inside, so this can't be used to delete a row
-- the user wouldn't be allowed to delete directly.
create or replace function public.merge_equipment(keep_id uuid, drop_id uuid)
returns void
language plpgsql
as $$
declare
  keeper  public.equipment%rowtype;
  dropped public.equipment%rowtype;
begin
  if keep_id = drop_id then
    raise exception 'Cannot merge an item into itself';
  end if;

  select * into keeper from public.equipment where id = keep_id;
  if not found then
    raise exception 'Equipment % not found', keep_id;
  end if;

  select * into dropped from public.equipment where id = drop_id;
  if not found then
    raise exception 'Equipment % not found', drop_id;
  end if;

  -- Loans move across. This is the whole reason the function exists.
  update public.equipment_loans
     set equipment_id = keep_id
   where equipment_id = drop_id;

  -- Packing lists are harder: event_equipment is unique on
  -- (event_id, equipment_id), so on any camp that lists BOTH items a blind
  -- repoint would collide. Fold those together first...
  update public.event_equipment ee
     set quantity = ee.quantity + dup.quantity
    from public.event_equipment dup
   where ee.equipment_id = keep_id
     and dup.equipment_id = drop_id
     and dup.event_id = ee.event_id;

  -- ...drop the rows just folded in...
  delete from public.event_equipment
   where equipment_id = drop_id
     and event_id in (
       select event_id from public.event_equipment where equipment_id = keep_id
     );

  -- ...and repoint the camps that only listed the loser.
  update public.event_equipment
     set equipment_id = keep_id
   where equipment_id = drop_id;

  -- Two rows of six are six of one thing, so the counts add up. Notes are
  -- kept rather than overwritten: whichever row carried the useful line
  -- about a broken regulator, it survives.
  update public.equipment
     set quantity = keeper.quantity + dropped.quantity,
         notes = case
           when dropped.notes is null or btrim(dropped.notes) = '' then keeper.notes
           when keeper.notes  is null or btrim(keeper.notes)  = '' then dropped.notes
           when btrim(keeper.notes) = btrim(dropped.notes)         then keeper.notes
           else keeper.notes || chr(10) || dropped.notes
         end,
         -- Keep the more cautious condition. Merging a Broken row into a
         -- Good one and reporting "Good" would lose the only warning.
         condition = case
           when 'Broken'       in (keeper.condition, dropped.condition) then 'Broken'
           when 'Missing'      in (keeper.condition, dropped.condition) then 'Missing'
           when 'Needs Repair' in (keeper.condition, dropped.condition) then 'Needs Repair'
           else keeper.condition
         end,
         -- A merge must never make kit look better inspected than it is.
         -- least() ignores nulls, so using it alone would take "never
         -- checked" plus "checked in March" and call the whole lot checked
         -- in March. If either row was never checked, part of this stock
         -- genuinely hasn't been, so the merged row is never-checked too.
         date_last_checked = case
           when keeper.date_last_checked is null or dropped.date_last_checked is null then null
           else least(keeper.date_last_checked, dropped.date_last_checked)
         end,
         checked_by = case
           when keeper.date_last_checked is null or dropped.date_last_checked is null then null
           when dropped.date_last_checked < keeper.date_last_checked then dropped.checked_by
           else keeper.checked_by
         end,
         -- Next check is the opposite case: the sooner of the two is the
         -- cautious answer, and a null there is "nothing scheduled" rather
         -- than a claim, so letting the real date win is right.
         next_check_date = least(keeper.next_check_date, dropped.next_check_date)
   where id = keep_id;

  delete from public.equipment where id = drop_id;
end;
$$;
