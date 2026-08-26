import { useMemo, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { MessageSquareQuote, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { labDb } from "@/lib/lab/client";
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
import { EmptyState, Stars } from "@/components/lab/LabUi";
import { CAMP_TABS } from "@/components/layout/SectionTabs";

/**
 * What the group thought of a campsite, afterwards.
 *
 * The site directory records the facts — phone number, address, nearest
 * hospital. This records the part nobody writes down and everybody asks:
 * whether the far field floods, whether the warden answers the phone,
 * whether the toilets are worth the drive. It is the single most useful
 * thing a group knows and the first thing that leaves with a leader.
 */

export function SiteReviewsPage() {
  const { hasRole, profile } = useAuth();
  const { rows: sites } = useRealtimeTable("camping_sites", { orderBy: "name" });
  const { rows: reviews, loading } = useLabTable("site_reviews", {
    orderBy: "created_at",
    ascending: false,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const canReview = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);

  /** Sites that have been reviewed, best first, each with its own reviews. */
  const rated = useMemo(() => {
    return sites
      .map((site) => {
        const own = reviews.filter((r) => r.site_id === site.id);
        const average =
          own.length > 0 ? own.reduce((sum, r) => sum + r.rating, 0) / own.length : null;
        return { site, reviews: own, average };
      })
      .filter((entry) => entry.reviews.length > 0)
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  }, [sites, reviews]);

  const unreviewed = sites.filter((site) => !reviews.some((r) => r.site_id === site.id));

  return (
    <LabPage
      title="Site reviews"
      description="What the group actually thought, so the next person planning a camp knows."
      feature="reviews"
      tabs={CAMP_TABS}
      actions={
        canReview && sites.length > 0 ? (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Write one
          </Button>
        ) : undefined
      }
    >
      {sites.length === 0 ? (
        <EmptyState
          icon={<MessageSquareQuote className="size-6" />}
          title="No sites yet"
          description="Reviews hang off the camping sites directory — add a site first."
        />
      ) : loading && reviews.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rated.length === 0 ? (
        <EmptyState
          icon={<MessageSquareQuote className="size-6" />}
          title="Nothing reviewed yet"
          description="Write one after the next camp, while you still remember which field flooded."
          action={
            canReview ? (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" />
                Write the first
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-4">
          {rated.map(({ site, reviews: own, average }) => (
            <li key={site.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">{site.name}</h2>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Stars value={Math.round(average ?? 0)} />
                  {average?.toFixed(1)} from {own.length}{" "}
                  {own.length === 1 ? "visit" : "visits"}
                </span>
              </div>

              <ul className="mt-3 space-y-3">
                {own.map((review) => (
                  <li key={review.id} className="flex items-start gap-3 border-t pt-3">
                    <Stars value={review.rating} size="size-3.5" />
                    <div className="min-w-0 flex-1">
                      {review.comment && (
                        <p className="whitespace-pre-wrap text-sm">{review.comment}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {review.stayed_on
                          ? `Stayed ${format(parseISO(review.stayed_on), "MMMM yyyy")}`
                          : format(parseISO(review.created_at), "d MMM yyyy")}
                      </p>
                    </div>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground"
                        aria-label="Delete review"
                        onClick={async () => {
                          const { error } = await labDb
                            .from("site_reviews")
                            .delete()
                            .eq("id", review.id);
                          if (error) toast.error(error.message);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {unreviewed.length > 0 && rated.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Not reviewed yet: {unreviewed.map((s) => s.name).join(", ")}.
        </p>
      )}

      <ReviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sites={sites}
        authorId={profile?.id ?? null}
      />
    </LabPage>
  );
}

function ReviewDialog({
  open,
  onOpenChange,
  sites,
  authorId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sites: { id: string; name: string }[];
  authorId: string | null;
}) {
  const [siteId, setSiteId] = useState("");
  const [rating, setRating] = useState(4);
  const [comment, setComment] = useState("");
  const [stayedOn, setStayedOn] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!siteId) {
      toast.error("Pick a site");
      return;
    }
    setSaving(true);

    const { error } = await labDb.from("site_reviews").insert({
      site_id: siteId,
      rating,
      comment: comment.trim() || null,
      stayed_on: stayedOn || null,
      author_id: authorId,
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Review saved");
    setComment("");
    setStayedOn("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Review a site</DialogTitle>
            <DialogDescription>
              Write the specifics — which field, which warden, what you would do differently.
              &ldquo;Nice site&rdquo; helps nobody in two years.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label className="mb-1.5 block">Site</Label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Rating</Label>
              <Stars value={rating} onChange={setRating} size="size-6" />
            </div>
            <div>
              <Label className="mb-1.5 block">When you stayed</Label>
              <Input
                type="date"
                value={stayedOn}
                onChange={(e) => setStayedOn(e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">What it was like</Label>
              <Textarea
                rows={5}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Well drained, and the warden actually answers the phone. The far field floods — ask for the top one."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save review"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
