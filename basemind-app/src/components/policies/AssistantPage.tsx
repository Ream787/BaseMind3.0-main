import { useEffect, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { History, MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { selectPoliciesForPrompt, verifyAnswer, type CheckedAnswer } from "@/lib/policyChat";
import {
  buildHistory,
  createChat,
  deleteChat,
  loadChats,
  loadMessages,
  saveMessage,
  titleFromQuestion,
  touchChat,
  type ChatMessage,
} from "@/lib/policyChats";
import type { PolicyChat as SavedChat } from "@/types/database";
import { Button } from "@/components/ui/button";
import { SectionTabs, ASSISTANT_TABS } from "@/components/layout/SectionTabs";
import { PolicyChat } from "@/components/policies/PolicyChat";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * The assistant, as its own destination rather than half of the policies page.
 *
 * It owns the conversation: which chat is open, what has been asked, and what
 * has been written back to the database. The chat component below it is purely
 * a view, which is what lets a reopened conversation render identically to one
 * that has just happened.
 *
 * Nothing is saved until an answer actually arrives. A failed question leaves
 * no half-conversation behind to reopen and puzzle over.
 */
export function AssistantPage() {
  const { profile } = useAuth();
  const { rows: policies, loading: policiesLoading } = useRealtimeTable("policies", {
    orderBy: "title",
  });

  const [chats, setChats] = useState<SavedChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedChat | null>(null);

  useEffect(() => {
    loadChats()
      .then(setChats)
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setChatsLoading(false));
  }, []);

  async function openChat(chat: SavedChat) {
    setActiveId(chat.id);
    setHistoryOpen(false);
    setMessages([]);
    try {
      setMessages(await loadMessages(chat.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open that chat.");
    }
  }

  function startNewChat() {
    setActiveId(null);
    setMessages([]);
    setQuestion("");
    setHistoryOpen(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteChat(target.id);
      setChats((prev) => prev.filter((c) => c.id !== target.id));
      if (activeId === target.id) startNewChat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete that chat.");
    }
  }

  async function ask(asked: string) {
    if (asking) return;

    const readable = policies.filter((p) => p.content.trim().length > 0);
    if (readable.length === 0) return;

    setQuestion("");
    setAsking(true);

    // Local ids so the optimistic pair can be replaced by the saved rows.
    const pendingId = crypto.randomUUID();
    const history = buildHistory(messages);
    setMessages((prev) => [
      ...prev,
      { id: `${pendingId}-q`, role: "user", content: asked, result: null },
      { id: pendingId, role: "assistant", content: "", result: null },
    ]);

    const sources = selectPoliciesForPrompt(
      readable.map((p) => ({ id: p.id, title: p.title, content: p.content })),
      asked,
    );

    try {
      const { data, error } = await supabase.functions.invoke("policy-chat", {
        body: { policies: sources, question: asked, history },
      });

      if (error) {
        const context = (error as { context?: Response }).context;
        const body = await context?.json().catch(() => null);
        // The function puts the underlying cause in `detail`. Dropping it left
        // a bare "502" with nothing to act on.
        const parts = [body?.error, body?.reason, body?.detail].filter(Boolean);
        throw new Error(parts.length > 0 ? parts.join(" — ") : error.message);
      }

      // The function already checks citations; checking again here means a
      // trusted display path even if that ever changes.
      const result = verifyAnswer(
        { answer: data?.answer, citations: data?.citations, covered: data?.covered, related: data?.related },
        sources,
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId ? { ...m, content: result.answer, result, searched: sources.length } : m,
        ),
      );

      await persist(asked, result, sources.length);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...m, error: message } : m)));
      toast.error(message);
    } finally {
      setAsking(false);
    }
  }

  /** Writes a completed exchange to the database, creating the chat if needed. */
  async function persist(asked: string, result: CheckedAnswer, searched: number) {
    if (!profile?.id) return;
    try {
      // A brand new chat is already at the top of the list with a fresh
      // timestamp, so only an existing one needs bumping.
      const existingId = activeId;
      let chatId = existingId;

      if (!chatId) {
        const chat = await createChat(profile.id, titleFromQuestion(asked));
        chatId = chat.id;
        setActiveId(chat.id);
        setChats((prev) => [chat, ...prev]);
      }

      await saveMessage(chatId, "user", asked);
      await saveMessage(chatId, "assistant", result.answer, result, searched);

      if (existingId) {
        void touchChat(existingId);
        const now = new Date().toISOString();
        setChats((prev) =>
          [...prev]
            .map((c) => (c.id === existingId ? { ...c, updated_at: now } : c))
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
        );
      }
    } catch (err) {
      // The answer is already on screen and correct; only the record failed.
      toast.error(
        `Answered, but couldn't save the chat: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      );
    }
  }

  const chatList = (
    <ChatList
      chats={chats}
      loading={chatsLoading}
      activeId={activeId}
      onOpen={openChat}
      onDelete={setDeleteTarget}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <SectionTabs tabs={ASSISTANT_TABS} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Assistant</h1>
          <p className="text-sm text-muted-foreground">
            {policiesLoading
              ? "Loading your policies…"
              : "Answers come only from your policy documents, and every claim is quoted."}
          </p>
        </div>
        <div className="flex gap-2">
          {/* On a phone the list is a drawer: the conversation is what you
              came for, and a sidebar would leave it a column too narrow. */}
          <Button
            variant="outline"
            className="md:hidden"
            onClick={() => setHistoryOpen(true)}
            disabled={chats.length === 0}
          >
            <History className="size-4" />
            Saved
            {chats.length > 0 && ` (${chats.length})`}
          </Button>
          <Button variant="outline" onClick={startNewChat} disabled={!activeId && messages.length === 0}>
            <MessageSquarePlus className="size-4" />
            New chat
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[16rem_1fr]">
        <aside className="hidden min-h-0 flex-col overflow-y-auto border-r pr-4 md:flex">
          {chatList}
        </aside>

        <PolicyChat
          policies={policies}
          messages={messages}
          question={question}
          onQuestionChange={setQuestion}
          onAsk={ask}
          asking={asking}
        />
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Saved chats</DialogTitle>
            <DialogDescription>
              Only you can see these. They stay until you delete them.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">{chatList}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this chat?</DialogTitle>
            <DialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; and everything in it will be removed. This
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button onClick={confirmDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChatList({
  chats,
  loading,
  activeId,
  onOpen,
  onDelete,
}: {
  chats: SavedChat[];
  loading: boolean;
  activeId: string | null;
  onOpen: (chat: SavedChat) => void;
  onDelete: (chat: SavedChat) => void;
}) {
  if (loading) {
    return <p className="p-2 text-sm text-muted-foreground">Loading chats…</p>;
  }
  if (chats.length === 0) {
    return (
      <p className="p-2 text-sm text-muted-foreground">
        Your questions are saved here once they&apos;ve been answered.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {chats.map((chat) => (
        <li key={chat.id} className="group flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpen(chat)}
            className={`flex min-w-0 flex-1 flex-col items-start rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent ${
              chat.id === activeId ? "bg-accent" : ""
            }`}
          >
            <span className="w-full truncate text-sm">{chat.title}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(parseISO(chat.updated_at), { addSuffix: true })}
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${chat.title}`}
            className="shrink-0"
            onClick={() => onDelete(chat)}
          >
            <Trash2 className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
