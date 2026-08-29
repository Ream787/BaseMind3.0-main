import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { addMonths, format, parseISO } from "date-fns";
import { useNavigate } from "react-router";
import { ArrowLeft, Check, Plus, QrCode, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useOffline } from "@/context/OfflineContext";
import { useEquipment } from "@/context/EquipmentContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { canonical } from "@/lib/boxes";
import { boxContents, unplacedQuantity, byEquipment } from "@/lib/placements";
import type { Equipment, EquipmentPlacement } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BoxQrCode } from "@/components/boxes/BoxQrCode";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

/** How long a check is good for. Matches the button on the equipment list. */
const MONTHS_UNTIL_NEXT_CHECK = 6;

/**
 * One box: what should be in it, and checking that it is.
 *
 * The check is per item and immediate — each tap writes straight away rather
 * than collecting into a Save at the end. Half a stock check that was saved
 * is worth more than a whole one lost because a phone slept in a store room
 * with no signal.
 */
export function BoxDetailPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { profile, hasRole } = useAuth();
  const { online } = useOffline();
  const { equipment, updateEquipment } = useEquipment();
  const { rows: boxes, loading } = useRealtimeTable("equipment_boxes", { orderBy: "name" });
  const { rows: placements } = useRealtimeTable("equipment_placements");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  // Same bar as deleting equipment: getting rid of a box is a decision about
  // everyone's store, not about the item in your hand.
  const canDelete = hasRole(["Admin", "Manager"]);

  /**
   * Why the write controls are shut, if they are.
   *
   * Checking kit and moving it between boxes are UPDATES, and the offline
   * outbox only carries new rows. Taking a tap and dropping it would be worse
   * than not offering it: someone would walk away believing the box had been
   * checked.
   */
  const blocked = !online ? "You're offline — changes can't be saved yet" : null;

  const box = useMemo(
    () => boxes.find((b) => canonical(b.code) === canonical(code)),
    [boxes, code],
  );

  const equipmentById = useMemo(
    () => new Map(equipment.map((e) => [e.id, e])),
    [equipment],
  );
  const placementsByItem = useMemo(() => byEquipment(placements), [placements]);

  /** What is in this box, and how many of each. */
  const contents = useMemo(
    () => (box ? boxContents(box.id, placements, equipmentById) : []),
    [box, placements, equipmentById],
  );

  /**
   * What could be added: anything not already in this box, with how many are
   * still unaccounted for. Adding kit you already own should reuse that row —
   * a second "Rope" is exactly the duplicate the tidy-up pass has to clean up.
   */
  const addable = useMemo(() => {
    const here = new Set(contents.map((c) => c.item.id));
    const term = newItem.trim().toLowerCase();
    if (term.length < 1) return [];
    return equipment
      .filter((item) => !here.has(item.id) && item.name.toLowerCase().includes(term))
      .slice(0, 6)
      .map((item) => ({
        item,
        spare: unplacedQuantity(item, placementsByItem.get(item.id) ?? []),
      }));
  }, [equipment, contents, newItem, placementsByItem]);

  // Keep the editable header in step with the box, without clobbering what
  // someone is halfway through typing.
  useEffect(() => {
    if (!box) return;
    setDraftName((prev) => (prev === "" ? box.name : prev));
    setDraftLocation((prev) => (prev === "" ? box.location : prev));
  }, [box]);

  const locations = useMemo(
    () => Array.from(new Set(equipment.map((e) => e.location).filter(Boolean))).sort(),
    [equipment],
  );

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading box…</p>;
  }

  if (!box) {
    return (
      <div className="flex flex-col gap-3">
        <Link to="/equipment" className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" />
          Equipment
        </Link>
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
          <p>No box with the code {canonical(code)}.</p>
          <p className="text-xs">
            Scan its sticker from the equipment page and it will be created.
          </p>
        </div>
      </div>
    );
  }

  async function saveHeader() {
    if (!box) return;
    const name = draftName.trim() || box.name;
    const location = draftLocation.trim() || box.location;
    if (name === box.name && location === box.location) return;
    const { error } = await supabase
      .from("equipment_boxes")
      .update({ name, location })
      .eq("id", box.id);
    if (error) toast.error(error.message);
  }

  /** Present: stamp the check and clear a stale "Missing". */
  async function markPresent(item: Equipment) {
    setBusyId(item.id);
    const today = new Date();
    try {
      await updateEquipment(item.id, {
        date_last_checked: format(today, "yyyy-MM-dd"),
        next_check_date: format(addMonths(today, MONTHS_UNTIL_NEXT_CHECK), "yyyy-MM-dd"),
        checked_by: profile?.id ?? null,
        // Finding something that was written off is good news, and leaving
        // it marked Missing would make the next check wrong.
        ...(item.condition === "Missing" ? { condition: "Good" as const } : {}),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't record that.");
    } finally {
      setBusyId(null);
    }
  }

  /** Missing: still a completed check — you looked, and it wasn't there. */
  async function markMissing(item: Equipment) {
    setBusyId(item.id);
    const today = new Date();
    try {
      await updateEquipment(item.id, {
        condition: "Missing",
        date_last_checked: format(today, "yyyy-MM-dd"),
        next_check_date: format(addMonths(today, MONTHS_UNTIL_NEXT_CHECK), "yyyy-MM-dd"),
        checked_by: profile?.id ?? null,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't record that.");
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Remove the box, leaving what was in it loose in the room.
   *
   * The contents are tipped out rather than deleted: placements cascade from
   * the box, so a plain delete would take the record of six mallets being in
   * the container with it and nobody would find out until they went looking.
   */
  async function removeBox(keepContents: boolean) {
    if (!box) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_equipment_box", {
        p_box_id: box.id,
        p_keep_contents: keepContents,
      });
      if (error) throw new Error(error.message);
      toast.success(
        keepContents && contents.length > 0
          ? `${box.name} removed — its ${contents.length === 1 ? "item is" : "items are"} now loose in ${box.location}`
          : `${box.name} removed`,
      );
      navigate("/equipment");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that box.");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  /** Put some of an item that already exists into this box. */
  async function addExisting(item: Equipment, quantity: number) {
    if (!box) return;
    setAdding(true);
    try {
      const { error } = await supabase.rpc("place_equipment", {
        p_equipment_id: item.id,
        p_box_id: box.id,
        p_location: null,
        p_quantity: quantity,
      });
      if (error) throw new Error(error.message);
      setNewItem("");
      setNewQuantity("1");
      toast.success(`${quantity} × ${item.name} in ${box.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that.");
    } finally {
      setAdding(false);
    }
  }

  /** Nothing of that name exists yet, so create the item and place it here. */
  async function addNew() {
    if (!box) return;
    const name = newItem.trim();
    const quantity = Math.max(1, Number(newQuantity) || 1);
    if (!name) return;
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from("equipment")
        .insert({
          name,
          category: null,
          quantity,
          // The box's room, so the room views agree without anyone
          // having to set it in two places.
          location: box.location,
          condition: "Good",
          notes: null,
          date_last_checked: null,
          next_check_date: null,
          checked_by: null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      const { error: placeError } = await supabase.rpc("place_equipment", {
        p_equipment_id: data.id,
        p_box_id: box.id,
        p_location: null,
        p_quantity: quantity,
      });
      if (placeError) throw new Error(placeError.message);

      setNewItem("");
      setNewQuantity("1");
      toast.success(`${name} added to ${box.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that item.");
    } finally {
      setAdding(false);
    }
  }

  /** Change how many of something are in here; 0 takes it out of the box. */
  async function setPlacedQuantity(placement: EquipmentPlacement, quantity: number) {
    if (!box) return;
    setBusyId(placement.equipment_id);
    try {
      const { error } = await supabase.rpc("place_equipment", {
        p_equipment_id: placement.equipment_id,
        p_box_id: box.id,
        p_location: null,
        p_quantity: quantity,
      });
      if (error) throw new Error(error.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change that.");
    } finally {
      setBusyId(null);
    }
  }

  const checkedToday = contents.filter(
    ({ item }) => item.date_last_checked === format(new Date(), "yyyy-MM-dd"),
  ).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Back to the room this box sits in, since that is where boxes are
          listed — there is no separate boxes page any more. */}
      <Link
        to="/equipment"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Equipment
      </Link>

      {/* Stacked on a phone. Side by side, the name and store fields and the
          code badge shared one 375px row and left each field 76px wide, which
          is not enough to read "Cooking box 1" in. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {canEdit ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Label htmlFor="box-name" className="text-xs text-muted-foreground">
                  Name
                </Label>
                <Input
                  id="box-name"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={saveHeader}
                  disabled={blocked !== null}
                  placeholder="Cooking box 1"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Label htmlFor="box-location" className="text-xs text-muted-foreground">
                  Store
                </Label>
                <Input
                  id="box-location"
                  list="box-location-options"
                  value={draftLocation}
                  onChange={(e) => setDraftLocation(e.target.value)}
                  onBlur={saveHeader}
                  disabled={blocked !== null}
                  placeholder="Store Room"
                />
                <datalist id="box-location-options">
                  {locations.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </div>
            </div>
          ) : (
            <div>
              <h1>{box.name}</h1>
              <p className="text-sm text-muted-foreground">{box.location}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {contents.length} {contents.length === 1 ? "item" : "items"}
            {checkedToday > 0 && ` · ${checkedToday} checked today`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {box.code}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setShowQr((v) => !v)}>
            <QrCode className="size-4" />
            {showQr ? "Hide" : "Sticker"}
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${box.name}`}
              disabled={deleting || blocked !== null}
              title={blocked ?? `Remove ${box.name}`}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {showQr && <BoxQrCode code={box.code} name={box.name} />}

      {contents.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
          <p>Nothing in this box yet.</p>
          {canEdit && <p className="text-xs">Add what&apos;s in front of you, below.</p>}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {contents.map(({ item, placement }) => {
            const busy = busyId === item.id;
            const missing = item.condition === "Missing";
            return (
              <li
                key={placement.id}
                className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 ${
                  missing ? "border-destructive/40 bg-destructive/5" : "bg-card"
                }`}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">
                    {item.name}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      ×{placement.quantity}
                      {placement.quantity !== item.quantity && ` of ${item.quantity}`}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {missing && "Marked missing · "}
                    {item.date_last_checked
                      ? `checked ${format(parseISO(item.date_last_checked), "d MMM yyyy")}`
                      : "never checked"}
                  </span>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-1">
                    {/* How many are in THIS box, not how many exist. */}
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      aria-label={`How many ${item.name} are in this box`}
                      className="h-8 w-16"
                      defaultValue={placement.quantity}
                      disabled={busy || blocked !== null}
                      onBlur={(e) => {
                        const next = Math.max(0, Number(e.target.value) || 0);
                        if (next !== placement.quantity) void setPlacedQuantity(placement, next);
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      disabled={busy || blocked !== null}
                      onClick={() => markPresent(item)}
                    >
                      <Check className="size-4" />
                      Here
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      disabled={busy || blocked !== null}
                      onClick={() => markMissing(item)}
                    >
                      <X className="size-4" />
                      Missing
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              placeholder={blocked ?? "Add something in this box…"}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              disabled={adding || blocked !== null}
            />
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              aria-label="How many"
              className="w-20"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              disabled={adding || blocked !== null}
            />
          </div>

          {/* Existing kit first, so adding rope you already own reuses that
              row instead of creating a second "Rope" for the tidy-up pass to
              find later. Creating a new item is the fallback, not the default. */}
          {addable.length > 0 && (
            <ul className="flex flex-col gap-1">
              {addable.map(({ item, spare }) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={adding || blocked !== null}
                    onClick={() =>
                      addExisting(item, Math.max(1, Number(newQuantity) || 1))
                    }
                    className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <span className="min-w-0 truncate">{item.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {spare > 0 ? `${spare} not placed` : `${item.quantity} owned`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {newItem.trim() && (
            <Button
              variant={addable.length > 0 ? "outline" : "default"}
              disabled={adding || blocked !== null}
              onClick={addNew}
            >
              <Plus className="size-4" />
              {addable.length > 0
                ? `Not one of those — add "${newItem.trim()}" as new`
                : `Add "${newItem.trim()}"`}
            </Button>
          )}
        </div>
      )}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {box.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {contents.length === 0
                ? "The box is empty, so nothing else changes. Its sticker code stops working — scanning it again would make a new box."
                : contents.length === 1
                  ? `The item in it stays in the inventory and becomes loose in ${box.location}. Nothing is deleted except the box itself.`
                  : `The ${contents.length} items in it stay in the inventory and become loose in ${box.location}. Nothing is deleted except the box itself.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={() => removeBox(true)}>
              Remove the box
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
