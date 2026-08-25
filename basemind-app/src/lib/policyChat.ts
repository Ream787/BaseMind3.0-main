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

  return {
    answer,
    citations,
    rejected,
    // An answer that says it found nothing is fine unsupported; one that
    // asserts something without a usable citation is not.
    unsupported: answer.length > 0 && citations.length === 0 && !saysItDoesNotKnow(answer),
  };
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
 * Keeps the prompt within budget by dropping the least relevant policies.
 *
 * Everything is sent by default — a group's policies are small next to the
 * model's context. This only matters if that stops being true, and dropping
 * whole documents is preferable to truncating them mid-sentence, which would
 * make quotes fail verification for no visible reason.
 */
export function selectPoliciesForPrompt(
  policies: PolicySource[],
  question: string,
  maxChars = 400_000,
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
