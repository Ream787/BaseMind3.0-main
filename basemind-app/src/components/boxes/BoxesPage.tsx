import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Box, Plus, QrCode, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useEquipment } from "@/context/EquipmentContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { generateBoxCode, sortBoxes } from "@/lib/boxes";
import type { EquipmentBox } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionTabs, EQUIPMENT_TABS } from "@/components/layout/SectionTabs";
import { QrScannerDialog } from "@/components/boxes/QrScannerDialog";

/**
 * The boxes in every store, and the way in to a stock check.
 *
 * Scanning is the headline action rather than a menu item: the job this
 * exists for is done standing in front of a box with a phone, and anything
 * that takes more than one tap to start gets done from memory afterwards
 * instead, which is how a stock check becomes fiction.
 */
export function BoxesPage() {
  const navigate = useNavigate();
  const { profile, hasRole } = useAuth();
  const { equipment } = useEquipment();
  const { rows: boxes, loading } = useRealtimeTable("equipment_boxes", { orderBy: "name" });

  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState(false);
  const [creating, setCreating] = useState(false);

  const canEdit = hasRole(["Admin", "Manager", "Member"]);

  const countsByBox = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of equipment) {
      if (item.box_id) counts.set(item.box_id, (counts.get(item.box_id) ?? 0) + 1);
    }
    return counts;
  }, [equipment]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matched = term
      ? boxes.filter((b) =>
          [b.name, b.location, b.code, b.notes].some((v) =>
            (v ?? "").toLowerCase().includes(term),
          ),
        )
      : boxes;
    return sortBoxes(matched);
  }, [boxes, search]);

  /** Groups the list by store, the way you'd walk round looking for it. */
  const byLocation = useMemo(() => {
    const groups = new Map<string, EquipmentBox[]>();
    for (const box of filtered) {
      const bucket = groups.get(box.location);
      if (bucket) bucket.push(box);
      else groups.set(box.location, [box]);
    }
    return [...groups.entries()];
  }, [filtered]);

  /**
   * A scanned code always ends up somewhere useful.
   *
   * An unknown sticker creates its box rather than reporting an error: the
   * person is standing over a real box holding a real sticker, and telling
   * them "not found" would mean going away to add it and coming back.
   */
  async function openScanned(code: string) {
    setScanning(false);
    const existing = boxes.find((b) => b.code.toUpperCase() === code.toUpperCase());
    if (existing) {
      navigate(`/boxes/${encodeURIComponent(existing.code)}`);
      return;
    }
    if (!canEdit) {
      toast.error("That sticker isn't on a box yet, and adding one is for Members and above.");
      return;
    }
    await createBox(code);
  }

  async function createBox(code?: string) {
    setCreating(true);
    const boxCode = code ?? generateBoxCode();
    try {
      const { data, error } = await supabase
        .from("equipment_boxes")
        .insert({ code: boxCode, created_by: profile?.id ?? null })
        .select()
        .single();
      if (error) throw new Error(error.message);
      toast.success(`Box ${data.code} created — give it a name and put things in it`);
      navigate(`/boxes/${encodeURIComponent(data.code)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create that box.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionTabs tabs={EQUIPMENT_TABS} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Boxes</h1>
          <p className="text-sm text-muted-foreground">
            {boxes.length} {boxes.length === 1 ? "box" : "boxes"} across{" "}
            {new Set(boxes.map((b) => b.location)).size}{" "}
            {new Set(boxes.map((b) => b.location)).size === 1 ? "store" : "stores"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setScanning(true)}>
            <QrCode className="size-4" />
            Scan a box
          </Button>
          {canEdit && (
            <Button variant="outline" disabled={creating} onClick={() => createBox()}>
              <Plus className="size-4" />
              New box
            </Button>
          )}
        </div>
      </div>

      {boxes.length > 0 && (
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search boxes…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading boxes…</p>
      ) : filtered.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          <Box className="size-5" />
          {boxes.length === 0 ? (
            <>
              <p>No boxes yet.</p>
              <p className="max-w-md text-xs">
                Make one, print its sticker, and stick it on the box. After that, scanning it
                is the whole stock check.
              </p>
            </>
          ) : (
            <p>Nothing matches that search.</p>
          )}
        </div>
      ) : (
        byLocation.map(([location, group]) => (
          <section key={location} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{location}</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((box) => {
                const count = countsByBox.get(box.id) ?? 0;
                return (
                  <li key={box.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/boxes/${encodeURIComponent(box.code)}`)}
                      className="flex w-full flex-col items-start gap-1 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <span className="min-w-0 truncate font-medium">{box.name}</span>
                        <Badge variant="outline" className="shrink-0 font-mono text-xs">
                          {box.code}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {count} {count === 1 ? "item" : "items"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <QrScannerDialog open={scanning} onOpenChange={setScanning} onFound={openScanned} />
    </div>
  );
}
