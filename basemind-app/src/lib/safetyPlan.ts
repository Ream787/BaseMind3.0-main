import type { CampEvent, CampingSite, SafetyPlan, SafetyScenario } from "@/types/database";

export type SafetyPlanInput = {
  event: CampEvent;
  site: CampingSite | null;
  plan: SafetyPlan;
  scenarios: SafetyScenario[];
};

/** A labelled fact. Only these reach the document — nothing is inferred. */
export type Fact = { label: string; value: string };

/**
 * Everything the plan knows, flattened. This is both what the template
 * renders and what any generated prose is checked against, so the two can't
 * drift apart.
 */
export function collectFacts(input: SafetyPlanInput): Fact[] {
  const { event, site, plan, scenarios } = input;
  const facts: Fact[] = [];
  const add = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined) return;
    const text = String(value).trim();
    if (text) facts.push({ label, value: text });
  };

  add("Camp", event.name);
  add("Start date", event.start_date);
  add("End date", event.end_date);
  add("Number of people", event.headcount);

  add("Site", site?.name);
  add("Site address", site?.address);
  add("Site phone", site?.phone);
  add("Emergency vehicle access", site?.emergency_access);
  add("Nearest hospital", site?.hospital_name);
  add("Hospital phone", site?.hospital_phone);
  add("Hospital address", site?.hospital_address);
  add("Distance to hospital", site?.hospital_distance);
  add("Site emergency notes", site?.emergency_notes);

  add("Leader in charge", plan.leader_in_charge);
  add("Leader phone", plan.leader_phone);
  add("On standby", plan.standby_name);
  add("Standby phone", plan.standby_phone);
  add("First aider", plan.first_aider_name);
  add("First aider phone", plan.first_aider_phone);
  add("Emergency number", plan.emergency_number);
  add("Ambulance number", plan.ambulance_number);
  add("Additional notes", plan.extra_notes);

  for (const scenario of [...scenarios].sort((a, b) => a.sort_order - b.sort_order)) {
    add(`Scenario: ${scenario.scenario}`, scenario.response);
    add(`${scenario.scenario} — go to`, scenario.destination);
    add(`${scenario.scenario} — phone`, scenario.contact_phone);
  }

  return facts;
}

/**
 * Renders the plan deterministically from the facts above.
 *
 * This is the default, and the fallback whenever generated prose can't be
 * trusted. It can only ever restate what was entered.
 */
export function renderSafetyPlanText(input: SafetyPlanInput): string {
  const { event, site, plan, scenarios } = input;
  const lines: string[] = [];
  const para = (text: string) => lines.push(text, "");

  lines.push(`SAFETY PLAN — ${event.name}`, "");

  // --- Where and when ---
  const when = event.end_date && event.end_date !== event.start_date
    ? `from ${event.start_date} to ${event.end_date}`
    : `on ${event.start_date}`;
  const who = event.headcount ? ` with ${event.headcount} people attending` : "";
  const where = site ? ` at ${site.name}` : "";
  para(`This camp runs ${when}${where}${who}.`);

  if (site?.address) para(`The site address is ${site.address}.`);
  if (site?.phone) para(`The site can be reached on ${site.phone}.`);
  if (site?.emergency_access) {
    para(`Emergency vehicle access: ${site.emergency_access}`);
  }

  // --- Who is responsible ---
  const people: string[] = [];
  if (plan.leader_in_charge) {
    people.push(
      plan.leader_phone
        ? `${plan.leader_in_charge} is the leader in charge and can be reached on ${plan.leader_phone}.`
        : `${plan.leader_in_charge} is the leader in charge.`,
    );
  }
  if (plan.first_aider_name) {
    people.push(
      plan.first_aider_phone
        ? `${plan.first_aider_name} is the appointed first aider, on ${plan.first_aider_phone}.`
        : `${plan.first_aider_name} is the appointed first aider.`,
    );
  }
  if (plan.standby_name) {
    people.push(
      plan.standby_phone
        ? `${plan.standby_name} is on standby away from camp, on ${plan.standby_phone}.`
        : `${plan.standby_name} is on standby away from camp.`,
    );
  }
  if (people.length > 0) {
    lines.push("WHO IS RESPONSIBLE", "");
    para(people.join(" "));
  }

  // --- Emergency numbers ---
  const numbers: string[] = [];
  if (plan.emergency_number) numbers.push(`the emergency number is ${plan.emergency_number}`);
  if (plan.ambulance_number) numbers.push(`the ambulance number is ${plan.ambulance_number}`);
  if (numbers.length > 0) {
    lines.push("EMERGENCY NUMBERS", "");
    para(`In an emergency, ${numbers.join(", and ")}.`);
  }

  // --- Hospital ---
  if (site?.hospital_name) {
    lines.push("NEAREST HOSPITAL", "");
    const parts = [`The nearest hospital is ${site.hospital_name}`];
    if (site.hospital_address) parts.push(`at ${site.hospital_address}`);
    if (site.hospital_distance) parts.push(`(${site.hospital_distance})`);
    para(`${parts.join(" ")}.`);
    if (site.hospital_phone) para(`The hospital can be reached on ${site.hospital_phone}.`);
  }

  // --- Scenarios ---
  const sorted = [...scenarios].sort((a, b) => a.sort_order - b.sort_order);
  if (sorted.length > 0) {
    lines.push("WHAT TO DO", "");
    for (const scenario of sorted) {
      const bits = [`${scenario.scenario}: ${scenario.response}`];
      if (scenario.destination) bits.push(`Go to ${scenario.destination}.`);
      if (scenario.contact_phone) bits.push(`Phone ${scenario.contact_phone}.`);
      para(bits.join(" "));
    }
  }

  if (site?.emergency_notes) {
    lines.push("SITE NOTES", "");
    para(site.emergency_notes);
  }
  if (plan.extra_notes) {
    lines.push("ADDITIONAL NOTES", "");
    para(plan.extra_notes);
  }

  return lines.join("\n").trim();
}

/** Digits-only forms of every number in the text, ignoring lone digits. */
export function numericTokens(text: string): string[] {
  const matches = text.match(/\d[\d\s\-().+/]*\d|\d/g) ?? [];
  return matches
    .map((token) => token.replace(/\D/g, ""))
    .filter((digits) => digits.length >= 2);
}

/**
 * Every form a source number might legitimately be rewritten as: the whole
 * run of digits, and each separated group within it.
 *
 * "082 555 0121" yields 0825550121, 082, 555, 0121, so a rewrite that spaces
 * the number differently still matches. "2026-09-12" yields 20260912, 2026,
 * 09, 12, so writing the date out longhand is fine.
 *
 * Matching is against these whole components, never substrings — "25" occurs
 * inside 0825550121 by coincidence, and treating that as a match would let
 * almost any two-digit invention through.
 */
function expandNumber(token: string): string[] {
  const joined = token.replace(/\D/g, "");
  const groups = token.match(/\d+/g) ?? [];
  return [joined, ...groups].filter((digits) => digits.length >= 2);
}

export type ValidationResult = {
  ok: boolean;
  /** Numbers in the generated text that appear nowhere in the source data. */
  unknownNumbers: string[];
};

/**
 * Checks generated prose invented no numbers.
 *
 * A safety document's numbers are the part that gets acted on at 2am — a
 * hallucinated phone number or headcount is the failure mode that matters, so
 * every number in the output has to trace back to something entered. Dates,
 * phone numbers and counts all normalise to digit strings, which makes
 * "082 555 0121" and "0825550121" compare equal.
 *
 * Prose is not checked word-for-word: rephrasing is the whole point. Numbers
 * are checked absolutely.
 */
export function validateNoInvention(facts: Fact[], generated: string): ValidationResult {
  const allowed = new Set(
    facts.flatMap((fact) => (fact.value.match(/\d[\d\s\-().+/]*\d|\d/g) ?? []).flatMap(expandNumber)),
  );

  const unknown = numericTokens(generated).filter((token) => !allowed.has(token));

  return {
    ok: unknown.length === 0,
    unknownNumbers: [...new Set(unknown)],
  };
}

/**
 * The facts a saved plan has to still contain to be worth printing.
 *
 * Names and numbers only. Prose is left out on purpose: the whole point of
 * "rewrite more readably" is that the wording changes, so checking a note
 * word for word would report every rewritten plan as out of date. Dates and
 * headcounts are left out for the same reason — a model may write "6
 * December 2026" for 2026-12-06, and nobody rings a date.
 */
const CHECKED_LABELS = new Set([
  "Site",
  "Site phone",
  "Nearest hospital",
  "Hospital phone",
  "Hospital address",
  "Distance to hospital",
  "Leader in charge",
  "Leader phone",
  "On standby",
  "Standby phone",
  "First aider",
  "First aider phone",
  "Emergency number",
  "Ambulance number",
]);

/** Whitespace and case don't count; digits and letters do. */
function loosely(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Which of today's facts the saved text no longer mentions.
 *
 * A written plan is a snapshot. Change the leader's phone number after
 * writing one and the plan keeps the old number, with nothing on screen to
 * say so — and that saved text is what goes onto the printout and into
 * filled-in forms. Empty means the plan still matches.
 */
export function outOfDateFacts(facts: Fact[], saved: string | null): Fact[] {
  if (!saved?.trim()) return [];
  const hay = loosely(saved);
  return facts.filter(
    (fact) => CHECKED_LABELS.has(fact.label) && !hay.includes(loosely(fact.value)),
  );
}

/** The instruction sent to the model. Deliberately narrow. */
export function buildPrompt(facts: Fact[]): string {
  const factLines = facts.map((f) => `- ${f.label}: ${f.value}`).join("\n");
  return [
    "Rewrite the following camp safety information as clear, readable paragraphs",
    "for a Scout leader to print and carry.",
    "",
    "STRICT RULES:",
    "- Use ONLY the facts listed below. Do not add anything not listed.",
    "- Never invent or guess a phone number, address, hospital, name, date or quantity.",
    "- Every number you write must appear exactly as given in the facts.",
    "- If something is not listed, simply leave it out. Do not write a placeholder.",
    "- Do not offer medical, legal or procedural advice of your own.",
    "- Use headings and short paragraphs. Plain text only, no markdown.",
    "",
    "FACTS:",
    factLines,
  ].join("\n");
}
