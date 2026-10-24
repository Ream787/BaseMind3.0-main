-- ---------------------------------------------------------------------
-- Check who you are once per query, not once per row
--
-- Every policy on the equipment tables calls public.is_active_user(), and
-- most also call public.current_role(). Both are SECURITY DEFINER
-- functions that query public.users. Written bare, Postgres evaluates
-- them for every row the query touches:
--
--   Seq Scan on rooms
--     Filter: is_active_user()
--     Rows Removed by Filter: 5      <- ran five times
--
-- Wrapped in a scalar subquery they become an InitPlan, evaluated once
-- and reused:
--
--   Seq Scan on rooms
--     Filter: (InitPlan 1).col1
--     InitPlan 1 -> Result (actual rows=1 loops=1)
--
-- The permissions are untouched: same roles, same ladder, same
-- functions. Only how often they are asked changes.
--
-- Worth being honest about the size of this: with 17 items and 18
-- placements the saving is microseconds, and nobody would notice. It is
-- here because it is free, because every one of those calls is a query
-- against users rather than arithmetic, and because the cost grows with
-- the row count while the fix does not. It is also what the Supabase
-- linter asks for on the tables it can see this pattern on.
--
-- ALTER rather than DROP and CREATE, so there is never an instant where
-- a table is unprotected.
-- ---------------------------------------------------------------------

-- rooms
alter policy rooms_select on public.rooms
  using ((select public.is_active_user()));
alter policy rooms_insert on public.rooms
  with check ((select public.is_active_user())
              and (select public.current_role()) in ('Admin','Manager','Member'));
alter policy rooms_update on public.rooms
  using ((select public.is_active_user())
         and (select public.current_role()) in ('Admin','Manager','Member'))
  with check ((select public.is_active_user())
              and (select public.current_role()) in ('Admin','Manager','Member'));
alter policy rooms_delete on public.rooms
  using ((select public.is_active_user())
         and (select public.current_role()) in ('Admin','Manager'));

-- equipment
alter policy equipment_select on public.equipment
  using ((select public.is_active_user()));
alter policy equipment_insert on public.equipment
  with check ((select public.is_active_user())
              and (select public.current_role()) in ('Admin','Manager','Member'));
alter policy equipment_update on public.equipment
  using ((select public.is_active_user())
         and (select public.current_role()) in ('Admin','Manager','Member'))
  with check ((select public.is_active_user())
              and (select public.current_role()) in ('Admin','Manager','Member'));
alter policy equipment_delete on public.equipment
  using ((select public.is_active_user())
         and (select public.current_role()) in ('Admin','Manager'));

-- equipment_placements. Note the delete ladder here includes Member, and
-- stays that way: taking kit out of a box is editing, not restructuring.
alter policy equipment_placements_select on public.equipment_placements
  using ((select public.is_active_user()));
alter policy equipment_placements_insert on public.equipment_placements
  with check ((select public.is_active_user())
              and (select public.current_role()) in ('Admin','Manager','Member'));
alter policy equipment_placements_update on public.equipment_placements
  using ((select public.is_active_user())
         and (select public.current_role()) in ('Admin','Manager','Member'))
  with check ((select public.is_active_user())
              and (select public.current_role()) in ('Admin','Manager','Member'));
alter policy equipment_placements_delete on public.equipment_placements
  using ((select public.is_active_user())
         and (select public.current_role()) in ('Admin','Manager','Member'));

-- storage_places, whose policies still carry their original box names.
alter policy equipment_boxes_select on public.storage_places
  using ((select public.is_active_user()));
alter policy equipment_boxes_insert on public.storage_places
  with check ((select public.is_active_user())
              and (select public.current_role()) in ('Admin','Manager','Member'));
alter policy equipment_boxes_update on public.storage_places
  using ((select public.is_active_user())
         and (select public.current_role()) in ('Admin','Manager','Member'))
  with check ((select public.is_active_user())
              and (select public.current_role()) in ('Admin','Manager','Member'));
alter policy equipment_boxes_delete on public.storage_places
  using ((select public.is_active_user())
         and (select public.current_role()) in ('Admin','Manager'));
