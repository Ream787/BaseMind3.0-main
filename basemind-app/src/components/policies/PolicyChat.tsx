import { useEffect, useRef } from "react";
import { AlertTriangle, Quote, SearchX, Send, Sparkles } from "lucide-react";

import { isPending, type ChatMessage } from "@/lib/policyChats";
import type { Policy } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Explains, in a line, how much of the shelf a "not covered" verdict rests on.
 *
 * Worth saying only in that case: when the answer arrived, nobody cares how it
 * was found; when it didn't, whether everything was searched is the difference
 * between "it isn't written down" and "ask again, more narrowly".
 */
function describeSearch(searched: number, total: number): string {
  if (searched >= total) {
    return total === 1
      ? "Searched your one policy document, in full."
      : `Searched all ${total} of your policy documents, in full.`;
  }
  return (
    `Only ${searched} of your ${total} documents fitted into this question, so the ` +
    "rest weren't read. Naming a document in your question is the way to be sure " +
    "it gets searched."
  );
}

/**
 * The conversation itself: a scrolling transcript with the question box pinned
 * underneath it.
 *
 * Deliberately owns no chat state. Which conversation is open, and what has
 * been saved, is the page's business — this renders what it's handed, which is
 * what lets a chat reopened from the list look identical to one just asked.
 */
export function PolicyChat({
  policies,
  messages,
  question,
  onQuestionChange,
  onAsk,
  asking,
}: {
  policies: Policy[];
  messages: ChatMessage[];
  question: string;
  onQuestionChange: (value: string) => void;
  onAsk: (question: string) => void;
  asking: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const readable = policies.filter((p) => p.content.trim().length > 0);

  // Follow the conversation down as it grows, the way a chat app does.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: messages.length > 1 ? "smooth" : "auto" });
  }, [messages]);

  function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed || asking || readable.length === 0) return;
    onAsk(trimmed);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <EmptyState count={readable.length} />
        ) : (
          messages.map((message) =>
            message.role === "user" ? (
              <p
                key={message.id}
                className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground sm:max-w-[70%]"
              >
                {message.content}
              </p>
            ) : (
              <Answer
                key={message.id}
                message={message}
                total={readable.length}
                asking={asking}
                onAsk={submit}
              />
            ),
          )
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex shrink-0 gap-2 border-t pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
      >
        <Input
          placeholder={
            readable.length === 0
              ? "Add a policy document first"
              : "e.g. What supervision is needed for axe work?"
          }
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          disabled={asking || readable.length === 0}
        />
        <Button type="submit" disabled={asking || !question.trim() || readable.length === 0}>
          <Send className="size-4" />
          <span className="sr-only sm:not-sr-only">Ask</span>
        </Button>
      </form>
    </div>
  );
}

function EmptyState({ count }: { count: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
      <Sparkles className="size-6" />
      {count === 0 ? (
        <p className="max-w-sm">
          Add a policy document and you can ask questions about it here.
        </p>
      ) : (
        <p className="max-w-sm">
          Ask anything about your {count} {count === 1 ? "policy" : "policies"}. Answers come
          only from those documents, and every claim is quoted and checked against the real
          text before you see it.
        </p>
      )}
    </div>
  );
}

function Answer({
  message,
  total,
  asking,
  onAsk,
}: {
  message: ChatMessage;
  total: number;
  asking: boolean;
  onAsk: (question: string) => void;
}) {
  if (message.error) {
    return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
        {message.error}
      </p>
    );
  }

  if (isPending(message)) {
    return <p className="text-sm text-muted-foreground">Reading the policies…</p>;
  }

  const result = message.result!;

  return (
    <div className="flex max-w-[95%] flex-col gap-2 self-start rounded-2xl rounded-bl-sm border bg-card p-3 sm:max-w-[85%]">
      {!result.covered && (
        <p className="flex items-center gap-2 text-sm font-medium">
          <SearchX className="size-4 shrink-0 text-muted-foreground" />
          Your policies don&apos;t cover this
        </p>
      )}

      <p className="whitespace-pre-wrap text-sm">{result.answer}</p>

      {result.citations.length > 0 && (
        <div className="flex flex-col gap-2 border-t pt-2">
          <span className="text-xs font-medium text-muted-foreground">
            {result.covered ? "Where this comes from" : "The closest thing they do say"}
          </span>
          {result.citations.map((cite, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <Quote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="italic text-muted-foreground">&ldquo;{cite.quote}&rdquo;</p>
                <p className="text-xs font-medium">{cite.policyTitle}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!result.covered && (
        <div className="flex flex-col gap-2 border-t pt-2">
          {result.related.length > 0 && (
            <>
              <span className="text-xs font-medium text-muted-foreground">
                These documents can answer
              </span>
              <div className="flex flex-wrap gap-2">
                {result.related.map((suggestion, i) => (
                  <Button
                    key={i}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={asking}
                    onClick={() => onAsk(suggestion)}
                    className="h-auto whitespace-normal py-1.5 text-left text-xs"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            {describeSearch(message.searched ?? total, total)}
          </p>
        </div>
      )}

      {result.unsupported && (
        <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            This answer couldn&apos;t be traced to any policy, so check it against the
            documents yourself before relying on it.
          </span>
        </p>
      )}

      {result.rejected.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {result.rejected.length} {result.rejected.length === 1 ? "quote was" : "quotes were"}{" "}
          discarded for not matching the document they claimed to come from.
        </p>
      )}
    </div>
  );
}
