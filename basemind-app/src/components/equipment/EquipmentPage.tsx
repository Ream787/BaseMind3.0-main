import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Box,
  ChevronRight,
  PackageCheck,
  Palette,
  Plus,
  QrCode,
  Search,
  Sparkles,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
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
import { EquipmentDetailDialog } from "@/components/equipment/EquipmentDetailDialog";
import { EquipmentFormDialog } from "@/components/equipment/EquipmentFormDialog";
import { EquipmentGroupGrid } from "@/components/equipment/EquipmentGroupGrid";
import { EquipmentCleanupDialog } from "@/components/equipment/EquipmentCleanupDialog";
import { CheckDialog } from "@/components/equipment/CheckDialog";
import { ColourIndexDialog } from "@/components/equipment/ColourIndexDialog";
import { QrScannerDialog } from "@/components/storage/QrScannerDialog";
import { PutAwayDialog } from "@/components/equipment/PutAwayDialog";
import { generateBoxCode } from "@/lib/boxes";
import {
  byEquipment,
  childrenOf,
  countWithin,
  describePlacements,
  placementParts,
  looseInRoom,
  roomKey,
  strayLooseItems,
  roomOf,
  roomsInUse,
} from "@/lib/placements";
import { LoanFormDialog } from "@/components/loans/LoanFormDialog";
import { SectionTabs, EQUIPMENT_TABS } from "@/components/layout/SectionTabs";
import { categoryKeyFor, type GroupBy } from "@/lib/groupEquipment";
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
  { value: "room", label: "By room" },
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
  const { equipment, rooms, roomsById, loading, error } = useEquipment();
  const [checking, setChecking] = useState<Equipment | null>(null);
  const [viewing, setViewing] = useState<Equipment | null>(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [puttingAway, setPuttingAway] = useState(false);
  const [coloursOpen, setColoursOpen] = useState(false);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState<EquipmentCondition | "All">("All");
  const [view, setView] = useState<View>("room");

  /**
   * Which room is open, kept in the URL rather than in component state.
   *
   * Adding a box, or scanning one, navigates away and back — and with this in
   * state that always dumped you at the top of the room list, having to find
   * your way back into the room you were standing in.
   */
  const [params, setParams] = useSearchParams();
  const openRoomName = params.get("room");
  /**
   * The open bucket: a room in the room view, a category in the category
   * view, with `key` the room's id or the folded category name.
   *
   * The URL keeps the room's NAME rather than its id — it is readable, it
   * survives being written down, and scanning a QR sticker navigates away
   * and back and has to land in the same room. It is resolved against the
   * rooms list here, once. A name that no longer matches any room falls
   * back to itself, so a renamed or deleted room shows an empty room rather
   * than silently opening a different one.
   */
  const openGroup = useMemo(() => {
    if (!openRoomName) return null;
    if (view === "room") {
      const room = rooms.find((r) => roomKey(r.name) === roomKey(openRoomName));
      if (room) return { key: room.id, name: room.name };
    }
    return { key: roomKey(openRoomName), name: openRoomName };
  }, [openRoomName, view, rooms]);

  const setOpenGroup = useCallback(
    (group: { key: string; name: string } | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (group) next.set("room", group.name);
          else next.delete("room");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);
  const [lendOpen, setLendOpen] = useState(false);
  const [lendItemId, setLendItemId] = useState<string | undefined>();

  const { rows: loans } = useRealtimeTable("equipment_loans");
  const { rows: boxes } = useRealtimeTable("storage_places", { orderBy: "name" });
  const { rows: placements } = useRealtimeTable("equipment_placements");

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);
  // Tidying merges rows and renames rooms across the whole inventory, so it
  // sits with deleting rather than with editing: a Member can correct the
  // item in front of them, not restructure everyone else's list.
  const canTidy = hasRole(["Admin", "Manager"]);
  const anyBanded = useMemo(
    () => equipment.some((item) => item.label_colour?.trim()),
    [equipment],
  );

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
  const boxesById = useMemo(() => new Map(boxes.map((b) => [b.id, b])), [boxes]);
  const placementsByItem = useMemo(() => byEquipment(placements), [placements]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return equipment.filter((item) => {
      // Searching covers where the thing actually is — the room it is
      // placed in and the box it is in. That is the whole of it now: there
      // is no room column on the item to search separately, and the
      // placement description is the only thing that knows about boxes.
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        (item.category ?? "").toLowerCase().includes(term) ||
        describePlacements(item, placementsByItem.get(item.id) ?? [], boxesById, roomsById)
          .toLowerCase()
          .includes(term);
      const matchesCondition = conditionFilter === "All" || item.condition === conditionFilter;
      return matchesSearch && matchesCondition;
    });
  }, [equipment, search, conditionFilter, placementsByItem, boxesById, roomsById]);

  // Inside an open room/category, narrow further to just that group's items.
  const visibleItems = useMemo(() => {
    if (view === "all" || openGroup === null) return filtered;
    if (view === "category") {
      return filtered.filter((item) => categoryKeyFor(item) === openGroup.key);
    }
    // A room holds what the placements say it holds, and one item can be in
    // two rooms at once — so membership cannot come off the item.
    const inRoom = new Set(
      placements
        .filter((p) => roomOf(p, boxesById) === openGroup.key)
        .map((p) => p.equipment_id),
    );
    return filtered.filter((item) => inRoom.has(item.id));
  }, [filtered, view, openGroup, placements, boxesById]);

  const equipmentById = useMemo(
    () => new Map(equipment.map((e) => [e.id, e])),
    [equipment],
  );

  /**
   * The storage places standing directly in each room.
   *
   * Only the top level. A shelf inside a cupboard belongs on the cupboard's
   * page, not loose in the room beside it — listing both would mean opening
   * the room and seeing the same shelf twice.
   */
  const boxesByRoom = useMemo(() => {
    const map = new Map<string, typeof boxes>();
    for (const box of boxes) {
      if (box.parent_id !== null) continue;
      const key = box.room_id;
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
   * one room on the item could only ever put a row in one bucket, and the
   * whole point of placements is that one item is in several places.
   */
  const roomGroups = useMemo(() => {
    if (view !== "room") return undefined;

    const visible = new Set(filtered.map((item) => item.id));
    const used = roomsInUse(placements, boxes, roomsById);

    // While a search or a condition filter is on, a room with nothing in it
    // is not an answer. The list used to show every room reading "0 items ·
    // 0 total", so a search that found nothing looked the same as one that
    // found something in a room further down.
    const filtering = search.trim() !== "" || conditionFilter !== "All";

    return used.map(({ id, name }) => {
      const inRoom = placements.filter(
        (p) => roomOf(p, boxesById) === id && visible.has(p.equipment_id),
      );
      const items = [...new Set(inRoom.map((p) => p.equipment_id))]
        .map((id) => equipmentById.get(id))
        .filter((item): item is (typeof equipment)[number] => !!item);
      return {
        key: id,
        name,
        items,
        totalQuantity: inRoom.reduce((sum, p) => sum + p.quantity, 0),
        needsAttention: items.filter((item) => item.condition !== "Good").length,
      };
    }).filter((group) => !filtering || group.items.length > 0);
  }, [view, filtered, placements, boxes, boxesById, roomsById, equipmentById, search, conditionFilter]);

  const openRoomBoxes = useMemo(
    () => (view === "room" && openGroup ? (boxesByRoom.get(openGroup.key) ?? []) : []),
    [view, openGroup, boxesByRoom],
  );

  /**
   * What each room-level place holds, counting everything nested inside it.
   *
   * A cupboard whose kit is all on its shelves holds nothing of its own, and
   * a card reading "0 items" on a full cupboard is a card nobody opens.
   */
  const itemCountByBox = useMemo(() => {
    const counts = new Map<string, number>();
    for (const box of openRoomBoxes) {
      counts.set(box.id, countWithin(box.id, boxes, placements));
    }
    return counts;
  }, [openRoomBoxes, boxes, placements]);

  /**
   * Inside a room, kit that is in one of its boxes is shown in that box
   * rather than again below it — that is what makes a box a subdivision of
   * the room rather than a copy of it.
   */
  const looseItems = useMemo(() => {
    if (view !== "room" || !openGroup) return visibleItems;
    const visible = new Set(filtered.map((item) => item.id));
    return looseInRoom(openGroup.key, placements, equipmentById)
      .map(({ item }) => item)
      .filter((item) => visible.has(item.id));
  }, [view, openGroup, placements, equipmentById, visibleItems, filtered]);

  /**
   * Kit this room lists as loose while it also sits in a box in this room.
   *
   * Stowing used to add without taking, so a store packed before that was
   * fixed still reads as though nothing was ever put away. Rather than
   * guessing on the user's behalf, the room says so and offers to move them.
   */
  const strays = useMemo(
    () =>
      view === "room" && openGroup
        ? strayLooseItems(openGroup.key, placements, boxes, equipmentById)
        : [],
    [view, openGroup, placements, boxes, equipmentById],
  );

  /** One line per item saying where its units actually are. */
  const placementSummary = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of equipment) {
      map.set(
        item.id,
        describePlacements(item, placementsByItem.get(item.id) ?? [], boxesById, roomsById),
      );
    }
    return map;
  }, [equipment, placementsByItem, boxesById, roomsById]);

  /** The same, split by place, for the phone cards to stack. */
  const placementDetail = useMemo(() => {
    const map = new Map<string, ReturnType<typeof placementParts>>();
    for (const item of equipment) {
      map.set(
        item.id,
        placementParts(item, placementsByItem.get(item.id) ?? [], boxesById, roomsById),
      );
    }
    return map;
  }, [equipment, placementsByItem, boxesById, roomsById]);

  function changeView(next: View) {
    setView(next);
    setOpenGroup(null);
  }

  function openAddDialog() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: Equipment) {
    setViewing(null);
    setEditingItem(item);
    setDialogOpen(true);
  }

  function openLendDialog(item: Equipment) {
    setViewing(null);
    setLendItemId(item.id);
    setLendOpen(true);
  }

  /** Stamping a check from the view leaves the view open behind it. */
  function openCheckDialog(item: Equipment) {
    setViewing(null);
    setChecking(item);
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
   * A scanned sticker always lands somewhere useful. An unknown one creates
   * the place: the person is holding a real sticker on a real box or shelf,
   * and telling them "not found" would mean walking away to add it and
   * coming back.
   */
  async function openScanned(code: string) {
    setScanning(false);
    const existing = boxes.find((b) => b.code.toUpperCase() === code.toUpperCase());
    if (existing) {
      navigate(`/boxes/${encodeURIComponent(existing.code)}`);
      return;
    }
    if (!canEdit) {
      toast.error(
        "That sticker isn't on anything yet, and adding a place is for Members and above.",
      );
      return;
    }
    const { data, error: createError } = await supabase
      .from("storage_places")
      .insert({
        code,
        created_by: profile?.id ?? null,
        ...(view === "room" && openGroup ? { room_id: openGroup.key } : {}),
      })
      .select()
      .single();
    if (createError || !data) {
      toast.error(createError?.message ?? "Couldn't create that place.");
      return;
    }
    toast.success(`${data.code} created — name it and put things in it`);
    navigate(`/boxes/${encodeURIComponent(data.code)}`);
  }

  async function addBoxHere() {
    const { data, error: createError } = await supabase
      .from("storage_places")
      .insert({
        code: generateBoxCode(),
        created_by: profile?.id ?? null,
        ...(view === "room" && openGroup ? { room_id: openGroup.key } : {}),
      })
      .select()
      .single();
    if (createError || !data) {
      toast.error(createError?.message ?? "Couldn't create that place.");
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
                {view === "room" ? "All rooms" : "All categories"}
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
            title={blocked ?? "Scan a sticker"}
          >
            <QrCode className="size-4" />
            Scan a sticker
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
          {anyBanded && (
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => setColoursOpen(true)}
              title="What the coloured bands mean"
            >
              <Palette className="size-4" />
              Bands
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
          boxCounts={view === "room" ? boxCounts : undefined}
          groups={roomGroups}
        />
      ) : (
        <>
          {view === "room" && openGroup && (
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {openRoomBoxes.length === 0
                    ? "Nothing to open in here yet"
                    : `${openRoomBoxes.length} ${
                        openRoomBoxes.length === 1 ? "place" : "places"
                      } in here`}
                </h2>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={addBoxHere}
                    disabled={blocked !== null}
                    title={blocked ?? "Add a box, shelf or cupboard to this room"}
                  >
                    <Plus className="size-4" />
                    New place
                  </Button>
                )}
              </div>
              {openRoomBoxes.length > 0 && (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {openRoomBoxes.map((box) => {
                    const count = itemCountByBox.get(box.id) ?? 0;
                    const within = childrenOf(box.id, boxes).length;
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
                              {box.kind} · {count} {count === 1 ? "item" : "items"}
                              {within > 0 &&
                                ` · ${within} ${within === 1 ? "place" : "places"} inside`}
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

          {view === "room" && openGroup && looseItems.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Loose in this room
              </h2>
              {canEdit && strays.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={blocked !== null}
                  title={blocked ?? "Move them into the places they are already in"}
                  onClick={() => setPuttingAway(true)}
                >
                  <PackageCheck className="size-4" />
                  {strays.length} also in a box here
                </Button>
              )}
            </div>
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
            onCheck={setChecking}
            checkingId={checking?.id ?? null}
            writesBlocked={blocked}
            placementSummary={placementSummary}
            placementDetail={placementDetail}
            onView={setViewing}
          />
        </>
      )}

      <ColourIndexDialog
        open={coloursOpen}
        onOpenChange={setColoursOpen}
        equipment={equipment}
      />

      {/* Mounted only while something is being viewed: it opens a realtime
          channel for faults, which this page has no other use for. */}
      {viewing && (
        <EquipmentDetailDialog
          item={viewing}
          onOpenChange={(open) => !open && setViewing(null)}
          loans={loans}
          places={boxes}
          placements={placements}
          usersById={usersById}
          canEdit={canEdit}
          onEdit={openEditDialog}
          onCheck={openCheckDialog}
          onLend={openLendDialog}
          writesBlocked={blocked}
        />
      )}

      <CheckDialog item={checking} onOpenChange={(open) => !open && setChecking(null)} />

      <QrScannerDialog open={scanning} onOpenChange={setScanning} onFound={openScanned} />

      {openGroup && (
        <PutAwayDialog
          open={puttingAway}
          onOpenChange={setPuttingAway}
          roomName={openGroup.name}
          strays={strays}
        />
      )}

      <EquipmentCleanupDialog
        open={cleanupOpen}
        onOpenChange={setCleanupOpen}
        equipment={equipment}
      />

      <EquipmentFormDialog
        defaultRoomId={view === "room" ? (openGroup?.key ?? undefined) : undefined}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        equipment={editingItem}
        categories={categories}
        rooms={rooms}
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
