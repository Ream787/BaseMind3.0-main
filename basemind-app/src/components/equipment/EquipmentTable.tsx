import type { ReactNode } from "react";
import { ClipboardCheck, HandCoins, Pencil, Trash2 } from "lucide-react";

import type { Equipment, EquipmentCondition, EquipmentLoan } from "@/types/database";
import { availableQuantity, onLoanQuantity } from "@/lib/loans";
import { Badge } from "@/components/ui/badge";
import { ColourSwatch } from "@/components/equipment/ColourSwatch";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

const conditionStyles: Record<EquipmentCondition, string> = {
  Good: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  "Needs Repair":
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  Broken: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
  Missing: "bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
};

interface EquipmentTableProps {
  items: Equipment[];
  usersById: Map<string, string>;
  loans: EquipmentLoan[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (equipment: Equipment) => void;
  onDelete: (equipment: Equipment) => void;
  onLend: (equipment: Equipment) => void;
  onCheck: (equipment: Equipment) => void;
  /**
   * Per item, a line saying where its units are — "Loft 4 · Container 2".
   * Replaces the single Location column, which could only ever name one
   * place and so could not describe kit split across two.
   */
  placementSummary?: Map<string, string>;
  /** Set when writes can't go through — offline, mainly. Explains why. */
  writesBlocked?: string | null;
  /** Id currently being stamped, so its button can show it is working. */
  checkingId: string | null;
}

/**
 * One row of the phone card's detail list.
 *
 * The value wraps rather than truncates: a location is what you're reading
 * this for, and "Store room shelf B, behind…" is no use for finding a tent.
 */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

export function EquipmentTable({
  items,
  usersById,
  loans,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onLend,
  onCheck,
  checkingId,
  placementSummary,
  writesBlocked,
}: EquipmentTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No equipment found.
      </div>
    );
  }

  return (
    <>
      {/* Phones get one card per item. Nine columns there meant side-scrolling
          past the name to reach how many are free and where they're kept —
          the two things you open this page to find out. */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {items.map((item) => {
          const out = onLoanQuantity(item.id, loans);
          const available = availableQuantity(item, loans);
          const checkedBy = item.checked_by
            ? usersById.get(item.checked_by) ?? "Unknown"
            : null;
          return (
            <li key={item.id} className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5 font-medium">
                    <ColourSwatch label={item.label_colour} />
                    {item.name}
                  </span>
                  {item.category && (
                    <span className="text-xs text-muted-foreground">{item.category}</span>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={cn("shrink-0", conditionStyles[item.condition])}
                >
                  {item.condition}
                </Badge>
              </div>

              <dl className="mt-3 flex flex-col gap-1 text-sm">
                <Detail label="Quantity">
                  {item.quantity}
                  {out > 0 && (
                    <span className={available === 0 ? "text-destructive" : "text-muted-foreground"}>
                      {" · "}
                      {available} free · {out} out
                    </span>
                  )}
                </Detail>
                <Detail label="Where">
                  {placementSummary?.get(item.id) ?? item.location}
                </Detail>
                {item.next_check_date && (
                  <Detail label="Next check">{item.next_check_date}</Detail>
                )}
                {checkedBy && <Detail label="Checked by">{checkedBy}</Detail>}
              </dl>

              {(canEdit || canDelete) && (
                <div className="mt-2 flex justify-end gap-1 border-t pt-2">
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onLend(item)}
                      disabled={available === 0}
                      title={available === 0 ? "All of these are out on loan" : undefined}
                    >
                      <HandCoins className="size-4" />
                      Lend
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={checkingId === item.id || !!writesBlocked}
                      onClick={() => onCheck(item)}
                      title={writesBlocked ?? "Record that you checked this today"}
                    >
                      <ClipboardCheck className="size-4" />
                      Check
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${item.name}`}
                      onClick={() => onDelete(item)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Where</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Checked by</TableHead>
              <TableHead>Next check</TableHead>
              {(canEdit || canDelete) && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const out = onLoanQuantity(item.id, loans);
              const available = availableQuantity(item, loans);
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      <ColourSwatch label={item.label_colour} />
                      {item.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.category || "—"}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>
                    {out === 0 ? (
                      <span className="text-muted-foreground">All in</span>
                    ) : (
                      <span className={available === 0 ? "text-destructive" : undefined}>
                        {available} free · {out} out
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-56">
                    <span className="block truncate" title={placementSummary?.get(item.id)}>
                      {placementSummary?.get(item.id) ?? item.location}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={conditionStyles[item.condition]}>
                      {item.condition}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.checked_by ? usersById.get(item.checked_by) ?? "Unknown" : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.next_check_date || "—"}
                  </TableCell>
                  {(canEdit || canDelete) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onLend(item)}
                            disabled={available === 0}
                            aria-label={`Lend ${item.name}`}
                            title={
                              available === 0 ? "All of these are out on loan" : `Lend ${item.name}`
                            }
                          >
                            <HandCoins className="size-4" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={checkingId === item.id || !!writesBlocked}
                            onClick={() => onCheck(item)}
                            aria-label={`Mark ${item.name} as checked today`}
                            title={writesBlocked ?? "Record that you checked this today"}
                          >
                            <ClipboardCheck className="size-4" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(item)}
                            aria-label={`Edit ${item.name}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(item)}
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
