import { HandCoins, Pencil, Trash2 } from "lucide-react";

import type { Equipment, EquipmentCondition, EquipmentLoan } from "@/types/database";
import { availableQuantity, onLoanQuantity } from "@/lib/loans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
}: EquipmentTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No equipment found.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Available</TableHead>
            <TableHead>Location</TableHead>
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
              <TableCell className="font-medium">{item.name}</TableCell>
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
              <TableCell>{item.location}</TableCell>
              <TableCell>
                <Badge variant="outline" className={conditionStyles[item.condition]}>
                  {item.condition}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {item.checked_by ? usersById.get(item.checked_by) ?? "Unknown" : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">{item.next_check_date || "—"}</TableCell>
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
                        title={available === 0 ? "All of these are out on loan" : `Lend ${item.name}`}
                      >
                        <HandCoins className="size-4" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="ghost" size="icon" onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`}>
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
  );
}
