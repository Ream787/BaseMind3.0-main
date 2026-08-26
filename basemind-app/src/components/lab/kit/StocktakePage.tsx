import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CheckCheck, ClipboardList, Minus, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { labDb } from "@/lib/lab/client";
import { useLabTable } from "@/lib/lab/useLabTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LabPage } from "@/components/lab/LabPage";
import { EmptyState, StatCard } from "@/components/lab/LabUi";
import { EQUIPMENT_TABS } from "@/components/layout/SectionTabs";

/**
 * Counting the store.
 *
 * A stocktake photographs the expected quantities when it starts (see
 * `lab.start_stocktake`) and then records what was actually found. The
 * gap between the two is the whole product; comparing a count against a
 * live inventory that somebody edited halfway through the afternoon
 * measures nothing.
 *
 * The counting UI is built for one hand and a cold shed: big plus and
 * minus buttons, a running "still to count" number, and no save button —
 * every tap is written immediately, because the connection in a scout hut
 * store cupboard is not something to bet an afternoon's work on.
 */

export function StocktakePage() {
  const { hasRole, profile } = useAuth();
  const { rows: equipment } = useRealtimeTable("equipment", { orderBy: "name" });
  const { rows: stocktakes } = useLabTable("stocktakes", {
    orderBy: "started_at",
    ascending: false,
  });

  const [activeId, setActiveId] = useState("");
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState(false);

  const current = stocktakes.find((s) => s.id === activeId) ?? stocktakes[0] ?? null;

  const { rows: entries, loading } = useLabTable("stocktake_entries", {
    filter: current ? { column: "stocktake_id", value: current.id } : null,
    enabled: !!current,
  });

  const canCount = hasRole(["Admin", "Manager", "Member"]);
  const canManage = hasRole(["Admin", "Manager"]);

  const equipmentById = useMemo(() => new Map(equipment.map((e) => [e.id, e])), [equipment]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries
      .map((entry) => ({ entry, item: equipmentById.get(entry.equipment_id) }))
      .filter(({ item }) => !term || (item?.name ?? "").toLowerCase().includes(term))
      .sort((a, b) => {
        // Uncounted first — the list is a queue of work, and finished
        // items sinking to the bottom is the progress bar.
        const aDone = a.entry.counted_quantity !== null;
        const bDone = b.entry.counted_quantity !== null;
        if (aDone !== bDone) return aDone ? 1 : -1;
        return (a.item?.name ?? "").localeCompare(b.item?.name ?? "");
      });
  }, [entries, equipmentById, search]);

  const counted = entries.filter((e) => e.counted_quantity !== null).length;
  const discrepancies = entries.filter(
    (e) => e.counted_quantity !== null && e.counted_quantity !== e.expected_quantity,
  );
  const missing = discrepancies.reduce(
    (sum, e) => sum + Math.max(0, e.expected_quantity - (e.counted_quantity ?? 0)),
    0,
  );

  async function start() {
    setStarting(true);
    const { data, error } = await labDb.rpc("start_stocktake", {
      stocktake_name: `Stocktake ${format(new Date(), "d MMM yyyy")}`,
    });
    setStarting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    if (typeof data === "string") setActiveId(data);
    toast.success(`Started — ${equipment.length} items to count`);
  }

  async function setCount(entryId: string, value: number | null) {
    const { error } = await labDb
      .from("stocktake_entries")
      .update({
        counted_quantity: value,
        counted_at: value === null ? null : new Date().toISOString(),
        counted_by: value === null ? null : profile?.id ?? null,
      })
      .eq("id", entryId);
    if (error) toast.error(error.message);
  }

  return (
    <LabPage
      title="Stocktake"
      description="Count the store against what the inventory says should be there."
      feature="maintenance"
      tabs={EQUIPMENT_TABS}
      actions={
        canCount && equipment.length > 0 ? (
          <Button size="sm" onClick={start} disabled={starting}>
            <Plus className="size-4" />
            {starting ? "Starting…" : "Start a count"}
          </Button>
        ) : undefined
      }
    >
      {equipment.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title="Nothing to count"
          description="Add equipment to the inventory and a stocktake can be taken against it."
        />
      ) : stocktakes.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title="No stocktakes yet"
          description="Starting one takes a snapshot of every quantity on the inventory, so the count has something fixed to be compared against."
          action={
            canCount ? (
              <Button size="sm" onClick={start} disabled={starting}>
                <Plus className="size-4" />
                Start the first count
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={current?.id ?? ""} onValueChange={setActiveId}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stocktakes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.finished_at ? " (finished)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {current && canManage && !current.finished_at && counted === entries.length && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const { error } = await labDb
                    .from("stocktakes")
                    .update({ finished_at: new Date().toISOString() })
                    .eq("id", current.id);
                  if (error) toast.error(error.message);
                  else toast.success("Stocktake closed");
                }}
              >
                <CheckCheck className="size-4" />
                Finish
              </Button>
            )}
            {current && canManage && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                aria-label="Delete this stocktake"
                onClick={async () => {
                  const { error } = await labDb
                    .from("stocktakes")
                    .delete()
                    .eq("id", current.id);
                  if (error) toast.error(error.message);
                  else setActiveId("");
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="Counted" value={`${counted}/${entries.length}`} />
            <StatCard
              label="Discrepancies"
              value={discrepancies.length}
              tone={discrepancies.length > 0 ? "warn" : "good"}
            />
            <StatCard label="Items missing" value={missing} tone={missing > 0 ? "warn" : "default"} />
            <StatCard
              label="Started"
              value={format(parseISO(current!.started_at), "d MMM")}
              hint={current?.finished_at ? "Finished" : "In progress"}
            />
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Jump to an item"
              className="pl-8"
            />
          </div>

          {loading && entries.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {rows.map(({ entry, item }) => {
                const count = entry.counted_quantity;
                const off = count !== null && count !== entry.expected_quantity;

                return (
                  <li key={entry.id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item?.name ?? "Item since deleted"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expected {entry.expected_quantity}
                        {item?.location && ` · ${item.location}`}
                        {off && (
                          <span className="ml-1 font-medium text-destructive">
                            {count! > entry.expected_quantity ? "+" : ""}
                            {count! - entry.expected_quantity}
                          </span>
                        )}
                      </p>
                    </div>

                    {canCount ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-9"
                          aria-label="One fewer"
                          onClick={() => setCount(entry.id, Math.max(0, (count ?? entry.expected_quantity) - 1))}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <Input
                          inputMode="numeric"
                          value={count ?? ""}
                          placeholder="—"
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            setCount(entry.id, raw === "" ? null : Math.max(0, Number(raw) || 0));
                          }}
                          className={`w-16 text-center tabular-nums ${
                            off ? "border-destructive" : count !== null ? "border-emerald-500" : ""
                          }`}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-9"
                          aria-label="One more"
                          onClick={() => setCount(entry.id, (count ?? entry.expected_quantity) + 1)}
                        >
                          <Plus className="size-4" />
                        </Button>
                        {count === null && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-2 text-xs"
                            onClick={() => setCount(entry.id, entry.expected_quantity)}
                          >
                            All there
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm tabular-nums">{count ?? "—"}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </LabPage>
  );
}
