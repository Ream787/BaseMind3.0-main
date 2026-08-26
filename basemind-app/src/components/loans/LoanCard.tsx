import { format, parseISO } from "date-fns";
import { Check, Mail, Pencil, Phone, Trash2 } from "lucide-react";

import { daysOverdue, isOutstanding, loanStatus } from "@/lib/loans";
import type { Equipment, EquipmentLoan } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * How overdue a loan is, or when it's due.
 *
 * Shared by the phone cards and the table so the two can't drift — `today` is
 * passed in rather than read here, so every row on a screen is judged against
 * the same clock.
 */
export function LoanStatusBadge({ loan, today }: { loan: EquipmentLoan; today: string }) {
  const status = loanStatus(loan, today);

  if (status === "overdue") {
    const late = daysOverdue(loan, today);
    return (
      <Badge
        variant="outline"
        className="border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
      >
        {late} {late === 1 ? "day" : "days"} overdue
      </Badge>
    );
  }

  if (status === "due-soon") {
    return (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
      >
        Due {loan.due_back ? format(parseISO(loan.due_back), "d MMM") : "soon"}
      </Badge>
    );
  }

  if (status === "returned") {
    return (
      <span className="text-muted-foreground">
        {loan.returned_on ? format(parseISO(loan.returned_on), "d MMM") : "Returned"}
      </span>
    );
  }

  return (
    <span className="text-muted-foreground">
      {loan.due_back ? `Due ${format(parseISO(loan.due_back), "d MMM")}` : "No date set"}
    </span>
  );
}

export interface LoanCardProps {
  loan: EquipmentLoan;
  item: Equipment | undefined;
  today: string;
  canEdit: boolean;
  canDelete: boolean;
  onReturn: (loan: EquipmentLoan) => void;
  onEdit: (loan: EquipmentLoan) => void;
  onDelete: (loan: EquipmentLoan) => void;
}

/**
 * One loan, for phones.
 *
 * Six columns pushed the phone number and the Returned button off the right
 * edge — the two things you reach for when you're chasing kit back in. Here
 * the number is a tap-to-call link, because on a phone it can be.
 */
export function LoanCard({
  loan,
  item,
  today,
  canEdit,
  canDelete,
  onReturn,
  onEdit,
  onDelete,
}: LoanCardProps) {
  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">
            {item?.name ?? "Unknown item"}
            {loan.quantity > 1 && (
              <span className="font-normal text-muted-foreground"> ×{loan.quantity}</span>
            )}
          </span>
          <span className="text-sm">
            {loan.borrower_name}
            {loan.position && <span className="text-muted-foreground"> ({loan.position})</span>}
          </span>
          {loan.scout_group && (
            <span className="text-xs text-muted-foreground">{loan.scout_group}</span>
          )}
        </div>
        <div className="shrink-0 text-right text-sm">
          <LoanStatusBadge loan={loan} today={today} />
        </div>
      </div>

      {(loan.phone || loan.email) && (
        <div className="mt-3 flex flex-col gap-1 text-sm">
          {loan.phone && (
            <a
              href={`tel:${loan.phone}`}
              className="flex items-center gap-1.5 text-primary hover:underline"
            >
              <Phone className="size-3.5 shrink-0" />
              {loan.phone}
            </a>
          )}
          {loan.email && (
            <a
              href={`mailto:${loan.email}`}
              className="flex min-w-0 items-center gap-1.5 text-primary hover:underline"
            >
              <Mail className="size-3.5 shrink-0" />
              <span className="truncate">{loan.email}</span>
            </a>
          )}
        </div>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        Borrowed {format(parseISO(loan.borrowed_on), "d MMM yyyy")}
      </p>

      {(canEdit || canDelete) && (
        <div className="mt-2 flex justify-end gap-1 border-t pt-2">
          {canEdit && isOutstanding(loan) && (
            <Button variant="outline" size="sm" onClick={() => onReturn(loan)}>
              <Check className="size-4" />
              Returned
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="sm" aria-label="Edit loan" onClick={() => onEdit(loan)}>
              <Pencil className="size-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Delete loan record"
              onClick={() => onDelete(loan)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
