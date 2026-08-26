import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { Banknote, Check, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { labDb, formatMoney, parseMoney } from "@/lib/lab/client";
import { useLabTable } from "@/lib/lab/useLabTable";
import type { EventMoney, Expense } from "@/types/lab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { LabPage } from "@/components/lab/LabPage";
import { EmptyState, StatCard } from "@/components/lab/LabUi";
import { CAMP_TABS } from "@/components/layout/SectionTabs";

/**
 * What a camp costs, and who is owed for it.
 *
 * Every figure here is an integer number of pence. Nothing rounds until it
 * is printed, which is the difference between a budget that balances and a
 * budget that is three pence out with nobody able to find where.
 *
 * The per-head number comes from a database function rather than a
 * division done here, because "how many heads" is a question about the
 * attendance register — and doing that join in the browser means fetching
 * the whole register to divide by its length.
 */

const CATEGORIES = ["Site", "Food", "Transport", "Equipment", "Programme", "Other"];

export function MoneyPage() {
  const { hasRole, profile } = useAuth();
  const { rows: events } = useRealtimeTable("events", { orderBy: "start_date", ascending: false });
  const [eventId, setEventId] = useState("");

  useEffect(() => {
    if (eventId || events.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = [...events].reverse().find((e) => e.start_date >= today);
    setEventId(upcoming?.id ?? events[0].id);
  }, [events, eventId]);

  const { rows: expenses, loading } = useLabTable("expenses", {
    orderBy: "spent_on",
    ascending: false,
    filter: eventId ? { column: "event_id", value: eventId } : null,
    enabled: !!eventId,
  });
  const { rows: budgets } = useLabTable("budgets");

  const [summary, setSummary] = useState<EventMoney | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canManage = hasRole(["Admin", "Manager"]);

  const budget = budgets.find((b) => b.event_id === eventId) ?? null;

  const refresh = useCallback(async () => {
    if (!eventId) {
      setSummary(null);
      return;
    }
    const { data, error } = await labDb.rpc("event_money", { target_event_id: eventId });
    if (!error && data) setSummary((data as EventMoney[])[0] ?? null);
  }, [eventId]);

  useEffect(() => {
    void refresh();
  }, [refresh, expenses.length, budgets.length]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const expense of expenses) {
      const key = expense.category ?? "Other";
      map.set(key, (map.get(key) ?? 0) + expense.amount_cents);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const spent = summary?.spent_cents ?? 0;
  const income = (summary?.subs_collected_cents ?? 0) + (summary?.grant_cents ?? 0);
  const balance = income - spent;
  const biggest = Math.max(1, ...byCategory.map(([, total]) => total));

  return (
    <LabPage
      title="Money"
      description="What a camp costs, what has come in, and who is still out of pocket."
      feature="money"
      tabs={CAMP_TABS}
      actions={
        <>
          {canManage && eventId && (
            <Button variant="outline" size="sm" onClick={() => setBudgetOpen(true)}>
              <Wallet className="size-4" />
              Budget
            </Button>
          )}
          {canEdit && eventId && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setExpenseOpen(true);
              }}
            >
              <Plus className="size-4" />
              Expense
            </Button>
          )}
        </>
      }
    >
      {events.length === 0 ? (
        <EmptyState
          icon={<Banknote className="size-6" />}
          title="No camps yet"
          description="Budgets and expenses hang off the calendar — add a camp first."
        />
      ) : (
        <>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Pick a camp" />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} — {format(parseISO(e.start_date), "d MMM yyyy")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <StatCard label="Spent" value={formatMoney(spent)} icon={<Receipt className="size-4" />} />
            <StatCard
              label="Came in"
              value={formatMoney(income)}
              hint={
                summary
                  ? `${formatMoney(summary.subs_collected_cents)} subs · ${formatMoney(
                      summary.grant_cents,
                    )} grant`
                  : undefined
              }
            />
            <StatCard
              label="Balance"
              value={formatMoney(balance)}
              tone={balance < 0 ? "warn" : "good"}
              hint={balance < 0 ? "Short — the group covers the difference" : "In the black"}
            />
            <StatCard
              label="Per head"
              value={
                summary?.cost_per_head_cents != null
                  ? formatMoney(Math.round(Number(summary.cost_per_head_cents)))
                  : "—"
              }
              hint={
                summary?.attending
                  ? `${summary.attending} coming${
                      summary.charge_per_head_cents
                        ? ` · charging ${formatMoney(summary.charge_per_head_cents)}`
                        : ""
                    }`
                  : "Nobody marked as coming yet"
              }
            />
          </div>

          {summary && summary.unreimbursed_cents > 0 && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <strong>{formatMoney(summary.unreimbursed_cents)}</strong> has been paid out of
              somebody&apos;s own pocket and not paid back yet.
            </p>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <section className="space-y-2">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Expenses
              </h2>

              {loading && expenses.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
              ) : expenses.length === 0 ? (
                <EmptyState
                  icon={<Receipt className="size-6" />}
                  title="Nothing spent yet"
                  description="Add the site fee, the food shop and the fuel as they happen and the per-head figure keeps itself up to date."
                />
              ) : (
                <ul className="divide-y overflow-hidden rounded-lg border bg-card">
                  {expenses.map((expense) => (
                    <li key={expense.id} className="flex items-center gap-3 p-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{expense.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(expense.spent_on), "d MMM yyyy")}
                          {expense.category && ` · ${expense.category}`}
                        </p>
                      </div>
                      {!expense.reimbursed && (
                        <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                          Owed
                        </span>
                      )}
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatMoney(expense.amount_cents)}
                      </span>
                      {canEdit && (
                        <div className="flex shrink-0 items-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={
                              expense.reimbursed ? "Mark as not paid back" : "Mark as paid back"
                            }
                            onClick={async () => {
                              const { error } = await labDb
                                .from("expenses")
                                .update({ reimbursed: !expense.reimbursed })
                                .eq("id", expense.id);
                              if (error) toast.error(error.message);
                            }}
                          >
                            <Check
                              className={`size-3.5 ${
                                expense.reimbursed ? "text-emerald-600" : "text-muted-foreground"
                              }`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              setEditing(expense);
                              setExpenseOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground"
                              aria-label={`Delete ${expense.description}`}
                              onClick={async () => {
                                const { error } = await labDb
                                  .from("expenses")
                                  .delete()
                                  .eq("id", expense.id);
                                if (error) toast.error(error.message);
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {byCategory.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Where it went
                </h2>
                <ul className="space-y-2 rounded-lg border bg-card p-3">
                  {byCategory.map(([category, total]) => (
                    <li key={category}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate">{category}</span>
                        <span className="shrink-0 tabular-nums">{formatMoney(total)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(2, (total / biggest) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </>
      )}

      <ExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        expense={editing}
        eventId={eventId}
        payerId={profile?.id ?? null}
        onSaved={refresh}
      />
      <BudgetDialog
        open={budgetOpen}
        onOpenChange={setBudgetOpen}
        eventId={eventId}
        budgetId={budget?.id ?? null}
        initial={budget}
        onSaved={refresh}
      />
    </LabPage>
  );
}

function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  eventId,
  payerId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  eventId: string;
  payerId: string | null;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Other");
  const [spentOn, setSpentOn] = useState("");
  const [reimbursed, setReimbursed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDescription(expense?.description ?? "");
    setAmount(expense ? (expense.amount_cents / 100).toFixed(2) : "");
    setCategory(expense?.category ?? "Other");
    setSpentOn(expense?.spent_on ?? new Date().toISOString().slice(0, 10));
    setReimbursed(expense?.reimbursed ?? false);
  }, [open, expense]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    const cents = parseMoney(amount);
    if (cents === 0) {
      toast.error("An amount is needed");
      return;
    }
    setSaving(true);

    const payload = {
      description: description.trim(),
      amount_cents: cents,
      category,
      spent_on: spentOn,
      reimbursed,
    };

    const { error } = expense
      ? await labDb.from("expenses").update(payload).eq("id", expense.id)
      : await labDb.from("expenses").insert({
          ...payload,
          event_id: eventId || null,
          paid_by: payerId,
          receipt_path: null,
          notes: null,
        });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(expense ? "Expense updated" : "Expense added");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{expense ? "Edit expense" : "New expense"}</DialogTitle>
            <DialogDescription>
              Leave &ldquo;paid back&rdquo; unticked if somebody is still out of pocket — that is
              what the owed total is counting.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label className="mb-1.5 block">What for</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Food shop"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Amount</Label>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="21.45"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">When</Label>
                <Input
                  type="date"
                  value={spentOn}
                  onChange={(e) => setSpentOn(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={reimbursed}
                onCheckedChange={(v) => setReimbursed(v === true)}
              />
              Already paid back (or paid straight from group funds)
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : expense ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BudgetDialog({
  open,
  onOpenChange,
  eventId,
  budgetId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  budgetId: string | null;
  initial: { charge_per_head_cents: number; subs_collected_cents: number; grant_cents: number } | null;
  onSaved: () => void;
}) {
  const [charge, setCharge] = useState("");
  const [subs, setSubs] = useState("");
  const [grant, setGrant] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCharge(initial ? (initial.charge_per_head_cents / 100).toFixed(2) : "");
    setSubs(initial ? (initial.subs_collected_cents / 100).toFixed(2) : "");
    setGrant(initial ? (initial.grant_cents / 100).toFixed(2) : "");
  }, [open, initial]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!eventId) return;
    setSaving(true);

    const payload = {
      charge_per_head_cents: parseMoney(charge),
      subs_collected_cents: parseMoney(subs),
      grant_cents: parseMoney(grant),
    };

    const { error } = budgetId
      ? await labDb.from("budgets").update(payload).eq("id", budgetId)
      : await labDb.from("budgets").insert({ ...payload, event_id: eventId, notes: null });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Budget saved");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Camp budget</DialogTitle>
            <DialogDescription>
              What you are charging, what has actually been collected, and any grant. The spend
              side comes from the expenses themselves.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label className="mb-1.5 block">Charge per head</Label>
              <Input
                inputMode="decimal"
                value={charge}
                onChange={(e) => setCharge(e.target.value)}
                placeholder="35.00"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Subs collected so far</Label>
              <Input
                inputMode="decimal"
                value={subs}
                onChange={(e) => setSubs(e.target.value)}
                placeholder="420.00"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Grant or other income</Label>
              <Input
                inputMode="decimal"
                value={grant}
                onChange={(e) => setGrant(e.target.value)}
                placeholder="50.00"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
