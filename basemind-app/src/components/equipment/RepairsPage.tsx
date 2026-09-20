import { useMemo, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { Check, Plus, Wrench } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useOffline } from "@/context/OfflineContext";
import { useEquipment } from "@/context/EquipmentContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import type { EquipmentFault, FaultPlan } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SearchSelect } from "@/components/ui/search-select";
import { Textarea } from "@/components/ui/textarea";
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
import { SectionTabs, EQUIPMENT_TABS } from "@/components/layout/SectionTabs";

const PLANS: FaultPlan[] = ["Undecided", "Repair", "Retire"];

const planStyles: Record<FaultPlan, string> = {
  Undecided:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  Repair:
    "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900",
  Retire:
    "bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
};

/**
 * What's broken, when it went, and whether anything is going to be done.
 *
 * A condition of "Broken" says the state but not the story. An axe with a
 * split handle that somebody has decided to retire and one that is waiting
 * on a repair look identical in the inventory, and only one of them should
 * be in next year's budget.
 *
 * Plans start Undecided rather than defaulting to Repair, because assuming a
 * decision has been made is how a broken tent sits in the store for two years.
 */
export function RepairsPage() {
  const { profile, hasRole } = useAuth();
  const { online } = useOffline();
  const { equipment } = useEquipment();
  const { rows: faults, loading } = useRealtimeTable("equipment_faults", {
    orderBy: "reported_on",
    ascending: false,
  });

  const [reporting, setReporting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [form, setForm] = useState({
    equipment_id: "",
    description: "",
    broke_on: "",
    quantity: "1",
    plan: "Undecided" as FaultPlan,
  });
  const [saving, setSaving] = useState(false);

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const blocked = !online ? "You're offline — changes can't be saved yet" : null;

  const namesById = useMemo(
    () => new Map(equipment.map((e) => [e.id, e.name])),
    [equipment],
  );

  const open = useMemo(() => faults.filter((f) => !f.resolved_on), [faults]);

  /**
   * Kit whose condition says it is not serviceable, with no fault recorded.
   *
   * These are the ones that fell between the two records: somebody marked an
   * axe Broken on the inventory and nothing appeared here, so the axe was
   * both broken and, as far as this page was concerned, fine. Listing them
   * with a one-tap way to write the fault down closes that gap.
   */
  const unrecorded = useMemo(() => {
    const hasOpenFault = new Set(open.map((f) => f.equipment_id));
    return equipment.filter(
      // Nothing left of it is nothing to repair. A written-off item keeps its
      // row at zero for the history, and listing that as kit needing a fault
      // written down is how "Written off" used to send you straight back to
      // where you started.
      (item) => item.condition !== "Good" && item.quantity > 0 && !hasOpenFault.has(item.id),
    );
  }, [equipment, open]);
  const resolved = useMemo(() => faults.filter((f) => f.resolved_on), [faults]);

  /** Opens the report form with this item already chosen. */
  function reportFor(equipmentId: string, description = "") {
    setForm({ equipment_id: equipmentId, description, broke_on: "", quantity: "1", plan: "Undecided" });
    setReporting(true);
  }

  async function report(e: FormEvent) {
    e.preventDefault();
    if (!form.equipment_id || !form.description.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("equipment_faults").insert({
        equipment_id: form.equipment_id,
        description: form.description.trim(),
        broke_on: form.broke_on || null,
        quantity: Math.max(1, Number(form.quantity) || 1),
        plan: form.plan,
        reported_by: profile?.id ?? null,
      });
      if (error) throw new Error(error.message);
      toast.success("Fault recorded");
      setForm({ equipment_id: "", description: "", broke_on: "", quantity: "1", plan: "Undecided" });
      setReporting(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't record that.");
    } finally {
      setSaving(false);
    }
  }

  async function setPlan(fault: EquipmentFault, plan: FaultPlan) {
    const { error } = await supabase
      .from("equipment_faults")
      .update({ plan })
      .eq("id", fault.id);
    if (error) toast.error(error.message);
  }

  async function resolve(fault: EquipmentFault) {
    const item = equipment.find((e) => e.id === fault.equipment_id);
    const { error } = await supabase
      .from("equipment_faults")
      .update({
        resolved_on: format(new Date(), "yyyy-MM-dd"),
        resolution: fault.plan === "Retire" ? "Retired" : "Fixed",
      })
      .eq("id", fault.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (fault.plan !== "Retire") {
      toast.success("Marked fixed");
      return;
    }

    // Writing off takes the units out of the inventory. Say so — and when
    // that was the last of them, offer to remove the row rather than doing
    // it: the fault history goes with it.
    const left = Math.max((item?.quantity ?? 0) - fault.quantity, 0);
    toast.success(
      `Written off — ${fault.quantity} × ${item?.name ?? "it"} removed from the inventory`,
      left === 0 && item
        ? {
            description: "That was the last one. Its row stays at zero unless you delete it.",
            action: {
              label: "Delete it",
              onClick: async () => {
                const { error: deleteError } = await supabase
                  .from("equipment")
                  .delete()
                  .eq("id", item.id);
                if (deleteError) toast.error(deleteError.message);
                else toast.success(`${item.name} deleted`);
              },
            },
          }
        : { description: `${left} left in the inventory.` },
    );
  }

  function row(fault: EquipmentFault, done: boolean) {
    return (
      <li
        key={fault.id}
        className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
      >
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">
            {namesById.get(fault.equipment_id) ?? "An item that has since gone"}
            {fault.quantity > 1 && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                ×{fault.quantity}
              </span>
            )}
          </span>
          <span className="text-sm text-muted-foreground">{fault.description}</span>
          <span className="text-xs text-muted-foreground">
            {fault.broke_on
              ? `broke ${format(parseISO(fault.broke_on), "d MMM yyyy")}`
              : "date it broke not known"}
            {" · reported "}
            {format(parseISO(fault.reported_on), "d MMM yyyy")}
            {done && fault.resolved_on
              ? ` · ${fault.resolution ?? "closed"} ${format(parseISO(fault.resolved_on), "d MMM yyyy")}`
              : ""}
          </span>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {done ? (
            <Badge variant="outline">{fault.resolution ?? "Closed"}</Badge>
          ) : (
            <>
              {canEdit ? (
                <Select
                  value={fault.plan}
                  onValueChange={(v) => setPlan(fault, v as FaultPlan)}
                  disabled={blocked !== null}
                >
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className={planStyles[fault.plan]}>
                  {fault.plan}
                </Badge>
              )}
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={blocked !== null}
                  title={blocked ?? undefined}
                  onClick={() => resolve(fault)}
                >
                  <Check className="size-4" />
                  {fault.plan === "Retire" ? "Written off" : "Fixed"}
                </Button>
              )}
            </>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionTabs tabs={EQUIPMENT_TABS} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Repairs</h1>
          <p className="text-sm text-muted-foreground">
            {open.length === 0 && unrecorded.length === 0
              ? "Nothing broken is waiting on a decision."
              : `${open.length} open ${open.length === 1 ? "fault" : "faults"}` +
                (unrecorded.length > 0 ? ` · ${unrecorded.length} unrecorded` : "")}
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => setReporting(true)}
            disabled={blocked !== null}
            // Only a reason it can't be pressed. A tooltip that renames the
            // button — "Record something broken" over "Report a fault" — is
            // what a screen reader then announces instead of the label.
            title={blocked ?? undefined}
          >
            <Plus className="size-4" />
            Report a fault
          </Button>
        )}
      </div>

      {unrecorded.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {unrecorded.length} {unrecorded.length === 1 ? "item is" : "items are"} marked
            as not in good condition, with nothing written down about why
          </p>
          <ul className="flex flex-col gap-1">
            {unrecorded.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="text-amber-900 dark:text-amber-200">
                  {item.name} · {item.condition}
                </span>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={blocked !== null}
                    onClick={() => reportFor(item.id)}
                  >
                    Write it down
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : open.length === 0 && resolved.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
          <Wrench className="size-5" />
          <p>Nothing recorded as broken.</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">{open.map((f) => row(f, false))}</ul>

          {resolved.length > 0 && (
            <div className="flex flex-col gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setShowResolved((v) => !v)}
                className="self-start text-sm text-muted-foreground hover:text-foreground"
              >
                {showResolved ? "Hide" : "Show"} {resolved.length} closed
              </button>
              {showResolved && (
                <ul className="flex flex-col gap-2">{resolved.map((f) => row(f, true))}</ul>
              )}
            </div>
          )}
        </>
      )}

      <Dialog open={reporting} onOpenChange={(o) => !saving && setReporting(o)}>
        <DialogContent
          onInteractOutside={(e) => {
            if (form.description.trim() || form.equipment_id) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Report a fault</DialogTitle>
            <DialogDescription>
              What broke, roughly when, and whether it is worth fixing.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={report} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Item</Label>
              <SearchSelect
                value={form.equipment_id || null}
                onChange={(v) => setForm({ ...form, equipment_id: v })}
                placeholder="Pick an item"
                searchPlaceholder="Search the inventory…"
                emptyText="Nothing by that name"
                options={equipment.map((item) => ({
                  value: item.id,
                  label: item.name,
                  hint: item.condition === "Good" ? undefined : item.condition,
                }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="fault-what">What happened</Label>
              <Textarea
                id="fault-what"
                rows={3}
                required
                placeholder="Handle split near the head"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="fault-when">When it broke</Label>
                <Input
                  id="fault-when"
                  type="date"
                  value={form.broke_on}
                  onChange={(e) => setForm({ ...form, broke_on: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank if nobody knows.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="fault-qty">How many</Label>
                <Input
                  id="fault-qty"
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Plan</Label>
              <Select
                value={form.plan}
                onValueChange={(v) => setForm({ ...form, plan: v as FaultPlan })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLANS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReporting(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !form.equipment_id}>
                Record it
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
