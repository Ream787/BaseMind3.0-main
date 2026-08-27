import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { addMonths, format, parseISO } from "date-fns";
import { ArrowLeft, Check, Plus, QrCode, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useEquipment } from "@/context/EquipmentContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { canonical } from "@/lib/boxes";
import type { Equipment } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BoxQrCode } from "@/components/boxes/BoxQrCode";

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
  const { profile, hasRole } = useAuth();
  const { equipment, updateEquipment, addEquipment } = useEquipment();
  const { rows: boxes, loading } = useRealtimeTable("equipment_boxes", { orderBy: "name" });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftLocation, setDraftLocation] = useState("");

  const canEdit = hasRole(["Admin", "Manager", "Member"]);

  const box = useMemo(
    () => boxes.find((b) => canonical(b.code) === canonical(code)),
    [boxes, code],
  );

  const contents = useMemo(
    () =>
      equipment
        .filter((item) => item.box_id === box?.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [equipment, box?.id],
  );

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
        <Link to="/boxes" className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" />
          All boxes
        </Link>
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
          <p>No box with the code {canonical(code)}.</p>
          <p className="text-xs">Scan its sticker from the boxes page and it will be created.</p>
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

  async function addToBox() {
    if (!box) return;
    const name = newItem.trim();
    if (!name) return;
    setAdding(true);
    try {
      await addEquipment({
        name,
        category: null,
        quantity: 1,
        // The box's room, so the "By room" view stays truthful without
        // anyone having to set it twice.
        location: box.location,
        condition: "Good",
        notes: null,
        date_last_checked: null,
        next_check_date: null,
        checked_by: null,
        label_colour: null,
        box_id: box.id,
      });
      setNewItem("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that item.");
    } finally {
      setAdding(false);
    }
  }

  const checkedToday = contents.filter(
    (item) =>
      item.date_last_checked === format(new Date(), "yyyy-MM-dd"),
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <Link to="/boxes" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        All boxes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Label htmlFor="box-name" className="text-xs text-muted-foreground">
                  Name
                </Label>
                <Input
                  id="box-name"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={saveHeader}
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
          {contents.map((item) => {
            const busy = busyId === item.id;
            const missing = item.condition === "Missing";
            return (
              <li
                key={item.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${
                  missing ? "border-destructive/40 bg-destructive/5" : "bg-card"
                }`}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">
                    {item.name}
                    {item.quantity !== 1 && (
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        ×{item.quantity}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {missing && "Marked missing · "}
                    {item.date_last_checked
                      ? `checked ${format(parseISO(item.date_last_checked), "d MMM yyyy")}`
                      : "never checked"}
                  </span>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => markPresent(item)}
                    >
                      <Check className="size-4" />
                      Here
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
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
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addToBox();
          }}
        >
          <Input
            placeholder="Add something you found in this box…"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            disabled={adding}
          />
          <Button type="submit" disabled={adding || !newItem.trim()}>
            <Plus className="size-4" />
            Add
          </Button>
        </form>
      )}
    </div>
  );
}
