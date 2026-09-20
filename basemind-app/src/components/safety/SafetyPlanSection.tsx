import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import {
  collectFacts,
  outOfDateFacts,
  renderSafetyPlanText,
  validateNoInvention,
  type SafetyPlanInput,
} from "@/lib/safetyPlan";
import type {
  CampEvent,
  CampingSite,
  NewSafetyPlan,
  NewSafetyScenario,
  SafetyPlan,
  SafetyScenario,
} from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Common scenarios; the leader writes the response for each. */
const SCENARIO_SUGGESTIONS = [
  "Serious injury",
  "Minor injury",
  "Drowning / water incident",
  "Missing person",
  "Fire",
  "Severe weather",
  "Illness",
  "Vehicle breakdown",
];

interface SafetyPlanSectionProps {
  event: CampEvent;
  site: CampingSite | null;
  plan: SafetyPlan | null;
  scenarios: SafetyScenario[];
  canEdit: boolean;
}

export function SafetyPlanSection({
  event,
  site,
  plan,
  scenarios,
  canEdit,
}: SafetyPlanSectionProps) {
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  const [newScenario, setNewScenario] = useState("");
  const [newResponse, setNewResponse] = useState("");

  const input: SafetyPlanInput | null = useMemo(
    () => (plan ? { event, site, plan, scenarios } : null),
    [event, site, plan, scenarios],
  );

  const facts = useMemo(() => (input ? collectFacts(input) : []), [input]);
  const templateText = useMemo(() => (input ? renderSafetyPlanText(input) : ""), [input]);
  const stale = useMemo(
    () => outOfDateFacts(facts, plan?.generated_text ?? null),
    [facts, plan?.generated_text],
  );

  async function createPlan() {
    setCreating(true);
    const { error } = await supabase.from("safety_plans").insert({
      event_id: event.id,
      leader_in_charge: null,
      leader_phone: null,
      standby_name: null,
      standby_phone: null,
      first_aider_name: null,
      first_aider_phone: null,
      emergency_number: null,
      ambulance_number: null,
      extra_notes: null,
      generated_text: null,
      generated_at: null,
      generated_by: null,
    });
    setCreating(false);
    if (error) toast.error(error.message);
  }

  async function updatePlan(patch: Partial<NewSafetyPlan>) {
    if (!plan) return;
    const { error } = await supabase.from("safety_plans").update(patch).eq("id", plan.id);
    if (error) toast.error(error.message);
  }

  async function addScenario() {
    if (!plan || !newScenario.trim() || !newResponse.trim()) return;
    const { error } = await supabase.from("safety_scenarios").insert({
      safety_plan_id: plan.id,
      scenario: newScenario.trim(),
      response: newResponse.trim(),
      destination: null,
      contact_phone: null,
      sort_order: scenarios.length,
    });
    if (error) toast.error(error.message);
    else {
      setNewScenario("");
      setNewResponse("");
    }
  }

  async function updateScenario(id: string, patch: Partial<NewSafetyScenario>) {
    const { error } = await supabase.from("safety_scenarios").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  }

  async function removeScenario(id: string) {
    const { error } = await supabase.from("safety_scenarios").delete().eq("id", id);
    if (error) toast.error(error.message);
  }

  /** Save the deterministic version — no API, no risk, always available. */
  async function useTemplate() {
    setRejection(null);
    await updatePlan({
      generated_text: templateText,
      generated_at: new Date().toISOString(),
      generated_by: "template",
    });
    toast.success("Safety plan written from your data");
  }

  /**
   * Ask Gemini to smooth the same facts into prose. The function checks its
   * output for invented numbers and refuses rather than returning something
   * wrong; either way the template above is still available.
   */
  async function polishWithGemini() {
    if (!plan) return;
    setGenerating(true);
    setRejection(null);
    try {
      const { data, error } = await supabase.functions.invoke("safety-plan", {
        body: { facts },
      });

      if (error) {
        // A 422 is the guard doing its job, not a failure of the app.
        const context = (error as { context?: Response }).context;
        if (context?.status === 422) {
          const body = await context.json().catch(() => null);
          setRejection(
            body?.unknownNumbers?.length
              ? `The generated text mentioned ${body.unknownNumbers.join(", ")}, which isn't in your data, so it was discarded. The plain version below is unaffected.`
              : "The generated text didn't match your data, so it was discarded.",
          );
          return;
        }
        toast.error(error.message);
        return;
      }

      const text: string | undefined = data?.text;
      if (!text) {
        toast.error("Nothing came back from the generator.");
        return;
      }

      // Belt and braces: check again on this side too.
      const check = validateNoInvention(facts, text);
      if (!check.ok) {
        setRejection(
          `The generated text mentioned ${check.unknownNumbers.join(", ")}, which isn't in your data, so it was discarded.`,
        );
        return;
      }

      await updatePlan({
        generated_text: text,
        generated_at: new Date().toISOString(),
        generated_by: "gemini",
      });
      toast.success("Safety plan rewritten — please read it over");
    } finally {
      setGenerating(false);
    }
  }

  if (!plan) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Safety plan</h2>
        <div className="flex h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground">
          <ShieldAlert className="size-5" />
          No safety plan for this camp yet.
          {canEdit && (
            <Button size="sm" onClick={createPlan} disabled={creating}>
              {creating ? "Creating…" : "Start a safety plan"}
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">Safety plan</h2>
        <span className="text-sm text-muted-foreground">
          Everything here comes from what you type. Nothing is looked up or assumed.
        </span>
      </div>

      {!site && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          No site is set for this camp, so there&apos;s no hospital or site address to include.
        </p>
      )}
      {site && !site.hospital_name && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          No hospital recorded for {site.name}. Add one on the site&apos;s page and it will appear
          here and on the printout.
        </p>
      )}

      {/* ---- People ---------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <PlanField label="Leader in charge" value={plan.leader_in_charge} disabled={!canEdit}
          onSave={(v) => updatePlan({ leader_in_charge: v })} />
        <PlanField label="Leader phone" value={plan.leader_phone} disabled={!canEdit} type="tel"
          onSave={(v) => updatePlan({ leader_phone: v })} />
        <PlanField label="First aider" value={plan.first_aider_name} disabled={!canEdit}
          onSave={(v) => updatePlan({ first_aider_name: v })} />
        <PlanField label="First aider phone" value={plan.first_aider_phone} disabled={!canEdit} type="tel"
          onSave={(v) => updatePlan({ first_aider_phone: v })} />
        <PlanField label="On standby (away from camp)" value={plan.standby_name} disabled={!canEdit}
          onSave={(v) => updatePlan({ standby_name: v })} />
        <PlanField label="Standby phone" value={plan.standby_phone} disabled={!canEdit} type="tel"
          onSave={(v) => updatePlan({ standby_phone: v })} />
        <PlanField label="Emergency number" value={plan.emergency_number} disabled={!canEdit} type="tel"
          onSave={(v) => updatePlan({ emergency_number: v })} />
        <PlanField label="Ambulance number" value={plan.ambulance_number} disabled={!canEdit} type="tel"
          onSave={(v) => updatePlan({ ambulance_number: v })} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="safety-notes">Additional notes</Label>
        <Textarea
          id="safety-notes"
          disabled={!canEdit}
          placeholder="Allergies, medication, anything else to carry onto the plan…"
          defaultValue={plan.extra_notes ?? ""}
          onBlur={(e) => updatePlan({ extra_notes: e.target.value.trim() || null })}
        />
      </div>

      {/* ---- Scenarios -------------------------------------------------- */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">What to do if…</h3>
        <p className="text-sm text-muted-foreground">
          Different incidents may need different responses — a drowning and a broken arm might not
          go to the same place.
        </p>

        {scenarios.length > 0 && (
          <div className="flex flex-col gap-2">
            {[...scenarios]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((scenario) => (
                <div key={scenario.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{scenario.scenario}</span>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={`Remove ${scenario.scenario}`}
                        onClick={() => removeScenario(scenario.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  <Textarea
                    className="mt-2"
                    disabled={!canEdit}
                    defaultValue={scenario.response}
                    onBlur={(e) => updateScenario(scenario.id, { response: e.target.value })}
                  />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Go to… (e.g. which hospital)"
                      disabled={!canEdit}
                      defaultValue={scenario.destination ?? ""}
                      onBlur={(e) =>
                        updateScenario(scenario.id, { destination: e.target.value.trim() || null })
                      }
                    />
                    <Input
                      type="tel"
                      placeholder="Phone for this situation"
                      disabled={!canEdit}
                      defaultValue={scenario.contact_phone ?? ""}
                      onBlur={(e) =>
                        updateScenario(scenario.id, {
                          contact_phone: e.target.value.trim() || null,
                        })
                      }
                    />
                  </div>
                </div>
              ))}
          </div>
        )}

        {canEdit && (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
            <Input
              list="scenario-options"
              placeholder="Situation, e.g. Drowning / water incident"
              value={newScenario}
              onChange={(e) => setNewScenario(e.target.value)}
            />
            <datalist id="scenario-options">
              {SCENARIO_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <Textarea
              placeholder="What should happen…"
              value={newResponse}
              onChange={(e) => setNewResponse(e.target.value)}
            />
            <Button
              size="sm"
              className="self-start"
              onClick={addScenario}
              disabled={!newScenario.trim() || !newResponse.trim()}
            >
              <Plus className="size-4" />
              Add situation
            </Button>
          </div>
        )}
      </div>

      {/* ---- Document --------------------------------------------------- */}
      <div className="flex flex-col gap-3 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">The written plan</h3>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={useTemplate}>
                Write from my data
              </Button>
              <Button variant="outline" size="sm" onClick={polishWithGemini} disabled={generating}>
                <Sparkles className="size-4" />
                {generating ? "Rewriting…" : "Rewrite more readably"}
              </Button>
            </div>
          )}
        </div>

        {rejection && (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>{rejection}</span>
          </p>
        )}

        {plan.generated_by === "gemini" && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            This version was rewritten by AI from your data. Its numbers were checked against what
            you entered, but read it over before relying on it.
          </p>
        )}

        {/* A saved plan is a snapshot, and nothing said so. Change the
            leader's number after writing one and the printout — and any
            official form filled from it — kept the old number. */}
        {stale.length > 0 && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              This was written before {listNames(stale.map((fact) => fact.label.toLowerCase()))}{" "}
              changed, so it doesn&apos;t match the details above. Write it again before you print
              it.
            </span>
          </p>
        )}

        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border bg-card p-4 text-sm">
          {plan.generated_text || templateText}
        </pre>

        {!plan.generated_text && (
          <p className="text-xs text-muted-foreground">
            Preview, built straight from the fields above. Save it with one of the buttons to fix
            the wording and include it in the PDF.
          </p>
        )}
      </div>
    </section>
  );
}

/** "the leader phone" · "the leader phone and the first aider". */
function listNames(names: string[]): string {
  const unique = [...new Set(names)];
  if (unique.length === 1) return `the ${unique[0]}`;
  const last = unique[unique.length - 1];
  return `the ${unique.slice(0, -1).join(", the ")} and the ${last}`;
}

/** Text field that saves on blur, so edits aren't lost by navigating away. */
function PlanField({
  label,
  value,
  disabled,
  type = "text",
  onSave,
}: {
  label: string;
  value: string | null;
  disabled: boolean;
  type?: string;
  onSave: (value: string | null) => void;
}) {
  const id = `plan-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => setDraft(value ?? ""), [value]);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        disabled={disabled}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const next = draft.trim() || null;
          if (next !== value) onSave(next);
        }}
      />
    </div>
  );
}
