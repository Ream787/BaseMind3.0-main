import { useMemo, useState, type FormEvent } from "react";
import { Plus, ThumbsUp, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { labDb, formatMoney, parseMoney } from "@/lib/lab/client";
import { useLabTable } from "@/lib/lab/useLabTable";
import { WISHLIST_STATUSES } from "@/types/lab";
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
 * Kit people would like the group to buy.
 *
 * Anybody can add and anybody can vote; only leaders can move something to
 * Approved or Bought. The votes are not binding and are not meant to be —
 * they are there so that when the money does appear, the argument about
 * what to spend it on has already happened.
 */

const STATUS_STYLES: Record<string, string> = {
  Requested: "bg-muted text-muted-foreground",
  Approved: "bg-primary/15 text-primary",
  Bought: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Declined: "bg-destructive/15 text-destructive",
};

export function WishlistPage() {
  const { hasRole, profile } = useAuth();
  const { rows: items, loading } = useLabTable("wishlist", {
    orderBy: "created_at",
    ascending: false,
  });
  const { rows: votes } = useLabTable("wishlist_votes");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("open");

  const canAdd = hasRole(["Admin", "Manager", "Member"]);
  const canDecide = hasRole(["Admin", "Manager"]);

  const visible = useMemo(() => {
    const list =
      statusFilter === "all"
        ? items
        : statusFilter === "open"
          ? items.filter((i) => i.status === "Requested" || i.status === "Approved")
          : items.filter((i) => i.status === statusFilter);

    // Most-wanted first within the filter — the list is a ranking, not a
    // history.
    return [...list].sort((a, b) => {
      const aVotes = votes.filter((v) => v.wishlist_id === a.id).length;
      const bVotes = votes.filter((v) => v.wishlist_id === b.id).length;
      if (aVotes !== bVotes) return bVotes - aVotes;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [items, votes, statusFilter]);

  const wanted = items.filter((i) => i.status === "Requested" || i.status === "Approved");
  const totalWanted = wanted.reduce((sum, i) => sum + i.estimated_cents, 0);
  const approved = items.filter((i) => i.status === "Approved");

  async function toggleVote(itemId: string) {
    if (!profile) return;
    const mine = votes.find((v) => v.wishlist_id === itemId && v.user_id === profile.id);

    const { error } = mine
      ? await labDb.from("wishlist_votes").delete().eq("id", mine.id)
      : await labDb
          .from("wishlist_votes")
          .insert({ wishlist_id: itemId, user_id: profile.id });

    if (error) toast.error(error.message);
  }

  async function setStatus(itemId: string, status: string) {
    const { error } = await labDb
      .from("wishlist")
      .update({ status, decided_by: profile?.id ?? null })
      .eq("id", itemId);
    if (error) toast.error(error.message);
  }

  return (
    <LabPage
      title="Wishlist"
      description="What the group would buy if the money turned up tomorrow."
      feature="wishlist"
      tabs={EQUIPMENT_TABS}
      actions={
        canAdd ? (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Ask for something
          </Button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="On the list" value={wanted.length} />
        <StatCard label="Approved" value={approved.length} tone={approved.length ? "good" : "default"} />
        <StatCard label="Would cost" value={formatMoney(totalWanted)} />
      </div>

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-full max-w-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Still wanted</SelectItem>
          <SelectItem value="all">Everything</SelectItem>
          {WISHLIST_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading && items.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title={items.length === 0 ? "Nothing on the wishlist" : "Nothing in this list"}
          description={
            items.length === 0
              ? "Add the thing you find yourself borrowing from the district every term."
              : undefined
          }
          action={
            canAdd && items.length === 0 ? (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" />
                Add the first
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => {
            const itemVotes = votes.filter((v) => v.wishlist_id === item.id);
            const mine = itemVotes.some((v) => v.user_id === profile?.id);

            return (
              <li key={item.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                <button
                  type="button"
                  onClick={() => toggleVote(item.id)}
                  aria-pressed={mine}
                  aria-label={`Vote for ${item.item}`}
                  className={`flex w-14 shrink-0 flex-col items-center rounded-md border py-1.5 transition-colors ${
                    mine ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                  }`}
                >
                  <ThumbsUp className="size-4" />
                  <span className="text-sm font-medium tabular-nums">{itemVotes.length}</span>
                </button>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.item}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[item.status] ?? STATUS_STYLES.Requested
                      }`}
                    >
                      {item.status}
                    </span>
                    {item.estimated_cents > 0 && (
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatMoney(item.estimated_cents)}
                      </span>
                    )}
                  </p>
                  {item.why && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{item.why}</p>
                  )}
                </div>

                {canDecide && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Select value={item.status} onValueChange={(v) => setStatus(item.id, v)}>
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WISHLIST_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      aria-label={`Remove ${item.item}`}
                      onClick={async () => {
                        const { error } = await labDb
                          .from("wishlist")
                          .delete()
                          .eq("id", item.id);
                        if (error) toast.error(error.message);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <WishDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        requesterId={profile?.id ?? null}
      />
    </LabPage>
  );
}

function WishDialog({
  open,
  onOpenChange,
  requesterId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requesterId: string | null;
}) {
  const [item, setItem] = useState("");
  const [why, setWhy] = useState("");
  const [estimate, setEstimate] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!item.trim()) return;
    setSaving(true);

    const { error } = await labDb.from("wishlist").insert({
      item: item.trim(),
      why: why.trim() || null,
      estimated_cents: parseMoney(estimate),
      status: "Requested",
      requested_by: requesterId,
      decided_by: null,
      notes: null,
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Added to the wishlist");
    setItem("");
    setWhy("");
    setEstimate("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Ask for something</DialogTitle>
            <DialogDescription>
              The &ldquo;why&rdquo; is the part that gets things bought. &ldquo;The green tents
              leak&rdquo; beats &ldquo;new tents&rdquo;.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label className="mb-1.5 block">What</Label>
              <Input
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="Two new patrol tents"
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Why</Label>
              <Textarea rows={3} value={why} onChange={(e) => setWhy(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Roughly what it costs</Label>
              <Input
                inputMode="decimal"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="480.00"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
