import { useMemo } from "react";
import { Link } from "react-router";
import { format, parseISO } from "date-fns";
import {
  ClipboardCheck,
  HandCoins,
  Package,
  Pencil,
  TriangleAlert,
} from "lucide-react";

import type { Equipment, EquipmentLoan, StoragePlace } from "@/types/database";
import type { EquipmentPlacement } from "@/types/database";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { availableQuantity, isOutstanding, onLoanQuantity } from "@/lib/loans";
import { pathOf, unplacedQuantity, UNPLACED_LABEL } from "@/lib/placements";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColourSwatch } from "@/components/equipment/ColourSwatch";
import { cn } from "@/components/ui/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const conditionStyles: Record<string, string> = {
  Good: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  "Needs Repair":
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  Broken:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
  Missing:
    "bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
};

const day = (iso: string) => format(parseISO(iso), "d MMM yyyy");

/**
 * Everything known about one item, on one screen.
 *
 * The list can only ever show a handful of columns, and the phone card fewer
 * still, so the answers to "who has it", "what's wrong with it" and "which
 * shelf exactly" were only reachable by editing the row — which meant
 * opening a form full of inputs to read two facts, with the standing risk of
 * changing one by accident. This is the read.
 *
 * Faults are subscribed here rather than passed in, so the equipment page
 * doesn't hold a realtime channel open for a table it never displays. The
 * dialog is mounted only while it is open, so is the subscription.
 */
export function EquipmentDetailDialog({
  item,
  onOpenChange,
  loans,
  places,
  placements,
  usersById,
  canEdit,
  onEdit,
  onCheck,
  onLend,
  writesBlocked,
}: {
  /** The item being viewed. The dialog is open exactly when this is set. */
  item: Equipment | null;
  onOpenChange: (open: boolean) => void;
  loans: EquipmentLoan[];
  places: StoragePlace[];
  placements: EquipmentPlacement[];
  usersById: Map<string, string>;
  canEdit: boolean;
  onEdit: (item: Equipment) => void;
  onCheck: (item: Equipment) => void;
  onLend: (item: Equipment) => void;
  writesBlocked?: string | null;
}) {
  const { rows: faults } = useRealtimeTable("equipment_faults");

  const placesById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  /**
   * Where its units are. The full trail, not the shortened one the list
   * uses: there is room for it here, and this is the screen somebody reads
   * before walking to the store.
   */
  const where = useMemo(() => {
    if (!item) return [];
    const rows = placements
      .filter((p) => p.equipment_id === item.id)
      .map((p) => {
        if (p.storage_id) {
          const place = placesById.get(p.storage_id);
          return place
            ? {
                label: pathOf(place, placesById).join(" › "),
                quantity: p.quantity,
                code: place.code,
              }
            : null;
        }
        const room = (p.location ?? "").trim();
        return room ? { label: room, quantity: p.quantity, code: null } : null;
      })
      .filter((r): r is { label: string; quantity: number; code: string | null } => r !== null)
      .sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label));

    const spare = unplacedQuantity(item, placements.filter((p) => p.equipment_id === item.id));
    if (spare > 0 || rows.length === 0) {
      rows.push({ label: UNPLACED_LABEL, quantity: spare || item.quantity, code: null });
    }
    return rows;
  }, [item, placements, placesById]);

  const out = useMemo(() => (item ? onLoanQuantity(item.id, loans) : 0), [item, loans]);
  const openLoans = useMemo(
    () => (item ? loans.filter((l) => l.equipment_id === item.id && isOutstanding(l)) : []),
    [item, loans],
  );
  const openFaults = useMemo(
    () =>
      item
        ? faults.filter((f) => f.equipment_id === item.id && f.resolved_on === null)
        : [],
    [item, faults],
  );

  if (!item) return null;

  const available = availableQuantity(item, loans);
  const checkedBy = item.checked_by ? usersById.get(item.checked_by) ?? "Unknown" : null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ColourSwatch label={item.label_colour} />
            <span className="min-w-0 break-words">{item.name}</span>
          </DialogTitle>
          <DialogDescription>
            {item.category ? item.category : "No category"}
            {item.label_colour ? ` · ${item.label_colour} band` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn(conditionStyles[item.condition])}>
              {item.condition}
            </Badge>
            <span className="text-muted-foreground">
              {item.quantity} owned
              {out > 0 && ` · ${available} free · ${out} out`}
            </span>
          </div>

          <section className="flex flex-col gap-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Where it is
            </h3>
            <ul className="flex flex-col gap-1">
              {where.map((row) => (
                <li
                  key={row.label}
                  className="flex items-baseline justify-between gap-3 rounded-md border px-3 py-2"
                >
                  {row.code ? (
                    // Straight to the box, which is the next thing you want
                    // once you know which box it is.
                    <Link
                      to={`/boxes/${row.code}`}
                      className="flex min-w-0 items-center gap-2 hover:underline"
                      onClick={() => onOpenChange(false)}
                    >
                      <Package className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 break-words">{row.label}</span>
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        "min-w-0 break-words",
                        row.label === UNPLACED_LABEL && "text-muted-foreground",
                      )}
                    >
                      {row.label}
                    </span>
                  )}
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    ×{row.quantity}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {openFaults.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reported faults
              </h3>
              <ul className="flex flex-col gap-1">
                {openFaults.map((fault) => (
                  <li
                    key={fault.id}
                    className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
                  >
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="break-words">{fault.description}</span>
                      <span className="block text-xs opacity-80">
                        {fault.quantity > 1 && `${fault.quantity} of them · `}
                        {fault.plan}
                        {fault.broke_on && ` · broke ${day(fault.broke_on)}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {openLoans.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Out on loan
              </h3>
              <ul className="flex flex-col gap-1">
                {openLoans.map((loan) => (
                  <li
                    key={loan.id}
                    className="flex items-baseline justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="break-words">{loan.borrower_name}</span>
                      {loan.scout_group && (
                        <span className="block text-xs text-muted-foreground">
                          {loan.scout_group}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                      ×{loan.quantity}
                      {loan.due_back && (
                        <span className="block">due {day(loan.due_back)}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {item.notes && (
            <section className="flex flex-col gap-1">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Notes
              </h3>
              <p className="whitespace-pre-wrap break-words">{item.notes}</p>
            </section>
          )}

          <section className="flex flex-col gap-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Checks
            </h3>
            <p className="text-muted-foreground">
              {item.date_last_checked
                ? `Last checked ${day(item.date_last_checked)}${checkedBy ? ` by ${checkedBy}` : ""}.`
                : "Never checked."}
              {item.next_check_date && ` Next check due ${day(item.next_check_date)}.`}
            </p>
          </section>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {canEdit && (
            <>
              <Button
                variant="outline"
                onClick={() => onLend(item)}
                disabled={available === 0}
                title={available === 0 ? "All of these are out on loan" : undefined}
              >
                <HandCoins className="size-4" />
                Lend
              </Button>
              <Button
                variant="outline"
                onClick={() => onCheck(item)}
                disabled={!!writesBlocked}
                title={writesBlocked ?? "Record that you checked this today"}
              >
                <ClipboardCheck className="size-4" />
                Check
              </Button>
              <Button onClick={() => onEdit(item)}>
                <Pencil className="size-4" />
                Edit
              </Button>
            </>
          )}
          {!canEdit && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
