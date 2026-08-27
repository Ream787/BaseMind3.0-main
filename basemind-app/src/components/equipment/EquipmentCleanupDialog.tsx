import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Merge, Sparkles, Type } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import {
  describeFix,
  findExactProblems,
  verifyFindings,
  type Finding,
} from "@/lib/equipmentCleanup";
import type { Equipment } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * The tidy-up pass over the inventory.
 *
 * Findings are only ever SHOWN, never applied on their own. Merging two rows
 * is not reversible from in here — quantities are added together and one row
 * goes — so it stays a thing a person decides, one at a time, having read
 * what it will do. That is also why each fix says what it will do in plain
 * words rather than just offering a button.
 *
 * Reached only by Managers and Admins: merging rows and renaming rooms
 * restructures everyone's inventory, not just the item in front of you. The
 * page gates the button, so there is no read-only mode in here.
 *
 * The exact findings appear immediately, before the model is asked anything.
 * If the assistant is switched off, out of quota, or simply slow, the useful
 * half of this still works.
 */
export function EquipmentCleanupDialog({
  open,
  onOpenChange,
  equipment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment[];
}) {
  const [suggested, setSuggested] = useState<Finding[]>([]);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const exact = findExactProblems(equipment);

  useEffect(() => {
    if (!open) {
      setSuggested([]);
      setAskError(null);
      setConfirming(null);
      return;
    }

    let active = true;
    setAsking(true);
    setAskError(null);

    // Only the distinct room and category names go to the model, with counts.
    // The question is about a few dozen short strings; sending the whole
    // inventory would spend quota to tell it nothing.
    const tally = (field: "location" | "category") => {
      const counts = new Map<string, number>();
      for (const item of equipment) {
        const value = field === "location" ? item.location : item.category;
        if (value?.trim()) counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      return [...counts.entries()].map(([value, count]) => ({ value, count }));
    };

    supabase.functions
      .invoke("equipment-cleanup", {
        body: { locations: tally("location"), categories: tally("category") },
      })
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error) {
          const context = (error as { context?: Response }).context;
          const body = await context?.json().catch(() => null);
          throw new Error(body?.error ?? body?.detail ?? error.message);
        }
        // Checked against the real inventory before any of it is shown.
        setSuggested(verifyFindings(data?.findings ?? [], equipment, exact));
      })
      .catch((err: Error) => {
        if (active) setAskError(err.message);
      })
      .finally(() => {
        if (active) setAsking(false);
      });

    return () => {
      active = false;
    };
    // Re-running on every equipment change would re-ask on each apply, so
    // this deliberately keys on the dialog opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function applyRename(finding: Finding) {
    if (finding.kind === "duplicate") return;
    const isLocation = finding.kind === "location-variants";
    setApplying(keyOf(finding));
    try {
      // Spelled out per column rather than keyed dynamically: the update and
      // the filter have to name the same real column, and a computed key
      // hides a mismatch between them from the compiler.
      for (const variant of finding.variants) {
        const { error } = isLocation
          ? await supabase
              .from("equipment")
              .update({ location: finding.canonical })
              .eq("location", variant)
          : await supabase
              .from("equipment")
              .update({ category: finding.canonical })
              .eq("category", variant);
        if (error) throw new Error(error.message);
      }
      toast.success(`Renamed to "${finding.canonical}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't apply that.");
    } finally {
      setApplying(null);
      setConfirming(null);
    }
  }

  async function applyMerge(finding: Finding) {
    if (finding.kind !== "duplicate") return;
    setApplying(keyOf(finding));
    try {
      // Keep the row that has been there longest: it is the one camps and
      // loans are most likely to already point at.
      const rows = finding.itemIds
        .map((id) => equipment.find((e) => e.id === id))
        .filter((e): e is Equipment => !!e)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));

      if (rows.length < 2) throw new Error("Those rows have already been merged.");

      const [keeper, ...losers] = rows;
      for (const loser of losers) {
        const { error } = await supabase.rpc("merge_equipment", {
          keep_id: keeper.id,
          drop_id: loser.id,
        });
        if (error) throw new Error(error.message);
      }
      toast.success(`Merged ${rows.length} rows of ${keeper.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't merge those.");
    } finally {
      setApplying(null);
      setConfirming(null);
    }
  }

  const findings = [...exact, ...suggested];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tidy up the inventory</DialogTitle>
          <DialogDescription>
            Duplicates and repeated spellings. Nothing changes until you choose it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {findings.length === 0 && !asking && (
            <p className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <Check className="size-4 shrink-0" />
              Nothing to tidy — no duplicates, and every room and category is spelled one way.
            </p>
          )}

          {findings.map((finding) => {
            const key = keyOf(finding);
            const isDuplicate = finding.kind === "duplicate";
            const busy = applying === key;
            return (
              <div key={key} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <div className="flex items-start gap-2">
                  {isDuplicate ? (
                    <Merge className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Type className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {isDuplicate
                        ? `"${finding.name}" is listed ${finding.itemIds.length} times in ${finding.location}`
                        : `"${finding.canonical}" is spelled ${
                            finding.variants.length + 1
                          } different ways`}
                    </p>
                    <p className="text-sm text-muted-foreground">{describeFix(finding)}</p>
                    {!isDuplicate && (
                      <p className="text-xs text-muted-foreground">{finding.why}</p>
                    )}
                  </div>
                </div>

                {isDuplicate && confirming === key && (
                  <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      The quantities are added together and any loans or camp packing lists
                      move to the row that stays. The other row is deleted, and that
                      can&apos;t be undone.
                    </span>
                  </p>
                )}

                <div className="flex justify-end gap-2">
                    {confirming === key ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => setConfirming(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => (isDuplicate ? applyMerge(finding) : applyRename(finding))}
                        >
                          {busy && <Loader2 className="size-4 animate-spin" />}
                          {isDuplicate ? "Yes, merge them" : "Yes, rename"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => setConfirming(key)}
                      >
                        {isDuplicate ? "Merge" : "Rename"}
                      </Button>
                    )}
                </div>
              </div>
            );
          })}

          {asking && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 shrink-0" />
              Looking for spellings of the same thing…
            </p>
          )}

          {askError && (
            <p className="text-xs text-muted-foreground">
              Duplicates and capitalisation are listed above. The check for misspellings
              couldn&apos;t run: {askError}
            </p>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}

/** Stable identity for a finding, so one card's busy state isn't another's. */
function keyOf(finding: Finding): string {
  return finding.kind === "duplicate"
    ? `dup:${finding.itemIds.join(",")}`
    : `${finding.kind}:${finding.canonical}:${finding.variants.join(",")}`;
}
