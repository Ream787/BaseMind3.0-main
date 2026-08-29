import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Box, ChevronRight, Plus, QrCode, Search, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { addMonths, format } from "date-fns";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useOffline } from "@/context/OfflineContext";
import { useEquipment } from "@/context/EquipmentContext";
import type { Equipment, EquipmentCondition } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { EquipmentTable } from "@/components/equipment/EquipmentTable";
import { EquipmentFormDialog } from "@/components/equipment/EquipmentFormDialog";
import { EquipmentGroupGrid } from "@/components/equipment/EquipmentGroupGrid";
import { EquipmentCleanupDialog } from "@/components/equipment/EquipmentCleanupDialog";
import { QrScannerDialog } from "@/components/boxes/QrScannerDialog";
import { generateBoxCode } from "@/lib/boxes";
import {
  byEquipment,
  describePlacements,
  looseInRoom,
  roomKey,
  roomOf,
  roomsInUse,
} from "@/lib/placements";
import { LoanFormDialog } from "@/components/loans/LoanFormDialog";
import { SectionTabs, EQUIPMENT_TABS } from "@/components/layout/SectionTabs";
import { groupKeyFor, UNGROUPED_LABEL, type GroupBy } from "@/lib/groupEquipment";
import { useRealtimeTable } from "@/lib/useRealtimeTable";

const CONDITION_FILTERS: (EquipmentCondition | "All")[] = [
  "All",
  "Good",
  "Needs Repair",
  "Broken",
  "Missing",
];

type View = "all" | GroupBy;

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "location", label: "By room" },
  { value: "category", label: "By category" },
  { value: "all", label: "All items" },
];

interface UserOption {
  id: string;
  name: string;
}

export function EquipmentPage() {
  const navigate = useNavigate();
  const { hasRole, profile } = useAuth();
  const { online } = useOffline();
  const { equipment, loading, error, updateEquipment } = useEquipment();
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState<EquipmentCondition | "All">("All");
  const [view, setView] = useState<View>("location");
  const [openGroup, setOpenGroup] = useState<{ key: string; name: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);
  const [lendOpen, setLendOpen] = useState(false);
  const [lendItemId, setLendItemId] = useState<string | undefined>();

  const { rows: loans } = useRealtimeTable("equipment_loans");
  const { rows: boxes } = useRealtimeTable("equipment_boxes", { orderBy: "name" });
  const { rows: placements } = useRealtimeTable("equipment_placements");

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);
  // Tidying merges rows and renames rooms across the whole inventory, so it
  // sits with deleting rather than with editing: a Member can correct the
  // item in front of them, not restructure everyone else's list.
  const canTidy = hasRole(["Admin", "Manager"]);

  /**
   * Why the write controls are shut, if they are.
   *
   * Everything here is an update or needs the network — checking an item,
   * creating a box, asking the model to look for duplicates. The offline
   * outbox only carries new rows, so offering these and dropping them would
   * leave somebody believing a check had been recorded when it hadn't.
   */
  const blocked = !online ? "You're offline — changes can't be saved yet" : null;

  useEffect(() => {
    supabase
      .from("users")
      .select("id, name")
      .eq("status", "Active")
      .order("name")
      .then(({ data }) => setUsers(data ?? []));
  }, []);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  const categories = useMemo(
    () => Array.from(new Set(equipment.map((e) => e.category).filter((c): c is string => !!c))).sort(),
    [equipment],
  );
  const locations = useMemo(
    () => Array.from(new Set(equipment.map((e) => e.location).filter(Boolean))).sort(),
    [equipment],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return equipment.filter((item) => {
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.location.toLowerCase().includes(term) ||
        (item.category ?? "").toLowerCase().includes(term);
      const matchesCondition = conditionFilter === "All" || item.condition === conditionFilter;
      return matchesSearch && matchesCondition;
    });
  }, [equipment, search, conditionFilter]);

  // Inside an open room/category, narrow further to just that group's items.
  const visibleItems = useMemo(() => {
    if (view === "all" || openGroup === null) return filtered;
    return filtered.filter((item) => groupKeyFor(item, view) === openGroup.key);
  }, [filtered, view, openGroup]);

  const boxesById = useMemo(() => new Map(boxes.map((b) => [b.id, b])), [boxes]);
  const equipmentById = useMemo(
    () => new Map(equipment.map((e) => [e.id, e])),
    [equipment],
  );
  const placementsByItem = useMemo(() => byEquipment(placements), [placements]);

  /** Boxes per room, keyed the way the room grid keys its groups. */
  const boxesByRoom = useMemo(() => {
    const map = new Map<string, typeof boxes>();
    for (const box of boxes) {
      const key = roomKey(box.location.trim() || UNGROUPED_LABEL.location);
      const bucket = map.get(key);
      if (bucket) bucket.push(box);
      else map.set(key, [box]);
    }
    return map;
  }, [boxes]);

  const boxCounts = useMemo(
    () => new Map([...boxesByRoom].map(([key, list]) => [key, list.length])),
    [boxesByRoom],
  );

  /**
   * The rooms, built from placements rather than from a column on the item.
   *
   * This is what lets four tents be in the loft and two in the container:
   * grouping by item.location can only ever put a row in one bucket, and the
   * whole point of placements is that one item is in several places.
   */
  const roomGroups = useMemo(() => {
    if (view !== "location") return undefined;

    const visible = new Set(filtered.map((item) => item.id));
    const rooms = roomsInUse(placements, boxes);

    return rooms.map(({ key, name }) => {
      const inRoom = placements.filter((p) => {
        const room = roomOf(p, boxesById);
        return room !== null && roomKey(room) === key && visible.has(p.equipment_id);
      });
      const items = [...new Set(inRoom.map((p) => p.equipment_id))]
        .map((id) => equipmentById.get(id))
        .filter((item): item is (typeof equipment)[number] => !!item);
      return {
        key,
        name,
        items,
        totalQuantity: inRoom.reduce((sum, p) => sum + p.quantity, 0),
        needsAttention: items.filter((item) => item.condition !== "Good").length,
      };
    });
  }, [view, filtered, placements, boxes, boxesById, equipmentById]);

  const openRoomBoxes = useMemo(
    () => (view === "location" && openGroup ? (boxesByRoom.get(openGroup.key) ?? []) : []),
    [view, openGroup, boxesByRoom],
  );

  const itemCountByBox = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of placements) {
      if (p.box_id) counts.set(p.box_id, (counts.get(p.box_id) ?? 0) + 1);
    }
    return counts;
  }, [placements]);

  /**
   * Inside a room, kit that is in one of its boxes is shown in that box
   * rather than again below it — that is what makes a box a subdivision of
   * the room rather than a copy of it.
   */
  const looseItems = useMemo(() => {
    if (view !== "location" || !openGroup) return visibleItems;
    const visible = new Set(filtered.map((item) => item.id));
    return looseInRoom(openGroup.name, placements, equipmentById)
      .map(({ item }) => item)
      .filter((item) => visible.has(item.id));
  }, [view, openGroup, placements, equipmentById, visibleItems, filtered]);

  /** One line per item saying where its units actually are. */
  const placementSummary = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of equipment) {
      map.set(
        item.id,
        describePlacements(item, placementsByItem.get(item.id) ?? [], boxesById),
      );
    }
    return map;
  }, [equipment, placementsByItem, boxesById]);

  function changeView(next: View) {
    setView(next);
    setOpenGroup(null);
  }

  function openAddDialog() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: Equipment) {
    setEditingItem(item);
    setDialogOpen(true);
  }

  function openLendDialog(item: Equipment) {
    setLendItemId(item.id);
    setLendOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error: deleteError } = await supabase
      .from("equipment")
      .delete()
      .eq("id", deleteTarget.id);
    if (deleteError) {
      toast.error(deleteError.message);
    } else {
      toast.success(`${deleteTarget.name} deleted`);
    }
    setDeleteTarget(null);
  }

  /**
   * Records that this item was looked at today, by whoever is signed in, and
   * schedules the next look for six months' time.
   *
   * A button rather than the edit form on purpose: checking kit happens with
   * the kit in your hands, and typing three fields on a phone in a store room
   * is how a check ends up not being recorded at all.
   */
  async function markChecked(item: Equipment) {
    setCheckingId(item.id);
    const today = new Date();
    try {
      await updateEquipment(item.id, {
        date_last_checked: format(today, "yyyy-MM-dd"),
        next_check_date: format(addMonths(today, 6), "yyyy-MM-dd"),
        checked_by: profile?.id ?? null,
      });
      toast.success(`${item.name} checked — next check ${format(addMonths(today, 6), "d MMM yyyy")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't record that check.");
    } finally {
      setCheckingId(null);
    }
  }

  /**
   * A scanned sticker always lands somewhere useful. An unknown one creates
   * its box: the person is holding a real sticker on a real box, and telling
   * them "not found" would mean walking away to add it and coming back.
   */
  async function openScanned(code: string) {
    setScanning(false);
    const existing = boxes.find((b) => b.code.toUpperCase() === code.toUpperCase());
    if (existing) {
      navigate(`/boxes/${encodeURIComponent(existing.code)}`);
      return;
    }
    if (!canEdit) {
      toast.error("That sticker isn't on a box yet, and adding one is for Members and above.");
      return;
    }
    const { data, error: createError } = await supabase
      .from("equipment_boxes")
      .insert({
        code,
        created_by: profile?.id ?? null,
        // Straight into the room being looked at, when there is one.
        ...(view === "location" && openGroup ? { location: openGroup.name } : {}),
      })
      .select()
      .single();
    if (createError || !data) {
      toast.error(createError?.message ?? "Couldn't create that box.");
      return;
    }
    toast.success(`Box ${data.code} created — name it and put things in it`);
    navigate(`/boxes/${encodeURIComponent(data.code)}`);
  }

  async function addBoxHere() {
    const { data, error: createError } = await supabase
      .from("equipment_boxes")
      .insert({
        code: generateBoxCode(),
        created_by: profile?.id ?? null,
        ...(view === "location" && openGroup ? { location: openGroup.name } : {}),
      })
      .select()
      .single();
    if (createError || !data) {
      toast.error(createError?.message ?? "Couldn't create that box.");
      return;
    }
    navigate(`/boxes/${encodeURIComponent(data.code)}`);
  }

  const showingGroupGrid = view !== "all" && openGroup === null;

  return (
    <div className="flex flex-col gap-4">
      <SectionTabs tabs={EQUIPMENT_TABS} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {openGroup ? (
            <>
              <button
                type="button"
                onClick={() => setOpenGroup(null)}
                className="mb-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                {view === "location" ? "All rooms" : "All categories"}
              </button>
              <h1>{openGroup.name}</h1>
              <p className="text-sm text-muted-foreground">
                {visibleItems.length} {visibleItems.length === 1 ? "item" : "items"}
              </p>
            </>
          ) : (
            <>
              <h1>Equipment</h1>
              <p className="text-sm text-muted-foreground">
                {filtered.length} of {equipment.length} items
              </p>
            </>
          )}
        </div>
        {/* Full width on a phone, so three buttons share the row instead of
            being squeezed to their labels' minimum. Scan comes first: it is
            the one you press standing in the store. */}
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button
            className="flex-1 sm:flex-none"
            onClick={() => setScanning(true)}
            disabled={blocked !== null}
            title={blocked ?? "Scan a box sticker"}
          >
            <QrCode className="size-4" />
            Scan a box
          </Button>
          {canEdit && (
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={openAddDialog}
              disabled={blocked !== null}
              title={blocked ?? "Add an item to the inventory"}
            >
              <Plus className="size-4" />
              Add item
            </Button>
          )}
          {canTidy && (
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => setCleanupOpen(true)}
              disabled={blocked !== null}
              title={blocked ?? "Look for duplicates and repeated spellings"}
            >
              <Sparkles className="size-4" />
              Tidy up
            </Button>
          )}
        </div>
      </div>

      {/* Stacked on a phone. Three controls on one 375px row left the search
          box about eight characters wide, which is not a search box. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="grid grid-cols-3 rounded-md border p-0.5 sm:inline-flex">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => changeView(option.value)}
              className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors sm:py-1 ${
                view === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, room, category…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={conditionFilter}
          onValueChange={(v) => setConditionFilter(v as EquipmentCondition | "All")}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDITION_FILTERS.map((c) => (
              <SelectItem key={c} value={c}>
                {c === "All" ? "All conditions" : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Loading equipment…
        </div>
      ) : showingGroupGrid ? (
        <EquipmentGroupGrid
          items={filtered}
          groupBy={view}
          onSelect={setOpenGroup}
          boxCounts={view === "location" ? boxCounts : undefined}
          groups={roomGroups}
        />
      ) : (
        <>
          {view === "location" && openGroup && (
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {openRoomBoxes.length === 0
                    ? "No boxes in here yet"
                    : `${openRoomBoxes.length} ${openRoomBoxes.length === 1 ? "box" : "boxes"}`}
                </h2>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={addBoxHere}
                    disabled={blocked !== null}
                    title={blocked ?? "Add a box to this room"}
                  >
                    <Plus className="size-4" />
                    New box
                  </Button>
                )}
              </div>
              {openRoomBoxes.length > 0 && (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {openRoomBoxes.map((box) => {
                    const count = itemCountByBox.get(box.id) ?? 0;
                    return (
                      <li key={box.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/boxes/${encodeURIComponent(box.code)}`)}
                          className="group flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent/50"
                        >
                          <Box className="size-4 shrink-0 text-primary" />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium">{box.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {count} {count === 1 ? "item" : "items"} · {box.code}
                            </span>
                          </div>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {view === "location" && openGroup && looseItems.length > 0 && (
            <h2 className="text-sm font-medium text-muted-foreground">
              Loose in this room
            </h2>
          )}

          <EquipmentTable
            items={looseItems}
            usersById={usersById}
            loans={loans}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={openEditDialog}
            onDelete={setDeleteTarget}
            onLend={openLendDialog}
            onCheck={markChecked}
            checkingId={checkingId}
            writesBlocked={blocked}
            placementSummary={placementSummary}
          />
        </>
      )}

      <QrScannerDialog open={scanning} onOpenChange={setScanning} onFound={openScanned} />

      <EquipmentCleanupDialog
        open={cleanupOpen}
        onOpenChange={setCleanupOpen}
        equipment={equipment}
      />

      <EquipmentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        equipment={editingItem}
        categories={categories}
        locations={locations}
        users={users}
      />

      <LoanFormDialog
        open={lendOpen}
        onOpenChange={setLendOpen}
        equipment={equipment}
        loans={loans}
        presetEquipmentId={lendItemId}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the item from the inventory. This can&apos;t be undone.
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
