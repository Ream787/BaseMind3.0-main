import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Backpack, Plus, Printer, RotateCcw, Trash2, Weight } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { labDb } from "@/lib/lab/client";
import { useLabTable } from "@/lib/lab/useLabTable";
import type { KitList } from "@/types/lab";
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
import { EmptyState } from "@/components/lab/LabUi";
import { TOOLKIT_TABS } from "@/components/layout/SectionTabs";

/**
 * Printable personal kit lists, with a packing mode.
 *
 * The ticks are kept in this browser's local storage rather than in the
 * database, and that is the right place for them: a kit list is used by
 * one person packing one bag, and syncing "Ruby has packed her socks" to
 * every leader's phone would be both useless and slightly sinister. It
 * also means packing works with no signal at all, which is when a bedroom
 * floor covered in kit usually happens.
 */

const KINDS = ["Camp", "Hike", "Meeting", "Other"];

const packedKey = (listId: string) => `lab:packed:${listId}`;

function loadPacked(listId: string): Set<string> {
  try {
    const raw = localStorage.getItem(packedKey(listId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    // Private windows and blocked site data both throw here. An empty set
    // is a working kit list; a thrown error is a blank page.
    return new Set();
  }
}

function savePacked(listId: string, packed: Set<string>) {
  try {
    localStorage.setItem(packedKey(listId), JSON.stringify([...packed]));
  } catch {
    // Nothing to do — the list still works, it just will not be remembered.
  }
}

export function KitListsPage() {
  const { hasRole } = useAuth();
  const { rows: lists, loading } = useLabTable("kit_lists", { orderBy: "name" });
  const { rows: allItems } = useLabTable("kit_list_items", { orderBy: "sort_order" });

  const [activeId, setActiveId] = useState("");
  const [packed, setPacked] = useState<Set<string>>(new Set());
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState("");

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);

  const active = lists.find((l) => l.id === activeId) ?? lists[0] ?? null;

  useEffect(() => {
    if (active) setPacked(loadPacked(active.id));
  }, [active]);

  const items = useMemo(
    () => (active ? allItems.filter((i) => i.kit_list_id === active.id) : []),
    [allItems, active],
  );

  const totalGrams = items.reduce(
    (sum, item) => sum + (item.weight_grams ?? 0) * item.quantity,
    0,
  );
  const packedGrams = items
    .filter((item) => packed.has(item.id))
    .reduce((sum, item) => sum + (item.weight_grams ?? 0) * item.quantity, 0);
  const essentialsLeft = items.filter((i) => i.essential && !packed.has(i.id)).length;

  function togglePacked(itemId: string) {
    if (!active) return;
    const next = new Set(packed);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setPacked(next);
    savePacked(active.id, next);
  }

  async function addItem(e: FormEvent) {
    e.preventDefault();
    if (!active || !newItem.trim()) return;

    const { error } = await labDb.from("kit_list_items").insert({
      kit_list_id: active.id,
      item: newItem.trim(),
      quantity: 1,
      weight_grams: null,
      essential: true,
      note: null,
      sort_order: items.length + 1,
    });

    if (error) {
      toast.error(error.message);
      return;
    }
    setNewItem("");
  }

  return (
    <LabPage
      title="Kit lists"
      description="What to bring, printable, and tickable while you pack."
      feature="kitlists"
      tabs={TOOLKIT_TABS}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => setListDialogOpen(true)}>
              <Plus className="size-4" />
              New list
            </Button>
          )}
        </>
      }
    >
      {loading && lists.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : lists.length === 0 ? (
        <EmptyState
          icon={<Backpack className="size-6" />}
          title="No kit lists yet"
          description="Write the weekend camp one once and it is the answer to the same question every term."
          action={
            canEdit ? (
              <Button size="sm" onClick={() => setListDialogOpen(true)}>
                <Plus className="size-4" />
                Make one
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Select value={active?.id ?? ""} onValueChange={setActiveId}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {packed.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!active) return;
                  setPacked(new Set());
                  savePacked(active.id, new Set());
                }}
              >
                <RotateCcw className="size-4" />
                Unpack
              </Button>
            )}

            {canDelete && active && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                aria-label={`Delete ${active.name}`}
                onClick={async () => {
                  const { error } = await labDb
                    .from("kit_lists")
                    .delete()
                    .eq("id", active.id);
                  if (error) toast.error(error.message);
                  else setActiveId("");
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>

          {active && (
            <>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2 className="text-lg font-medium">{active.name}</h2>
                {active.description && (
                  <p className="text-sm text-muted-foreground">{active.description}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>
                  <strong className="text-foreground tabular-nums">
                    {packed.size}/{items.length}
                  </strong>{" "}
                  packed
                </span>
                {essentialsLeft > 0 && (
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    {essentialsLeft} essential {essentialsLeft === 1 ? "item" : "items"} still out
                  </span>
                )}
                {totalGrams > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Weight className="size-3.5" />
                    {(packedGrams / 1000).toFixed(1)} of {(totalGrams / 1000).toFixed(1)} kg
                  </span>
                )}
              </div>

              {items.length === 0 ? (
                <EmptyState title="Nothing on this list yet" />
              ) : (
                <ul className="divide-y overflow-hidden rounded-lg border bg-card">
                  {items.map((item) => {
                    const isPacked = packed.has(item.id);
                    return (
                      <li key={item.id} className="flex items-start gap-3 p-3">
                        <Checkbox
                          className="mt-0.5"
                          checked={isPacked}
                          onCheckedChange={() => togglePacked(item.id)}
                          aria-label={`Packed ${item.item}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm ${
                              isPacked ? "text-muted-foreground line-through" : "font-medium"
                            }`}
                          >
                            {item.quantity > 1 && (
                              <span className="tabular-nums">{item.quantity} × </span>
                            )}
                            {item.item}
                            {!item.essential && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                optional
                              </span>
                            )}
                          </p>
                          {item.note && (
                            <p className="text-xs text-muted-foreground">{item.note}</p>
                          )}
                        </div>
                        {item.weight_grams != null && (
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {((item.weight_grams * item.quantity) / 1000).toFixed(2)} kg
                          </span>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-muted-foreground print:hidden"
                            aria-label={`Remove ${item.item}`}
                            onClick={async () => {
                              const { error } = await labDb
                                .from("kit_list_items")
                                .delete()
                                .eq("id", item.id);
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

              {canEdit && (
                <form onSubmit={addItem} className="flex max-w-md gap-2 print:hidden">
                  <Input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="Add an item"
                  />
                  <Button type="submit" variant="outline" disabled={!newItem.trim()}>
                    <Plus className="size-4" />
                    Add
                  </Button>
                </form>
              )}
            </>
          )}
        </>
      )}

      <NewListDialog open={listDialogOpen} onOpenChange={setListDialogOpen} lists={lists} />
    </LabPage>
  );
}

function NewListDialog({
  open,
  onOpenChange,
  lists,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: KitList[];
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState("Camp");
  const [copyFrom, setCopyFrom] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    const { data, error } = await labDb
      .from("kit_lists")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        kind,
      })
      .select("id")
      .single();

    if (error || !data) {
      setSaving(false);
      toast.error(error?.message ?? "Couldn't create the list");
      return;
    }

    // Most new lists are an old one with three things changed, so copying
    // is the fast path rather than a feature.
    if (copyFrom) {
      const { data: source } = await labDb
        .from("kit_list_items")
        .select("*")
        .eq("kit_list_id", copyFrom);

      if (source && source.length > 0) {
        await labDb.from("kit_list_items").insert(
          source.map((item) => ({
            kit_list_id: data.id,
            item: item.item,
            quantity: item.quantity,
            weight_grams: item.weight_grams,
            essential: item.essential,
            note: item.note,
            sort_order: item.sort_order,
          })),
        );
      }
    }

    setSaving(false);
    toast.success(`${name.trim()} created`);
    setName("");
    setDescription("");
    setCopyFrom("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New kit list</DialogTitle>
            <DialogDescription>
              Start from an existing list if there is one close — copying and cutting beats
              typing eighteen lines again.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label className="mb-1.5 block">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Summer camp"
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Kind</Label>
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
            {lists.length > 0 && (
              <div>
                <Label className="mb-1.5 block">Copy items from</Label>
                <Select
                  value={copyFrom || "none"}
                  onValueChange={(v) => setCopyFrom(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Start empty</SelectItem>
                    {lists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
