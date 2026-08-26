import { useMemo, useState, type FormEvent } from "react";
import { format, isPast, parseISO } from "date-fns";
import { BarChart3, Check, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { labDb } from "@/lib/lab/client";
import { useLabTable } from "@/lib/lab/useLabTable";
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
 * Asking the group to pick something.
 *
 * Votes are rows keyed on (option, person), so a single-choice poll is
 * enforced by deleting your previous vote before adding the new one
 * rather than by trusting the browser to only send one. Results are
 * visible while voting is open on purpose — these are decisions about
 * campsites, not elections.
 */

export function PollsPage() {
  const { hasRole, profile } = useAuth();
  const { rows: polls, loading } = useLabTable("polls", {
    orderBy: "created_at",
    ascending: false,
  });
  const { rows: options } = useLabTable("poll_options", { orderBy: "sort_order" });
  const { rows: votes } = useLabTable("poll_votes");

  const [dialogOpen, setDialogOpen] = useState(false);
  const canManage = hasRole(["Admin", "Manager"]);

  const optionsByPoll = useMemo(() => {
    const map = new Map<string, typeof options>();
    for (const option of options) {
      const list = map.get(option.poll_id) ?? [];
      list.push(option);
      map.set(option.poll_id, list);
    }
    return map;
  }, [options]);

  async function vote(pollId: string, optionId: string, multi: boolean) {
    if (!profile) return;

    const pollOptionIds = new Set((optionsByPoll.get(pollId) ?? []).map((o) => o.id));
    const mine = votes.filter((v) => v.user_id === profile.id && pollOptionIds.has(v.option_id));
    const existing = mine.find((v) => v.option_id === optionId);

    if (existing) {
      const { error } = await labDb.from("poll_votes").delete().eq("id", existing.id);
      if (error) toast.error(error.message);
      return;
    }

    // Single-choice polls: clear the old answer first, so the constraint
    // never has to arbitrate between two.
    if (!multi && mine.length > 0) {
      const { error } = await labDb
        .from("poll_votes")
        .delete()
        .in(
          "id",
          mine.map((v) => v.id),
        );
      if (error) {
        toast.error(error.message);
        return;
      }
    }

    const { error } = await labDb
      .from("poll_votes")
      .insert({ option_id: optionId, user_id: profile.id });
    if (error) toast.error(error.message);
  }

  return (
    <LabPage
      title="Polls"
      description="For the questions that turn into a forty-message thread otherwise."
      feature="polls"
      tabs={BOARD_TABS}
      actions={
        canManage ? (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            New poll
          </Button>
        ) : undefined
      }
    >
      {loading && polls.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : polls.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="size-6" />}
          title="No polls yet"
          description="Ask something with a small number of answers — a site, a date, who can help on which night."
          action={
            canManage ? (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" />
                Ask something
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-4">
          {polls.map((poll) => {
            const pollOptions = optionsByPoll.get(poll.id) ?? [];
            const optionIds = new Set(pollOptions.map((o) => o.id));
            const pollVotes = votes.filter((v) => optionIds.has(v.option_id));
            const voters = new Set(pollVotes.map((v) => v.user_id)).size;
            const closed =
              poll.closed || (poll.closes_on ? isPast(parseISO(poll.closes_on)) : false);
            const maxVotes = Math.max(
              1,
              ...pollOptions.map((o) => pollVotes.filter((v) => v.option_id === o.id).length),
            );

            return (
              <li key={poll.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 font-medium">
                      {closed && <Lock className="size-4 shrink-0 text-muted-foreground" />}
                      {poll.question}
                    </h2>
                    {poll.detail && (
                      <p className="text-sm text-muted-foreground">{poll.detail}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {voters} {voters === 1 ? "person has" : "people have"} voted
                      {poll.multi && " · pick as many as you like"}
                      {poll.closes_on && !closed && (
                        <> · closes {format(parseISO(poll.closes_on), "d MMM")}</>
                      )}
                      {closed && " · closed"}
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 items-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={async () => {
                          const { error } = await labDb
                            .from("polls")
                            .update({ closed: !poll.closed })
                            .eq("id", poll.id);
                          if (error) toast.error(error.message);
                        }}
                      >
                        {poll.closed ? "Reopen" : "Close"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        aria-label="Delete poll"
                        onClick={async () => {
                          const { error } = await labDb.from("polls").delete().eq("id", poll.id);
                          if (error) toast.error(error.message);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <ul className="mt-3 space-y-2">
                  {pollOptions.map((option) => {
                    const count = pollVotes.filter((v) => v.option_id === option.id).length;
                    const mine = pollVotes.some(
                      (v) => v.option_id === option.id && v.user_id === profile?.id,
                    );

                    return (
                      <li key={option.id}>
                        <button
                          type="button"
                          disabled={closed}
                          onClick={() => vote(poll.id, option.id, poll.multi)}
                          className={`w-full rounded-md border p-2 text-left transition-colors disabled:cursor-default ${
                            mine ? "border-primary bg-primary/5" : "hover:bg-accent"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2 text-sm">
                            <span className="flex min-w-0 items-center gap-2">
                              {mine && <Check className="size-4 shrink-0 text-primary" />}
                              <span className="truncate">{option.label}</span>
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {count}
                            </span>
                          </span>
                          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full bg-primary transition-[width] duration-300"
                              style={{ width: `${(count / maxVotes) * 100}%` }}
                            />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      <NewPollDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        authorId={profile?.id ?? null}
      />
    </LabPage>
  );
}

function NewPollDialog({
  open,
  onOpenChange,
  authorId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorId: string | null;
}) {
  const [question, setQuestion] = useState("");
  const [detail, setDetail] = useState("");
  const [optionText, setOptionText] = useState("");
  const [multi, setMulti] = useState(false);
  const [closesOn, setClosesOn] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const labels = optionText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (!question.trim()) return;
    if (labels.length < 2) {
      toast.error("A poll needs at least two answers");
      return;
    }

    setSaving(true);
    const { data, error } = await labDb
      .from("polls")
      .insert({
        question: question.trim(),
        detail: detail.trim() || null,
        multi,
        closes_on: closesOn || null,
        closed: false,
        created_by: authorId,
      })
      .select("id")
      .single();

    if (error || !data) {
      setSaving(false);
      toast.error(error?.message ?? "Couldn't create the poll");
      return;
    }

    const { error: optionError } = await labDb.from("poll_options").insert(
      labels.map((label, index) => ({
        poll_id: data.id,
        label,
        sort_order: index + 1,
      })),
    );

    setSaving(false);
    if (optionError) {
      toast.error(optionError.message);
      return;
    }

    toast.success("Poll created");
    setQuestion("");
    setDetail("");
    setOptionText("");
    setClosesOn("");
    setMulti(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New poll</DialogTitle>
            <DialogDescription>
              Answers go one per line. Results are visible while it is open — this is for picking
              a campsite, not for a secret ballot.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label className="mb-1.5 block">Question</Label>
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Where for summer camp?"
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Any detail</Label>
              <Textarea rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Answers, one per line</Label>
              <Textarea
                rows={4}
                value={optionText}
                onChange={(e) => setOptionText(e.target.value)}
                placeholder={"Gilwell Park\nBroadstone Warren\nYoulbury"}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Closes (optional)</Label>
              <Input
                type="date"
                value={closesOn}
                onChange={(e) => setClosesOn(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={multi} onCheckedChange={(v) => setMulti(v === true)} />
              People can pick more than one
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create poll"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
