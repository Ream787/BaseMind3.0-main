import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, Mail, Pencil, Phone, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { daysOverdue, isOutstanding, loanStatus, sortByUrgency, todayISO } from "@/lib/loans";
import type { EquipmentLoan } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
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
import { LoanFormDialog } from "@/components/loans/LoanFormDialog";

type Filter = "out" | "overdue" | "returned" | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "out", label: "Out now" },
  { value: "overdue", label: "Overdue" },
  { value: "returned", label: "Returned" },
  { value: "all", label: "All" },
];

export function LoansPage() {
  const { hasRole } = useAuth();
  const { rows: loans, loading, error } = useRealtimeTable("equipment_loans");
  const { rows: equipment } = useRealtimeTable("equipment", { orderBy: "name" });

  const [filter, setFilter] = useState<Filter>("out");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EquipmentLoan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EquipmentLoan | null>(null);

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);

  const today = todayISO();
  const equipmentById = useMemo(() => new Map(equipment.map((e) => [e.id, e])), [equipment]);

  const overdueCount = useMemo(
    () => loans.filter((l) => loanStatus(l, today) === "overdue").length,
    [loans, today],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = loans.filter((loan) => {
      const status = loanStatus(loan, today);
      if (filter === "out" && !isOutstanding(loan)) return false;
      if (filter === "overdue" && status !== "overdue") return false;
      if (filter === "returned" && isOutstanding(loan)) return false;
      if (!term) return true;
      const item = equipmentById.get(loan.equipment_id);
      return [loan.borrower_name, loan.scout_group, loan.position, item?.name].some((v) =>
        (v ?? "").toLowerCase().includes(term),
      );
    });
    return sortByUrgency(matches);
  }, [loans, filter, search, today, equipmentById]);

  async function markReturned(loan: EquipmentLoan) {
    const { error: updateError } = await supabase
      .from("equipment_loans")
      .update({ returned_on: todayISO() })
      .eq("id", loan.id);
    if (updateError) toast.error(updateError.message);
    else toast.success(`${equipmentById.get(loan.equipment_id)?.name ?? "Item"} marked returned`);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error: deleteError } = await supabase
      .from("equipment_loans")
      .delete()
      .eq("id", deleteTarget.id);
    if (deleteError) toast.error(deleteError.message);
    else toast.success("Loan record deleted");
    setDeleteTarget(null);
  }

  function statusBadge(loan: EquipmentLoan) {
    const status = loanStatus(loan, today);
    if (status === "returned") {
      return (
        <span className="text-muted-foreground">
          {loan.returned_on ? format(parseISO(loan.returned_on), "d MMM") : "Returned"}
        </span>
      );
    }
    if (status === "overdue") {
      const late = daysOverdue(loan, today);
      return (
        <Badge variant="outline" className="border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {late} {late === 1 ? "day" : "days"} overdue
        </Badge>
      );
    }
    if (status === "due-soon") {
      return (
        <Badge variant="outline" className="border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          Due {loan.due_back ? format(parseISO(loan.due_back), "d MMM") : "soon"}
        </Badge>
      );
    }
    return (
      <span className="text-muted-foreground">
        {loan.due_back ? `Due ${format(parseISO(loan.due_back), "d MMM")}` : "No date set"}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Borrowed equipment</h1>
          <p className="text-sm text-muted-foreground">
            {overdueCount > 0 ? (
              <span className="text-destructive">
                {overdueCount} {overdueCount === 1 ? "loan is" : "loans are"} overdue
              </span>
            ) : (
              "Nothing overdue"
            )}
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
            Lend equipment
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-sm px-3 py-1 text-sm font-medium transition-colors ${
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              {f.value === "overdue" && overdueCount > 0 && (
                <span className="ml-1.5 text-xs">({overdueCount})</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search borrower, group, item…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Loading loans…
        </div>
      ) : visible.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          {filter === "out"
            ? "Nothing is out on loan."
            : filter === "overdue"
              ? "Nothing is overdue."
              : "No loans to show."}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Borrower</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Borrowed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((loan) => {
                const item = equipmentById.get(loan.equipment_id);
                return (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <span className="font-medium">{item?.name ?? "Unknown item"}</span>
                      {loan.quantity > 1 && (
                        <span className="text-muted-foreground"> ×{loan.quantity}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>
                          {loan.borrower_name}
                          {loan.position && (
                            <span className="text-muted-foreground"> ({loan.position})</span>
                          )}
                        </span>
                        {loan.scout_group && (
                          <span className="text-xs text-muted-foreground">{loan.scout_group}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        {loan.phone && (
                          <a
                            href={`tel:${loan.phone}`}
                            className="flex items-center gap-1.5 text-primary hover:underline"
                          >
                            <Phone className="size-3 shrink-0" />
                            {loan.phone}
                          </a>
                        )}
                        {loan.email && (
                          <a
                            href={`mailto:${loan.email}`}
                            className="flex items-center gap-1.5 text-primary hover:underline"
                          >
                            <Mail className="size-3 shrink-0" />
                            <span className="max-w-40 truncate">{loan.email}</span>
                          </a>
                        )}
                        {!loan.phone && !loan.email && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(parseISO(loan.borrowed_on), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>{statusBadge(loan)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canEdit && isOutstanding(loan) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markReturned(loan)}
                          >
                            <Check className="size-4" />
                            Returned
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit loan"
                            onClick={() => {
                              setEditing(loan);
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
                            aria-label="Delete loan record"
                            onClick={() => setDeleteTarget(loan)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <LoanFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        equipment={equipment}
        loans={loans}
        editing={editing}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this loan record?</AlertDialogTitle>
            <AlertDialogDescription>
              This erases the record that it was ever borrowed. To log that an item came back,
              use &ldquo;Returned&rdquo; instead — that keeps the history.
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
