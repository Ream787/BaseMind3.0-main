import type { Equipment, EquipmentLoan } from "@/types/database";

export type LoanStatus = "returned" | "overdue" | "due-soon" | "out";

/** Days before the due date that a loan starts being flagged as due soon. */
export const DUE_SOON_DAYS = 3;

/** Today as a plain yyyy-mm-dd string, matching how dates are stored. */
export function todayISO(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.parse(`${fromISO}T00:00:00Z`);
  const to = Date.parse(`${toISO}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/**
 * Dates are compared as yyyy-mm-dd strings rather than Date objects. They sort
 * correctly as text, and it sidesteps timezone drift shifting a due date by a
 * day depending on where the browser thinks it is.
 */
export function loanStatus(loan: EquipmentLoan, today = todayISO()): LoanStatus {
  if (loan.returned_on) return "returned";
  if (!loan.due_back) return "out";
  if (loan.due_back < today) return "overdue";
  if (daysBetween(today, loan.due_back) <= DUE_SOON_DAYS) return "due-soon";
  return "out";
}

/** Days overdue; 0 when not overdue. */
export function daysOverdue(loan: EquipmentLoan, today = todayISO()): number {
  if (loan.returned_on || !loan.due_back || loan.due_back >= today) return 0;
  return daysBetween(loan.due_back, today);
}

export function isOutstanding(loan: EquipmentLoan): boolean {
  return loan.returned_on === null;
}

/** How many units of an item are currently lent out. */
export function onLoanQuantity(equipmentId: string, loans: EquipmentLoan[]): number {
  return loans
    .filter((loan) => loan.equipment_id === equipmentId && isOutstanding(loan))
    .reduce((sum, loan) => sum + loan.quantity, 0);
}

/**
 * Units still on the shelf. Clamped at zero: if more has been lent out than
 * the recorded stock (a miscount, or stock reduced after lending), show 0
 * rather than a negative that looks like a bug.
 */
export function availableQuantity(equipment: Equipment, loans: EquipmentLoan[]): number {
  return Math.max(0, equipment.quantity - onLoanQuantity(equipment.id, loans));
}

/** Outstanding loans, most urgent first; undated loans sort last. */
export function sortByUrgency(loans: EquipmentLoan[]): EquipmentLoan[] {
  return [...loans].sort((a, b) => {
    if (!a.due_back && !b.due_back) return a.borrowed_on.localeCompare(b.borrowed_on);
    if (!a.due_back) return 1;
    if (!b.due_back) return -1;
    return a.due_back.localeCompare(b.due_back);
  });
}

