import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { availableQuantity } from "@/lib/loans";
import { menuScale } from "@/lib/menus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none";

const STEPS = ["Camp", "Site", "Menu", "Equipment", "Review"] as const;
type Step = (typeof STEPS)[number];

export function CampWizardPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const { rows: sites } = useRealtimeTable("camping_sites", { orderBy: "name" });
  const { rows: menus } = useRealtimeTable("menus", { orderBy: "name" });
  const { rows: equipment } = useRealtimeTable("equipment", { orderBy: "name" });
  const { rows: loans } = useRealtimeTable("equipment_loans");

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [siteId, setSiteId] = useState(NONE);
  const [menuId, setMenuId] = useState(NONE);
  const [picked, setPicked] = useState<Record<string, number>>({});

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  if (!canEdit) return <Navigate to="/events" replace />;

  const presets = useMemo(() => menus.filter((m) => m.event_id === null), [menus]);
  const site = sites.find((s) => s.id === siteId) ?? null;
  const menu = presets.find((m) => m.id === menuId) ?? null;
  const people = Number(headcount) || null;

  const scale = menu ? menuScale(menu, people) : 1;

  const dateError =
    endDate && startDate && endDate < startDate ? "The end date is before the start date." : null;

  const canAdvance: Record<Step, boolean> = {
    Camp: name.trim().length > 0 && !!startDate && !dateError,
    Site: true,
    Menu: true,
    Equipment: true,
    Review: true,
  };

  const current = STEPS[step];

  function toggleItem(id: string, on: boolean) {
    setPicked((prev) => {
      const next = { ...prev };
      if (on) next[id] = next[id] ?? 1;
      else delete next[id];
      return next;
    });
  }

  async function createCamp() {
    setSaving(true);
    try {
      const { data: created, error } = await supabase
        .from("events")
        .insert({
          name: name.trim(),
          start_date: startDate,
          end_date: endDate || null,
          site_id: siteId === NONE ? null : siteId,
          notes: notes.trim() || null,
          headcount: people,
        })
        .select()
        .single();

      if (error || !created) {
        toast.error(error?.message ?? "Couldn't create the camp.");
        return;
      }

      // Each of these can fail independently; the camp itself already exists,
      // so report what didn't attach rather than pretending it all worked.
      const problems: string[] = [];

      if (menuId !== NONE) {
        const { error: menuError } = await supabase.rpc("apply_menu_preset", {
          preset_id: menuId,
          target_event_id: created.id,
          target_headcount: people,
        });
        if (menuError) problems.push(`menu (${menuError.message})`);
      }

      const equipmentRows = Object.entries(picked).map(([equipment_id, quantity]) => ({
        event_id: created.id,
        equipment_id,
        quantity,
      }));
      if (equipmentRows.length > 0) {
        const { error: eqError } = await supabase.from("event_equipment").insert(equipmentRows);
        if (eqError) problems.push(`equipment (${eqError.message})`);
      }

      const { error: safetyError } = await supabase.from("safety_plans").insert({
        event_id: created.id,
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
      if (safetyError) problems.push("safety plan");

      if (problems.length > 0) {
        toast.warning(`Camp created, but couldn't attach: ${problems.join(", ")}`);
      } else {
        toast.success(`${created.name} is ready`);
      }
      navigate(`/events/${created.id}`, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          to="/events"
          className="mb-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Calendar
        </Link>
        <h1>New camp</h1>
      </div>

      {/* Step indicator */}
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {STEPS.map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex size-6 items-center justify-center rounded-full text-xs ${
                index < step
                  ? "bg-primary text-primary-foreground"
                  : index === step
                    ? "bg-primary/15 font-medium text-primary ring-2 ring-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {index < step ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span className={index === step ? "font-medium" : "text-muted-foreground"}>
              {label}
            </span>
            {index < STEPS.length - 1 && <span className="text-muted-foreground">›</span>}
          </li>
        ))}
      </ol>

      {/* p-6 and a minimum height from sm up. On a tablet the phone's 16px
          padding reads as cramped against a 720px-wide card, and the card
          jumping between ~130px on Site and ~450px on Equipment made the Back
          and Next buttons move under your thumb between steps. */}
      <div className="rounded-lg border bg-card p-4 sm:min-h-[22rem] sm:p-6">
        {current === "Camp" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="w-name">Camp name</Label>
              <Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="w-start">Start date</Label>
                <Input
                  id="w-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="w-end">End date</Label>
                <Input
                  id="w-end"
                  type="date"
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="w-people">People going</Label>
                <Input
                  id="w-people"
                  type="number"
                  min={1}
                  placeholder="e.g. 18"
                  value={headcount}
                  onChange={(e) => setHeadcount(e.target.value)}
                />
              </div>
            </div>
            {dateError && <p className="text-sm text-destructive">{dateError}</p>}
            <div className="flex flex-col gap-2">
              <Label htmlFor="w-notes">Notes</Label>
              <Textarea id="w-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        )}

        {current === "Site" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Camping site</Label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a site…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Decide later</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {site && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                {site.address && <p>{site.address}</p>}
                {site.phone && <p className="text-muted-foreground">Site: {site.phone}</p>}
                {site.hospital_name ? (
                  <p className="text-muted-foreground">
                    Nearest hospital: {site.hospital_name}
                    {site.hospital_phone ? ` — ${site.hospital_phone}` : ""}
                    {site.hospital_distance ? ` (${site.hospital_distance})` : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-amber-700 dark:text-amber-400">
                    No hospital recorded for this site. Worth adding before the camp.
                  </p>
                )}
              </div>
            )}
            {sites.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No sites yet — you can{" "}
                <Link to="/sites" className="text-primary underline">
                  add one
                </Link>{" "}
                and come back, or carry on without.
              </p>
            )}
          </div>
        )}

        {current === "Menu" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Menu</Label>
              <Select value={menuId} onValueChange={setMenuId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a menu…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No menu for now</SelectItem>
                  {presets.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} — {m.day_count}d, feeds {m.serves}
                      {m.category ? ` · ${m.category}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {menu && (
              <p className="text-sm text-muted-foreground">
                {!people
                  ? "No headcount set, so quantities will be copied exactly as written."
                  : scale === 1
                    ? `Quantities stay as written — ${people} people, same as the menu.`
                    : `Quantities will be scaled ×${scale.toFixed(2)} for ${people} people.`}
              </p>
            )}
            {presets.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No saved menus yet. You can build one on the camp page afterwards.
              </p>
            )}
          </div>
        )}

        {current === "Equipment" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Tick what you&apos;re taking. Anything fully out on loan is greyed out.
            </p>
            {/* 384px is right on a phone but wastes a tablet, where it left a
                short box floating above 400px of empty page. Capped against the
                viewport from sm up so it grows into the space without ever
                pushing Next below the fold. */}
            <div className="max-h-96 overflow-y-auto rounded-lg border sm:max-h-[min(34rem,55vh)]">
              {equipment.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No equipment in the inventory.</p>
              ) : (
                equipment.map((item) => {
                  const free = availableQuantity(item, loans);
                  const checked = item.id in picked;
                  return (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 border-b p-2.5 last:border-b-0 hover:bg-accent/40"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={free === 0}
                        onCheckedChange={(v) => toggleItem(item.id, v === true)}
                      />
                      <span className={`flex-1 text-sm ${free === 0 ? "text-muted-foreground" : ""}`}>
                        {item.name}
                        <span className="text-muted-foreground"> · {item.location}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{free} free</span>
                      {checked && (
                        <Input
                          type="number"
                          min={1}
                          max={free}
                          className="h-7 w-16"
                          aria-label={`Quantity of ${item.name}`}
                          value={picked[item.id]}
                          onClick={(e) => e.preventDefault()}
                          onChange={(e) =>
                            setPicked((prev) => ({
                              ...prev,
                              [item.id]: Math.max(1, Math.min(free, Number(e.target.value) || 1)),
                            }))
                          }
                        />
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}

        {current === "Review" && (
          <dl className="flex flex-col gap-3 text-sm">
            <Row label="Camp" value={name || "—"} />
            <Row
              label="Dates"
              value={endDate && endDate !== startDate ? `${startDate} → ${endDate}` : startDate || "—"}
            />
            <Row label="People" value={people ? String(people) : "not set"} />
            <Row label="Site" value={site?.name ?? "none"} />
            <Row
              label="Menu"
              value={menu ? `${menu.name}${scale !== 1 ? ` (scaled ×${scale.toFixed(2)})` : ""}` : "none"}
            />
            <Row
              label="Equipment"
              value={
                Object.keys(picked).length === 0
                  ? "none"
                  : `${Object.keys(picked).length} items`
              }
            />
            <div className="mt-2 rounded-lg border bg-muted/30 p-3 text-muted-foreground">
              An empty safety plan is created too, ready to fill in on the camp page.
            </div>
          </dl>
        )}
      </div>

      {/* Split apart on a phone, together on the right from sm up. Spread
          across a tablet they sat 593px apart — one at each edge of the card —
          which is a hand's travel between the step you just did and the one
          you want next. */}
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || saving}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance[current]}
          >
            Next
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button onClick={createCamp} disabled={saving || !canAdvance.Camp}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {saving ? "Creating…" : "Create camp"}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * One line of the review summary.
 *
 * Label and value sit at opposite ends on a phone, where the row is narrow
 * enough to read as a pair. On a tablet that same rule opened 513px of blank
 * space between them and left the eye to jump the gap, so from sm up the label
 * takes a fixed column and the value starts right beside it.
 */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b pb-2 last:border-b-0 sm:grid sm:grid-cols-[10rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium sm:text-left">{value}</dd>
    </div>
  );
}
