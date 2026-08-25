import { useRef, useState } from "react";
import { AlertTriangle, Quote, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { selectPoliciesForPrompt, verifyAnswer, type CheckedAnswer } from "@/lib/policyChat";
import type { Policy } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Turn = {
  question: string;
  result: CheckedAnswer | null;
  error?: string;
};

export function PolicyChat({ policies }: { policies: Policy[] }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [asking, setAsking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const readable = policies.filter((p) => p.content.trim().length > 0);

  async function ask() {
    const q = question.trim();
    if (!q || asking) return;

    setQuestion("");
    setAsking(true);
    setTurns((prev) => [...prev, { question: q, result: null }]);

    try {
      const sources = selectPoliciesForPrompt(
        readable.map((p) => ({ id: p.id, title: p.title, content: p.content })),
        q,
      );

      // Only the questions and short answers go back as history — resending
      // whole documents each turn would grow the prompt without adding
      // anything the current turn doesn't already include.
      const history = turns
        .slice(-3)
        .filter((t) => t.result)
        .map((t) => `Q: ${t.question}\nA: ${t.result!.answer.slice(0, 400)}`)
        .join("\n\n");

      const { data, error } = await supabase.functions.invoke("policy-chat", {
        body: { policies: sources, question: q, history },
      });

      if (error) {
        const context = (error as { context?: Response }).context;
        const body = await context?.json().catch(() => null);
        throw new Error(body?.error ?? error.message);
      }

      // The function already checks citations; checking again here means a
      // trusted display path even if that ever changes.
      const result = verifyAnswer(
        { answer: data?.answer, citations: data?.citations },
        sources,
      );

      setTurns((prev) => prev.map((t, i) => (i === prev.length - 1 ? { ...t, result } : t)));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setTurns((prev) =>
        prev.map((t, i) => (i === prev.length - 1 ? { ...t, error: message } : t)),
      );
      toast.error(message);
    } finally {
      setAsking(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  if (readable.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        <Sparkles className="size-5" />
        <p>Add a policy document and you can ask questions about it here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Answers come only from your {readable.length}{" "}
        {readable.length === 1 ? "policy" : "policies"}, and every claim is quoted. Quotes are
        checked against the real document before you see them.
      </p>

      <div className="flex flex-col gap-4">
        {turns.map((turn, index) => (
          <div key={index} className="flex flex-col gap-2">
            <p className="self-end rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
              {turn.question}
            </p>

            {turn.error ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                {turn.error}
              </p>
            ) : !turn.result ? (
              <p className="text-sm text-muted-foreground">Reading the policies…</p>
            ) : (
              <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <p className="whitespace-pre-wrap text-sm">{turn.result.answer}</p>

                {turn.result.citations.length > 0 && (
                  <div className="flex flex-col gap-2 border-t pt-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Where this comes from
                    </span>
                    {turn.result.citations.map((cite, i) => (
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

                {turn.result.unsupported && (
                  <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      This answer couldn&apos;t be traced to any policy, so check it against the
                      documents yourself before relying on it.
                    </span>
                  </p>
                )}

                {turn.result.rejected.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {turn.result.rejected.length}{" "}
                    {turn.result.rejected.length === 1 ? "quote was" : "quotes were"} discarded for
                    not matching the document they claimed to come from.
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <Input
          placeholder="e.g. What supervision is needed for axe work?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={asking}
        />
        <Button type="submit" disabled={asking || !question.trim()}>
          <Send className="size-4" />
          <span className="sr-only sm:not-sr-only">Ask</span>
        </Button>
      </form>
    </div>
  );
}
