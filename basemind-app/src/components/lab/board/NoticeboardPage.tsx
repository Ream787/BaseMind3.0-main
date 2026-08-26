import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format, isPast, parseISO } from "date-fns";
import { Megaphone, Pencil, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { labDb } from "@/lib/lab/client";
import { useLabTable } from "@/lib/lab/useLabTable";
import type { Announcement } from "@/types/lab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { BOARD_TABS } from "@/components/layout/SectionTabs";

/**
 * The noticeboard.
 *
 * Leaders post; everybody reads and can react. Reactions are stored one
 * row per person per emoji, which is more rows than a counter but is the
 * only version that can answer "have I already reacted to this" without
 * trusting the browser to remember.
 *
 * Expired notices are hidden rather than deleted. "Deposits due by the
 * end of the month" should stop shouting on the first, and should still
 * be there in March when somebody asks what the deposit was.
 */

const REACTIONS = ["👍", "🎉", "🤔", "😂"];

export function NoticeboardPage() {
  const { hasRole, profile } = useAuth();
  const { rows: notices, loading } = useLabTable("announcements", {
    orderBy: "created_at",
    ascending: false,
  });
  const { rows: reactions } = useLabTable("announcement_reactions");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [showExpired, setShowExpired] = useState(false);

  const canPost = hasRole(["Admin", "Manager"]);

  const visible = useMemo(() => {
    const live = notices.filter(
      (n) => showExpired || !n.expires_on || !isPast(parseISO(n.expires_on)),
    );
    // Pinned first, then newest. Sorting by pinned alone would leave two
    // pinned notices in whatever order the realtime events arrived in.
    return [...live].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [notices, showExpired]);

  const expiredCount = notices.length - visible.length;

  const reactionsFor = (noticeId: string) =>
    reactions.filter((r) => r.announcement_id === noticeId);

  async function react(noticeId: string, emoji: string) {
    if (!profile) return;
    const mine = reactions.find(
      (r) => r.announcement_id === noticeId && r.user_id === profile.id && r.emoji === emoji,
    );

    const { error } = mine
      ? await labDb.from("announcement_reactions").delete().eq("id", mine.id)
      : await labDb.from("announcement_reactions").insert({
          announcement_id: noticeId,
          user_id: profile.id,
          emoji,
        });

    if (error) toast.error(error.message);
  }

  async function togglePin(notice: Announcement) {
    const { error } = await labDb
      .from("announcements")
      .update({ pinned: !notice.pinned })
      .eq("id", notice.id);
    if (error) toast.error(error.message);
  }

  return (
    <LabPage
      title="Noticeboard"
      description="What everybody needs to know, in one place instead of four group chats."
      feature="noticeboard"
      tabs={BOARD_TABS}
      actions={
        canPost ? (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Post a notice
          </Button>
        ) : undefined
      }
    >
      {expiredCount > 0 && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={showExpired} onCheckedChange={(v) => setShowExpired(v === true)} />
          Show {expiredCount} expired {expiredCount === 1 ? "notice" : "notices"}
        </label>
      )}

      {loading && notices.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-6" />}
          title="Nothing on the board"
          description="Post the things people ask about twice a week — deposits, kit, what time the minibus leaves."
          action={
            canPost ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                Post the first notice
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((notice) => {
            const expired = notice.expires_on && isPast(parseISO(notice.expires_on));
            const mine = reactionsFor(notice.id);

            return (
              <li
                key={notice.id}
                className={`rounded-lg border bg-card p-4 ${
                  notice.pinned ? "border-primary/40" : ""
                } ${expired ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 font-medium">
                      {notice.pinned && <Pin className="size-4 shrink-0 text-primary" />}
                      {notice.title}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(notice.created_at), "d MMM yyyy")}
                      {notice.expires_on && (
                        <>
                          {" · "}
                          {expired ? "expired" : "until"}{" "}
                          {format(parseISO(notice.expires_on), "d MMM")}
                        </>
                      )}
                    </p>
                  </div>

                  {canPost && (
                    <div className="flex shrink-0 items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={notice.pinned ? "Unpin" : "Pin to the top"}
                        onClick={() => togglePin(notice)}
                      >
                        {notice.pinned ? (
                          <PinOff className="size-4" />
                        ) : (
                          <Pin className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label="Edit"
                        onClick={() => {
                          setEditing(notice);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        aria-label="Delete"
                        onClick={async () => {
                          const { error } = await labDb
                            .from("announcements")
                            .delete()
                            .eq("id", notice.id);
                          if (error) toast.error(error.message);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {notice.body && (
                  <p className="mt-2 whitespace-pre-wrap text-sm">{notice.body}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {REACTIONS.map((emoji) => {
                    const count = mine.filter((r) => r.emoji === emoji).length;
                    const reacted = mine.some(
                      (r) => r.emoji === emoji && r.user_id === profile?.id,
                    );
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => react(notice.id, emoji)}
                        className={`rounded-full border px-2 py-0.5 text-sm transition-colors ${
                          reacted
                            ? "border-primary bg-primary/10"
                            : "border-transparent bg-muted hover:bg-accent"
                        }`}
                        aria-pressed={reacted}
                      >
                        {emoji}
                        {count > 0 && (
                          <span className="ml-1 text-xs tabular-nums text-muted-foreground">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <NoticeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        notice={editing}
        authorId={profile?.id ?? null}
      />
    </LabPage>
  );
}

function NoticeDialog({
  open,
  onOpenChange,
  notice,
  authorId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notice: Announcement | null;
  authorId: string | null;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [expiresOn, setExpiresOn] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(notice?.title ?? "");
    setBody(notice?.body ?? "");
    setPinned(notice?.pinned ?? false);
    setExpiresOn(notice?.expires_on ?? "");
  }, [open, notice]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    const payload = {
      title: title.trim(),
      body: body.trim(),
      pinned,
      expires_on: expiresOn || null,
    };

    const { error } = notice
      ? await labDb.from("announcements").update(payload).eq("id", notice.id)
      : await labDb.from("announcements").insert({ ...payload, author_id: authorId });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(notice ? "Notice updated" : "Posted");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{notice ? "Edit notice" : "New notice"}</DialogTitle>
            <DialogDescription>
              An expiry date makes it disappear from the board on its own — it is still there to
              look up, it just stops taking up room.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label className="mb-1.5 block">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label className="mb-1.5 block">What it says</Label>
              <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Hide after (optional)</Label>
              <Input
                type="date"
                value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(v === true)} />
              Pin to the top
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : notice ? "Save" : "Post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
