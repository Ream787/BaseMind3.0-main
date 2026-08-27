/**
 * Saved assistant conversations.
 *
 * Chats live in the database rather than in component state so a question
 * asked on Tuesday is still there on Thursday, and so the answer's checked
 * citations are kept with it. They're private to whoever asked - the database
 * enforces that, this module just doesn't work around it.
 */
import { supabase } from "@/lib/supabase/client";
import type { CheckedAnswer } from "@/lib/policyChat";
import type { PolicyChat, PolicyChatMessage } from "@/types/database";

/**
 * How many earlier exchanges are replayed to the model.
 *
 * Enough for "and what about cubs?" to make sense, and no more. A saved chat
 * can run to fifty messages, and sending all of them would push the policy
 * documents - the thing the answer actually has to come from - further down
 * a prompt that gets slower and more expensive every turn. Follow-ups need
 * the last thing said, not the whole afternoon.
 */
export const MAX_HISTORY_TURNS = 3;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Present on assistant messages that completed; null while in flight. */
  result: CheckedAnswer | null;
  /** Set instead of a result when the request failed. */
  error?: string;
  /** How many documents this question was put to, for the "not covered" note. */
  searched?: number;
};

/** A message that is still waiting for its answer. */
export function isPending(message: ChatMessage): boolean {
  return message.role === "assistant" && !message.result && !message.error;
}

/**
 * The transcript as the model sees it: the last few exchanges, questions and
 * answers only.
 *
 * The documents themselves are sent separately every turn, so repeating them
 * here would only spend tokens. Answers are truncated because what a
 * follow-up needs from an earlier turn is the gist, not the citations.
 */
export function buildHistory(messages: ChatMessage[], turns = MAX_HISTORY_TURNS): string {
  const pairs: string[] = [];

  for (let i = messages.length - 1; i >= 0 && pairs.length < turns; i--) {
    const answer = messages[i];
    if (answer.role !== "assistant" || !answer.result) continue;
    const question = messages[i - 1];
    if (!question || question.role !== "user") continue;
    pairs.unshift(`Q: ${question.content}\nA: ${answer.result.answer.slice(0, 400)}`);
    i--; // the question is consumed with its answer
  }

  return pairs.join("\n\n");
}

/**
 * A chat's name, taken from the question that started it.
 *
 * Long questions are cut at a word boundary: "What supervision is needed for
 * axe…" reads as a chat, "What supervision is needed for axe w" reads as a bug.
 */
export function titleFromQuestion(question: string, maxLength = 60): string {
  const clean = question.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export async function loadChats(): Promise<PolicyChat[]> {
  const { data, error } = await supabase
    .from("policy_chats")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadMessages(chatId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("policy_chat_messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toChatMessage);
}

/** What goes in the `result` column: the checked answer plus how it was found. */
type StoredResult = CheckedAnswer & { searched?: number };

function toChatMessage(row: PolicyChatMessage): ChatMessage {
  const stored = (row.result as StoredResult | null) ?? null;
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    // Stored already-checked, so it is displayed as it was, not re-verified.
    result: stored,
    searched: stored?.searched,
  };
}

export async function createChat(userId: string, title: string): Promise<PolicyChat> {
  const { data, error } = await supabase
    .from("policy_chats")
    .insert({ user_id: userId, title })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveMessage(
  chatId: string,
  role: "user" | "assistant",
  content: string,
  result: CheckedAnswer | null = null,
  searched?: number,
): Promise<PolicyChatMessage> {
  const stored: StoredResult | null = result ? { ...result, searched } : null;
  const { data, error } = await supabase
    .from("policy_chat_messages")
    .insert({ chat_id: chatId, role, content, result: stored })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Bumps the chat so it sorts to the top of the list.
 *
 * Deliberately not awaited by callers: the answer is already on screen, and
 * a failed reorder isn't worth an error message.
 */
export async function touchChat(chatId: string): Promise<void> {
  await supabase
    .from("policy_chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", chatId);
}

export async function renameChat(chatId: string, title: string): Promise<void> {
  const { error } = await supabase.from("policy_chats").update({ title }).eq("id", chatId);
  if (error) throw new Error(error.message);
}

export async function deleteChat(chatId: string): Promise<void> {
  // Messages go with it: the foreign key cascades.
  const { error } = await supabase.from("policy_chats").delete().eq("id", chatId);
  if (error) throw new Error(error.message);
}
