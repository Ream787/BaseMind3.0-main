import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { MessagesSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { labDb } from "@/lib/lab/client";
import { useLabTable } from "@/lib/lab/useLabTable";
import type { UserProfile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/users/UserAvatar";
import { LabPage } from "@/components/lab/LabPage";
import { EmptyState } from "@/components/lab/LabUi";
import { BOARD_TABS } from "@/components/layout/SectionTabs";

/**
 * A running conversation between leaders.
 *
 * Channels are plain strings rather than a table: there are four of them,
 * they never change, and a channels table would be three more queries to
 * render a tab strip that is a constant.
 *
 * Deleting your own message soft-deletes it — the row stays with
 * `deleted_at` set, so a reply two lines down does not suddenly answer
 * nothing. Only leaders can remove a row outright.
 */

const CHANNELS = [
  { key: "general", label: "General" },
  { key: "camp", label: "Camp" },
  { key: "kit", label: "Kit" },
  { key: "programme", label: "Programme" },
];

export function ChatPage() {
  const { profile, hasRole } = useAuth();
  const [channel, setChannel] = useState("general");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { rows: messages, loading } = useLabTable("messages", {
    orderBy: "created_at",
    filter: { column: "channel", value: channel },
  });

  const canManage = hasRole(["Admin", "Manager"]);

  useEffect(() => {
    supabase
      .from("users")
      .select("*")
      .then(({ data }) => setUsers((data ?? []) as UserProfile[]));
  }, []);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // Jump to the bottom when the conversation changes. A chat that opens
  // at the top is a chat you have to scroll every single time.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, channel]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !profile) return;

    setSending(true);
    const { error } = await labDb.from("messages").insert({
      channel,
      author_id: profile.id,
      body,
      deleted_at: null,
    });
    setSending(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft("");
  }

  async function softDelete(id: string) {
    const { error } = await labDb
      .from("messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
  }

  return (
    <LabPage
      title="Chat"
      description="For the things that are not worth a notice but need saying."
      feature="chat"
      tabs={BOARD_TABS}
    >
      <div className="flex flex-wrap gap-1">
        {CHANNELS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setChannel(c.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              channel === c.key
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            #{c.label}
          </button>
        ))}
      </div>

      <div className="flex h-[60vh] flex-col rounded-lg border bg-card">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loading && messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : messages.length === 0 ? (
            <EmptyState
              icon={<MessagesSquare className="size-6" />}
              title={`Nothing in #${CHANNELS.find((c) => c.key === channel)?.label} yet`}
              description="Say something. It is only the leaders in here."
            />
          ) : (
            messages.map((message, index) => {
              const author = message.author_id ? usersById.get(message.author_id) : null;
              const previous = messages[index - 1];
              const newDay =
                !previous ||
                !isSameDay(parseISO(previous.created_at), parseISO(message.created_at));
              // Consecutive messages from the same person in the same few
              // minutes read as one block, so the avatar is not repeated
              // down the whole screen.
              const sameAuthor =
                !newDay &&
                previous?.author_id === message.author_id &&
                parseISO(message.created_at).getTime() -
                  parseISO(previous.created_at).getTime() <
                  5 * 60 * 1000;
              const mine = message.author_id === profile?.id;

              return (
                <div key={message.id}>
                  {newDay && (
                    <p className="my-3 text-center text-xs text-muted-foreground">
                      {format(parseISO(message.created_at), "EEEE d MMMM")}
                    </p>
                  )}
                  <div className="group flex items-start gap-2">
                    <span className="w-8 shrink-0">
                      {!sameAuthor && author && <UserAvatar user={author} size="sm" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      {!sameAuthor && (
                        <p className="flex items-baseline gap-2">
                          <span className="text-sm font-medium">
                            {author?.name || author?.email || "Someone"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(message.created_at), "HH:mm")}
                          </span>
                        </p>
                      )}
                      {message.deleted_at ? (
                        <p className="text-sm italic text-muted-foreground">
                          Message removed
                        </p>
                      ) : (
                        <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                      )}
                    </div>
                    {!message.deleted_at && (mine || canManage) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                        aria-label="Remove message"
                        onClick={() => softDelete(message.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="flex items-end gap-2 border-t p-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message #${CHANNELS.find((c) => c.key === channel)?.label}`}
            rows={1}
            className="max-h-32 min-h-10 resize-none"
            onKeyDown={(e) => {
              // Enter sends, shift+enter is a new line — the convention
              // every other chat box on the phone already uses.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(e as unknown as FormEvent);
              }
            }}
          />
          <Button type="submit" size="icon" disabled={sending || !draft.trim()}>
            <Send className="size-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </LabPage>
  );
}
