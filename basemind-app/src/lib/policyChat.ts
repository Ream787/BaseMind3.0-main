export type PolicySource = {
  id: string;
  title: string;
  content: string;
};

/** What the model is asked to return for each claim it makes. */
export type RawCitation = {
  policy_id?: string;
  policy_title?: string;
  quote?: string;
};

export type RawAnswer = {
  answer?: string;
  citations?: RawCitation[];
  /**
   * The model's own verdict on whether the documents answered the question.
   *
   * Optional because the Edge Function is deployed by hand: a browser running
   * this code may still be talking to a version that never sends it. A missing
   * flag therefore has to mean "work it out from the prose", not "not covered".
   */
  covered?: boolean;
  /** Questions these documents *can* answer, offered when this one wasn't. */
  related?: string[];
};

export type VerifiedCitation = {
  policyId: string;
  policyTitle: string;
  quote: string;
};

export type RejectedCitation = {
  policyTitle: string;
  quote: string;
  reason: "unknown-policy" | "quote-not-found";
};

export type CheckedAnswer = {
  answer: string;
  citations: VerifiedCitation[];
  rejected: RejectedCitation[];
  /** True when the answer made claims but none could be traced to a policy. */
  unsupported: boolean;
  /** False when the documents simply don't address what was asked. */
  covered: boolean;
  /**
   * Questions worth asking instead. Only populated when `covered` is false —
   * a dead end is the one moment where suggestions are help rather than clutter.
   */
  related: string[];
};

/**
 * Whitespace-insensitive, case-insensitive form for comparing a quote against
 * a document.
 *
 * PDF extraction introduces line breaks and runs of spaces that don't exist
 * in the sentence a reader sees, so an exact string match would reject
 * perfectly honest quotes. Punctuation is kept — dropping it would let
 * meaningfully different text match.
 */
export function normalizeForMatch(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Does this quote genuinely appear in this policy? */
export function quoteAppearsIn(policyContent: string, quote: string): boolean {
  const needle = normalizeForMatch(quote);
  // Very short quotes match by accident, so they aren't evidence of anything.
  if (needle.length < 12) return false;
  return normalizeForMatch(policyContent).includes(needle);
}

/**
 * Checks an answer's citations against the real documents.
 *
 * The model is instructed to quote verbatim, but instructions aren't a
 * guarantee — so every quote is looked up in the policy it claims to come
 * from, and any that isn't there is dropped rather than displayed. A citation
 * nobody can follow is worse than no citation, because it looks authoritative.
 */
export function verifyAnswer(raw: RawAnswer, policies: PolicySource[]): CheckedAnswer {
  const byId = new Map(policies.map((p) => [p.id, p]));
  const byTitle = new Map(policies.map((p) => [normalizeForMatch(p.title), p]));

  const citations: VerifiedCitation[] = [];
  const rejected: RejectedCitation[] = [];

  for (const cite of raw.citations ?? []) {
    const quote = (cite.quote ?? "").trim();
    if (!quote) continue;

    const policy =
      (cite.policy_id ? byId.get(cite.policy_id) : undefined) ??
      (cite.policy_title ? byTitle.get(normalizeForMatch(cite.policy_title)) : undefined);

    if (!policy) {
      rejected.push({
        policyTitle: cite.policy_title ?? "Unknown document",
        quote,
        reason: "unknown-policy",
      });
      continue;
    }

    if (!quoteAppearsIn(policy.content, quote)) {
      rejected.push({ policyTitle: policy.title, quote, reason: "quote-not-found" });
      continue;
    }

    // Don't list the same quote twice if the model repeats itself.
    const seen = citations.some(
      (c) => c.policyId === policy.id && normalizeForMatch(c.quote) === normalizeForMatch(quote),
    );
    if (!seen) {
      citations.push({ policyId: policy.id, policyTitle: policy.title, quote });
    }
  }

  const answer = (raw.answer ?? "").trim();

  // The model's own flag is the better signal, so it wins when it's there.
  // Reading the prose stays as the fallback for replies that predate the flag.
  const covered =
    typeof raw.covered === "boolean" ? raw.covered : !saysItDoesNotKnow(answer);

  return {
    answer,
    citations,
    rejected,
    covered,
    related: covered ? [] : cleanSuggestions(raw.related),
    // An answer that says it found nothing is fine uncited; one that asserts
    // something without a usable citation is not.
    unsupported: answer.length > 0 && citations.length === 0 && covered,
  };
}

/**
 * Tidies the suggested follow-up questions before they become buttons.
 *
 * They come from the model, so they arrive blank, duplicated, or as a
 * paragraph wearing a question mark. Anything that wouldn't read as a question
 * on a button is dropped rather than shown badly — three good suggestions are
 * worth more than six padded ones, which is why the list is capped short.
 */
function cleanSuggestions(related: unknown): string[] {
  if (!Array.isArray(related)) return [];

  const seen = new Set<string>();
  const questions: string[] = [];

  for (const item of related) {
    if (typeof item !== "string") continue;
    const question = item.replace(/\s+/g, " ").trim();
    if (question.length < 8 || question.length > 120) continue;

    const key = normalizeForMatch(question);
    if (seen.has(key)) continue;
    seen.add(key);

    questions.push(question);
    if (questions.length === 3) break;
  }

  return questions;
}

/**
 * Recognises the model declining, so a straight "the policies don't cover
 * that" isn't flagged as an unsupported claim. Declining is the correct
 * behaviour and shouldn't be shown to the user as a problem.
 */
function saysItDoesNotKnow(answer: string): boolean {
  const a = answer.toLowerCase();
  return [
    // do/does/did/don't/doesn't ... say|mention|cover|state|specify
    /\b(do|does|did|do not|does not|did not|don't|doesn't|didn't)\b[^.]{0,40}\b(say|mention|cover|state|specify|address)/,
    /\b(is|isn't|is not|are|aren't|are not)\b[^.]{0,20}\b(covered|mentioned|specified|addressed)/,
    /\b(can't|cannot|could not|couldn't|unable to)\b[^.]{0,20}\b(find|see|locate)/,
    /\bno (policy|policies|mention|information|guidance|rule)\b/,
    /\b(don't|do not) know\b/,
    /\bnothing\b[^.]{0,30}\b(about|on|regarding)\b/,
    /\bnot (mentioned|covered|specified|addressed|stated)\b/,
  ].some((pattern) => pattern.test(a));
}

/**
 * Last-resort trim, kept as a backstop.
 *
 * Passages come from search_policy_passages already sized for the prompt, so
 * this normally has nothing to do. It stays because the budget is the one
 * thing standing between a long question and a day's quota, and a bug
 * upstream should cost a truncated prompt rather than a dead assistant.
 *
 * Dropping whole documents is preferable to truncating them mid-sentence,
 * which would make quotes fail verification for no visible reason.
 */
export function selectPoliciesForPrompt(
  policies: PolicySource[],
  question: string,
  maxChars = 60_000,
): PolicySource[] {
  const usable = policies.filter((p) => p.content.trim().length > 0);
  const total = usable.reduce((sum, p) => sum + p.content.length, 0);
  if (total <= maxChars) return usable;

  const terms = normalizeForMatch(question)
    .split(/\s+/)
    .filter((t) => t.length > 3);

  const scored = usable
    .map((policy) => {
      const haystack = normalizeForMatch(`${policy.title} ${policy.content}`);
      const score = terms.reduce(
        (sum, term) => sum + (haystack.includes(term) ? 1 : 0),
        0,
      );
      return { policy, score };
    })
    .sort((a, b) => b.score - a.score || a.policy.content.length - b.policy.content.length);

  const chosen: PolicySource[] = [];
  let used = 0;
  for (const { policy } of scored) {
    // The most relevant document always goes in, even if it alone busts the
    // budget: one relevant policy beats none, and a too-small budget should
    // show up as a long prompt rather than as a confidently wrong answer.
    if (chosen.length === 0) {
      chosen.push(policy);
      used = policy.content.length;
      continue;
    }
    // Stop at the first that doesn't fit rather than skipping to a smaller
    // one. Everything after this point is less relevant, so filling the
    // remaining space with it would mean answering from the wrong document.
    if (used + policy.content.length > maxChars) break;
    chosen.push(policy);
    used += policy.content.length;
  }
  return chosen;
}

/**
 * The passages of the policies that bear on a question.
 *
 * This used to be "every policy, in full, every time": 80 documents and
 * about 318,000 tokens a question, which ran the day's quota out in two.
 * The ranking, the window and the weighting all live in
 * search_policy_passages — see 0031 for why each of them is the way it is.
 *
 * Each passage becomes a document in its own right, with an id of
 * `<policy id>#<seq>`. Two passages of one policy must not share an id, or
 * the quote check will look for the first one's words in the second and
 * throw away a perfectly good citation. Nothing downstream reads the id —
 * citations are displayed by title — so the suffix costs nothing.
 */
export async function fetchPolicyPassages(
  question: string,
  rpc: PassageRpc,
): Promise<PolicySource[]> {
  const { data, error } = await rpc(question);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: `${row.policy_id}#${row.seq}`,
    title: row.title,
    content: row.passage,
  }));
}

/** Just the shape this needs from Supabase, so the lib stays testable. */
export type PassageRpc = (question: string) => Promise<{
  data: { policy_id: string; seq: number; title: string; passage: string }[] | null;
  error: { message: string } | null;
}>;
