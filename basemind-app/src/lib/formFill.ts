import { format, parseISO } from "date-fns";

import type {
  CampEvent,
  CampingSite,
  SafetyPlan,
  SafetyScenario,
} from "@/types/database";
import { renderSafetyPlanText } from "@/lib/safetyPlan";

/**
 * The values a form field can be mapped to.
 *
 * Keys are stable strings stored in the database, so renaming one here would
 * orphan existing mappings — add new keys rather than changing old ones.
 */
export type FormDataSource = {
  event: CampEvent;
  site: CampingSite | null;
  plan: SafetyPlan | null;
  scenarios: SafetyScenario[];
  equipmentCount: number;
};

export type FieldOption = { key: string; label: string; group: string };

export const FIELD_OPTIONS: FieldOption[] = [
  { key: "event.name", label: "Camp name", group: "Camp" },
  { key: "event.start_date", label: "Start date", group: "Camp" },
  { key: "event.end_date", label: "End date", group: "Camp" },
  { key: "event.date_range", label: "Dates (both)", group: "Camp" },
  { key: "event.headcount", label: "Number of people", group: "Camp" },
  { key: "event.notes", label: "Camp notes", group: "Camp" },
  { key: "event.equipment_count", label: "Number of equipment items", group: "Camp" },

  { key: "site.name", label: "Site name", group: "Site" },
  { key: "site.address", label: "Site address", group: "Site" },
  { key: "site.phone", label: "Site phone", group: "Site" },
  { key: "site.email", label: "Site email", group: "Site" },
  { key: "site.emergency_access", label: "Emergency vehicle access", group: "Site" },

  { key: "hospital.name", label: "Hospital name", group: "Hospital" },
  { key: "hospital.phone", label: "Hospital phone", group: "Hospital" },
  { key: "hospital.address", label: "Hospital address", group: "Hospital" },
  { key: "hospital.distance", label: "Distance to hospital", group: "Hospital" },

  { key: "safety.leader_in_charge", label: "Leader in charge", group: "Safety" },
  { key: "safety.leader_phone", label: "Leader phone", group: "Safety" },
  { key: "safety.standby_name", label: "Standby name", group: "Safety" },
  { key: "safety.standby_phone", label: "Standby phone", group: "Safety" },
  { key: "safety.first_aider_name", label: "First aider", group: "Safety" },
  { key: "safety.first_aider_phone", label: "First aider phone", group: "Safety" },
  { key: "safety.emergency_number", label: "Emergency number", group: "Safety" },
  { key: "safety.ambulance_number", label: "Ambulance number", group: "Safety" },
  { key: "safety.extra_notes", label: "Safety notes", group: "Safety" },
  { key: "safety.full_text", label: "Whole safety plan (long)", group: "Safety" },

  { key: "today", label: "Today's date", group: "Other" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "d MMMM yyyy");
  } catch {
    return iso;
  }
}

/**
 * Resolves a mapping key to text for the PDF.
 *
 * Unknown keys and absent data both yield an empty string: leaving a box blank
 * is safer on an official form than writing a guess or a placeholder.
 */
export function resolveField(key: string, source: FormDataSource): string {
  const { event, site, plan, scenarios } = source;

  switch (key) {
    case "event.name": return event.name;
    case "event.start_date": return formatDate(event.start_date);
    case "event.end_date": return formatDate(event.end_date);
    case "event.date_range":
      return event.end_date && event.end_date !== event.start_date
        ? `${formatDate(event.start_date)} to ${formatDate(event.end_date)}`
        : formatDate(event.start_date);
    case "event.headcount": return event.headcount ? String(event.headcount) : "";
    case "event.notes": return event.notes ?? "";
    case "event.equipment_count": return String(source.equipmentCount);

    case "site.name": return site?.name ?? "";
    case "site.address": return site?.address ?? "";
    case "site.phone": return site?.phone ?? "";
    case "site.email": return site?.email ?? "";
    case "site.emergency_access": return site?.emergency_access ?? "";

    case "hospital.name": return site?.hospital_name ?? "";
    case "hospital.phone": return site?.hospital_phone ?? "";
    case "hospital.address": return site?.hospital_address ?? "";
    case "hospital.distance": return site?.hospital_distance ?? "";

    case "safety.leader_in_charge": return plan?.leader_in_charge ?? "";
    case "safety.leader_phone": return plan?.leader_phone ?? "";
    case "safety.standby_name": return plan?.standby_name ?? "";
    case "safety.standby_phone": return plan?.standby_phone ?? "";
    case "safety.first_aider_name": return plan?.first_aider_name ?? "";
    case "safety.first_aider_phone": return plan?.first_aider_phone ?? "";
    case "safety.emergency_number": return plan?.emergency_number ?? "";
    case "safety.ambulance_number": return plan?.ambulance_number ?? "";
    case "safety.extra_notes": return plan?.extra_notes ?? "";
    case "safety.full_text":
      if (!plan) return "";
      return plan.generated_text ?? renderSafetyPlanText({ event, site, plan, scenarios });

    case "today": return format(new Date(), "d MMMM yyyy");

    default: return "";
  }
}

export type PdfFieldInfo = { name: string; type: string };

/** Reads the fillable field names out of a PDF. */
export async function readPdfFields(bytes: ArrayBuffer): Promise<PdfFieldInfo[]> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc
    .getForm()
    .getFields()
    .map((field) => ({ name: field.getName(), type: field.constructor.name }));
}

export type FillResult = {
  bytes: Uint8Array;
  /** Fields that were mapped and written. */
  filled: string[];
  /** Mapped fields the PDF turned out not to have. */
  missing: string[];
  /** Fields left alone because nothing was mapped to them. */
  untouched: string[];
};

/**
 * Fills a copy of the PDF. The stored original is never modified.
 *
 * Only text fields and checkboxes are handled; anything else is reported as
 * untouched rather than guessed at.
 */
export async function fillPdfForm(
  bytes: ArrayBuffer,
  fieldMap: Record<string, string>,
  source: FormDataSource,
): Promise<FillResult> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();

  const present = new Set(form.getFields().map((f) => f.getName()));
  const filled: string[] = [];
  const missing: string[] = [];

  for (const [pdfField, dataKey] of Object.entries(fieldMap)) {
    if (!dataKey) continue;
    if (!present.has(pdfField)) {
      missing.push(pdfField);
      continue;
    }
    const value = resolveField(dataKey, source);
    try {
      form.getTextField(pdfField).setText(value);
      filled.push(pdfField);
    } catch {
      // Not a text field — try a checkbox, otherwise leave it be.
      try {
        const box = form.getCheckBox(pdfField);
        if (value && value.toLowerCase() !== "false" && value !== "0") box.check();
        else box.uncheck();
        filled.push(pdfField);
      } catch {
        missing.push(pdfField);
      }
    }
  }

  const untouched = [...present].filter((name) => !filled.includes(name));

  return { bytes: await doc.save(), filled, missing, untouched };
}

export function downloadBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
