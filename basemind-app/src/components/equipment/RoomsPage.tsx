/**
 * The rooms themselves, as a list you can maintain.
 *
 * Until now a room could only come into existence sideways — by typing a
 * name the Room picker had never seen — and could never be changed again.
 * That was the one thing the rooms table was meant to fix: the name lives
 * in a single row, so renaming "Room 5" to "Room 5 (Pioneering)" is one
 * write that the inventory, the room grid, the box trails and the camp
 * plan all follow.
 *
 * Running order is here too. Alphabetical is a poor map of a building; a
 * leader doing a stock take wants the rooms in the order they walk them.
 */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { useRoomContents } from "@/lib/useRoomContents";
import {
  describeContents,
  nameProblem,
  roomDeleteError,
  roomSaveError,
  type RoomContents,
} from "@/lib/roomErrors";
import type { Room } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionTabs, EQUIPMENT_TABS } from "@/components/layout/SectionTabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

const emptyForm = { name: "", notes: "", sort_order: "" };

/** "9 items · 14 in all · 2 storage places", or that there is nothing there. */
function contentsLine(contents: RoomContents): string {
  if (contents.items === 0 && contents.places === 0) return "Empty";
  const parts: string[] = [];
  if (contents.items > 0) {
    parts.push(`${contents.items} ${contents.items === 1 ? "item" : "items"}`);
  }
  // Only worth saying when it differs: "3 items · 3 in all" is noise.
  if (contents.units > contents.items) parts.push(`${contents.units} in all`);
  if (contents.places > 0) {
    parts.push(`${contents.places} ${contents.places === 1 ? "storage place" : "storage places"}`);
  }
  return parts.join(" · ");
}

export function RoomsPage() {
  const { hasRole } = useAuth();
  const { rows: rooms, loading, error } = useRealtimeTable("rooms");
  const { contentsOf, loading: countsLoading } = useRoomContents();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [reordering, setReordering] = useState(false);

  // The same ladder the rooms policies draw: a Member can add a room and
  // fix its name, but removing one is shared furniture and stops at Manager.
  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);

  // sort_order first, name to break ties — the order the rooms table is
  // read in everywhere else, so this list and the pickers agree.
  const sorted = useMemo(
    () =>
      [...rooms].sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [rooms],
  );

  useEffect(() => {
    if (!dialogOpen) return;
    setForm(
      editing
        ? {
            name: editing.name,
            notes: editing.notes ?? "",
            sort_order: String(editing.sort_order),
          }
        : emptyForm,
    );
  }, [dialogOpen, editing]);

  // Said while they type rather than after the save bounces: both of these
  // are rules the database will refuse on, and finding that out on submit
  // means losing the notes you typed underneath.
  const problem = dialogOpen ? nameProblem(form.name, rooms, editing?.id) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (problem) return;

    const name = form.name.trim();
    const order = Number.parseInt(form.sort_order, 10);
    const payload = {
      name,
      notes: form.notes.trim() || null,
      sort_order: Number.isFinite(order) ? order : 0,
    };

    setSubmitting(true);
    const { error: saveError } = editing
      ? await supabase.from("rooms").update(payload).eq("id", editing.id)
      : await supabase.from("rooms").insert(payload);
    setSubmitting(false);

    if (saveError) {
      toast.error(roomSaveError(saveError, name, rooms, editing?.id));
      return;
    }
    // Worth naming both sides of a rename: it is the one change here that
    // ripples through the rest of the app.
    toast.success(
      editing
        ? editing.name === name
          ? `${name} updated`
          : `${editing.name} is now ${name}`
        : `${name} added`,
    );
    setDialogOpen(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error: deleteError } = await supabase
      .from("rooms")
      .delete()
      .eq("id", deleteTarget.id);
    if (deleteError) {
      toast.error(roomDeleteError(deleteError, deleteTarget, contentsOf(deleteTarget.id)));
    } else {
      toast.success(`${deleteTarget.name} deleted`);
    }
    setDeleteTarget(null);
  }

  /**
   * Move one room up or down the walking order.
   *
   * Numbers the whole list from 1 rather than swapping two values: every
   * room starts at sort_order 0, and swapping two zeroes changes nothing.
   * Only the rows whose number actually changes are written.
   */
  async function move(room: Room, direction: -1 | 1) {
    const index = sorted.findIndex((r) => r.id === room.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;

    const next = [...sorted];
    next.splice(target, 0, ...next.splice(index, 1));
    const changed = next
      .map((r, i) => ({ room: r, sort_order: i + 1 }))
      .filter((r) => r.room.sort_order !== r.sort_order);

    setReordering(true);
    const results = await Promise.all(
      changed.map((r) =>
        supabase.from("rooms").update({ sort_order: r.sort_order }).eq("id", r.room.id),
      ),
    );
    setReordering(false);

    const failed = results.find((r) => r.error);
    if (failed?.error) toast.error(failed.error.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionTabs tabs={EQUIPMENT_TABS} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Rooms</h1>
          <p className="text-sm text-muted-foreground">
            {rooms.length} {rooms.length === 1 ? "room" : "rooms"} · renaming one here renames it
            everywhere
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add room
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Loading rooms…
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm text-muted-foreground">
          <p>No rooms yet.</p>
          <p>Add the places kit is kept, and the inventory can be filed into them.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((room, index) => {
            const contents = contentsOf(room.id);
            const occupied = contents.items > 0 || contents.places > 0;
            // Not offered on a room the database will refuse to drop. The
            // counts can still be a moment behind somebody else's filing,
            // which is what roomDeleteError is there for.
            const blocked = countsLoading
              ? "Still counting what is in here."
              : occupied
                ? `${room.name} still holds ${describeContents(contents)}. Move them somewhere else first.`
                : null;

            return (
              <li
                key={room.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-4"
              >
                <div className="flex min-w-0 flex-1 gap-3">
                  {canEdit && (
                    // Walking order, set by moving rooms rather than by
                    // guessing numbers. Hidden for anyone who cannot write.
                    <div className="flex shrink-0 flex-col">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label={`Move ${room.name} up`}
                        disabled={index === 0 || reordering}
                        onClick={() => void move(room, -1)}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label={`Move ${room.name} down`}
                        disabled={index === sorted.length - 1 || reordering}
                        onClick={() => void move(room, 1)}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                    </div>
                  )}
                  <div className="min-w-0">
                    {/* Straight through to this room's kit: the quickest way
                        to see that a rename really did follow. */}
                    <Link
                      to={`/equipment?room=${encodeURIComponent(room.name)}`}
                      className="font-medium hover:underline"
                    >
                      {room.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {countsLoading ? "Counting…" : contentsLine(contents)}
                    </p>
                    {room.notes && <p className="mt-1 text-sm">{room.notes}</p>}
                  </div>
                </div>

                <div className="flex shrink-0 gap-1">
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${room.name}`}
                      onClick={() => {
                        setEditing(room);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${room.name}`}
                      disabled={blocked !== null}
                      title={blocked ?? undefined}
                      onClick={() => setDeleteTarget(room)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add room"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "The name lives in one place, so a new name shows up across the inventory, the boxes and the camp plan."
                : "A room is wherever kit is kept — a hall store, a loft, a container."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="room-name">Name</Label>
              <Input
                id="room-name"
                required
                autoFocus
                value={form.name}
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? "room-name-problem" : undefined}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              {/* Only once there is something to complain about: an empty
                  field somebody has not typed in yet is not a mistake. */}
              {problem && form.name !== "" && (
                <p id="room-name-problem" className="text-sm text-destructive">
                  {problem}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="room-notes">Notes</Label>
              <Textarea
                id="room-notes"
                placeholder="Where the key is, which door, what else lives in there…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="room-order">Order</Label>
              <Input
                id="room-order"
                type="number"
                inputMode="numeric"
                className="max-w-28"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Lowest first; rooms sharing a number fall back to alphabetical. The arrows in the
                list set this for you.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || problem !== null}>
                {submitting ? "Saving…" : editing ? "Save changes" : "Add room"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It is empty, so nothing moves and nothing is lost. Anyone can add it again by typing
              the name into a Room picker.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
