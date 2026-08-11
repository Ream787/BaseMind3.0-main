import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
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
import { LoanFormDialog } from "@/components/loans/LoanFormDialog";
import { groupKeyFor, type GroupBy } from "@/lib/groupEquipment";
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
  const { hasRole } = useAuth();
  const { equipment, loading, error } = useEquipment();

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

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);

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
    const { error: deleteError } = await supabase.from("equipment").delete().eq("id", deleteTarget.id);
    if (deleteError) {
      toast.error(deleteError.message);
    } else {
      toast.success(`${deleteTarget.name} deleted`);
    }
    setDeleteTarget(null);
  }

  const showingGroupGrid = view !== "all" && openGroup === null;

  return (
    <div className="flex flex-col gap-4">
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
        {canEdit && (
          <Button onClick={openAddDialog}>
            <Plus className="size-4" />
            Add equipment
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border p-0.5">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => changeView(option.value)}
              className={`rounded-sm px-3 py-1 text-sm font-medium transition-colors ${
                view === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
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
          <SelectTrigger className="w-48">
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
        <EquipmentGroupGrid items={filtered} groupBy={view} onSelect={setOpenGroup} />
      ) : (
        <EquipmentTable
          items={visibleItems}
          usersById={usersById}
          loans={loans}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={openEditDialog}
          onDelete={setDeleteTarget}
          onLend={openLendDialog}
        />
      )}

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
