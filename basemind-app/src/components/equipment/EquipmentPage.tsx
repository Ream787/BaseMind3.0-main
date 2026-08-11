import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
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

const CONDITION_FILTERS: (EquipmentCondition | "All")[] = [
  "All",
  "Good",
  "Needs Repair",
  "Broken",
  "Missing",
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);

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

  function openAddDialog() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: Equipment) {
    setEditingItem(item);
    setDialogOpen(true);
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Equipment</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {equipment.length} items</p>
        </div>
        {canEdit && (
          <Button onClick={openAddDialog}>
            <Plus className="size-4" />
            Add equipment
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, location, category…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={conditionFilter} onValueChange={(v) => setConditionFilter(v as EquipmentCondition | "All")}>
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
      ) : (
        <EquipmentTable
          items={filtered}
          usersById={usersById}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={openEditDialog}
          onDelete={setDeleteTarget}
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
