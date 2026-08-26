import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Search, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { labDb, formatMoney, parseMoney } from "@/lib/lab/client";
import { useLabTable } from "@/lib/lab/useLabTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { LabPage } from "@/components/lab/LabPage";
import { EmptyState, StatCard } from "@/components/lab/LabUi";
import { EQUIPMENT_TABS } from "@/components/layout/SectionTabs";

/**
 * What has happened to a piece of kit since it was bought.
 *
 * The inventory row says what a thing is and what condition it is in
 * today. This says how it got there — which is the difference between
 * "tent 4 needs repair" and "tent 4 has been repaired three times this
 * year and should be replaced".
 *
 * Nothing here writes to public.equipment. The condition on the inventory
 * stays whatever a leader set it to; a repair log entry is a record, not
 * a state change, and quietly flipping the item back to Good because
 * somebody logged a repair would make the inventory lie.
 */

const KINDS = ["Check", "Repair", "Retire", "Replace", "Clean"];

export function MaintenancePage() {
  const { hasRole, profile } = useAuth();
  const { rows: equipment } = useRealtimeTable("equipment", { orderBy: "name" });
  const { rows: logs, loading } = useLabTable("maintenance_logs", {
    orderBy: "logged_on",
    ascending: false,
  });

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [presetItem, setPresetItem] = useState("");

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);

  const equipmentById = useMemo(() => new Map(equipment.map((e) => [e.id, e])), [equipment]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) => {
      const item = equipmentById.get(log.equipment_id);
      return [item?.name, log.detail, log.kind]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [logs, search, equipmentById]);

  const spent = logs.reduce((sum, log) => sum + log.cost_cents, 0);
  const repairs = logs.filter((l) => l.kind === "Repair").length;

  /** Items with the most repairs — the ones worth replacing. */
  const worstOffenders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs) {
      if (log.kind !== "Repair") continue;
      counts.set(log.equipment_id, (counts.get(log.equipment_id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [logs]);

  return (
    <LabPage
      title="Repairs"
      description="The service history behind the condition column."
      feature="maintenance"
      tabs={EQUIPMENT_TABS}
      actions={
        canEdit && equipment.length > 0 ? (
          <Button
            size="sm"
            onClick={() => {
              setPresetItem("");
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Log work
          </Button>
        ) : undefined
      }
    >
      {equipment.length === 0 ? (
        <EmptyState
          icon={<Wrench className="size-6" />}
          title="No equipment yet"
          description="A repair log needs something to repair — add kit to the inventory first."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Entries" value={logs.length} />
            <StatCard label="Repairs" value={repairs} />
            <StatCard label="Spent on repairs" value={formatMoney(spent)} />
          </div>

          {worstOffenders.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <p className="font-medium">Repaired more than once</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {worstOffenders.map(([id, count]) => (
                  <li key={id}>
                    {equipmentById.get(id)?.name ?? "Something since deleted"} — {count} repairs
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find an item or a repair"
              className="pl-8"
            />
          </div>

          {loading && logs.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Wrench className="size-6" />}
              title={logs.length === 0 ? "Nothing logged yet" : "Nothing matches that"}
              description={
                logs.length === 0
                  ? "Log a check or a repair and it stays with the item for as long as the item exists."
                  : undefined
              }
            />
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {visible.map((log) => {
                const item = equipmentById.get(log.equipment_id);
                return (
                  <li key={log.id} className="flex items-start gap-3 p-3 text-sm">
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                        log.kind === "Repair"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          : log.kind === "Retire"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {log.kind}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item?.name ?? "Deleted item"}</p>
                      {log.detail && (
                        <p className="text-muted-foreground">{log.detail}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(log.logged_on), "d MMM yyyy")}
                        {log.cost_cents > 0 && ` · ${formatMoney(log.cost_cents)}`}
                      </p>
                    </div>
                    {canEdit && item && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-xs"
                        onClick={() => {
                          setPresetItem(item.id);
                          setDialogOpen(true);
                        }}
                      >
                        Add
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground"
                        aria-label="Delete entry"
                        onClick={async () => {
                          const { error } = await labDb
                            .from("maintenance_logs")
                            .delete()
                            .eq("id", log.id);
                          if (error) toast.error(error.message);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <LogDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        equipment={equipment}
        presetItem={presetItem}
        doneBy={profile?.id ?? null}
      />
    </LabPage>
  );
}

function LogDialog({
  open,
  onOpenChange,
  equipment,
  presetItem,
  doneBy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: { id: string; name: string }[];
  presetItem: string;
  doneBy: string | null;
}) {
  const [equipmentId, setEquipmentId] = useState("");
  const [kind, setKind] = useState("Check");
  const [detail, setDetail] = useState("");
  const [cost, setCost] = useState("");
  const [loggedOn, setLoggedOn] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEquipmentId(presetItem || equipment[0]?.id || "");
    setKind("Check");
    setDetail("");
    setCost("");
    setLoggedOn(new Date().toISOString().slice(0, 10));
  }, [open, presetItem, equipment]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!equipmentId) return;
    setSaving(true);

    const { error } = await labDb.from("maintenance_logs").insert({
      equipment_id: equipmentId,
      logged_on: loggedOn,
      kind,
      detail: detail.trim() || null,
      cost_cents: parseMoney(cost),
      done_by: doneBy,
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Logged");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Log work on an item</DialogTitle>
            <DialogDescription>
              This does not change the item&apos;s condition on the inventory — that stays
              whatever a leader set it to, so the two never contradict each other.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label className="mb-1.5 block">Item</Label>
              <Select value={equipmentId} onValueChange={setEquipmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick an item" />
                </SelectTrigger>
                <SelectContent>
                  {equipment.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">What was done</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">When</Label>
                <Input
                  type="date"
                  value={loggedOn}
                  onChange={(e) => setLoggedOn(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Detail</Label>
              <Textarea
                rows={3}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Tear in the flysheet patched with tent tape both sides."
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Cost</Label>
              <Input
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="8.50"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !equipmentId}>
              {saving ? "Saving…" : "Log it"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
