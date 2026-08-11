import { format, parseISO } from "date-fns";
import type { jsPDF } from "jspdf";

import type { CampEvent, CampingSite, Equipment } from "@/types/database";
import type { FoodPlanLine } from "@/lib/shoppingList";
import { roundQuantity } from "@/lib/shoppingList";

/** jspdf-autotable records where the last table ended on the document. */
type PdfDoc = jsPDF & { lastAutoTable?: { finalY: number } };

export type PackingLine = {
  equipment: Equipment;
  quantity: number;
};

export type CampPlanData = {
  event: CampEvent;
  site: CampingSite | null;
  packing: PackingLine[];
  foodPlan: FoodPlanLine[];
  shopping: FoodPlanLine[];
};

const MARGIN = 14;

export function campPlanFilename(event: CampEvent): string {
  const slug = event.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `camp-plan-${slug || "event"}-${event.start_date}.pdf`;
}

export function formatDateRange(event: CampEvent): string {
  const start = format(parseISO(event.start_date), "EEEE d MMMM yyyy");
  if (!event.end_date || event.end_date === event.start_date) return start;
  return `${start} — ${format(parseISO(event.end_date), "EEEE d MMMM yyyy")}`;
}

/**
 * Builds and downloads the camp plan PDF.
 *
 * jsPDF is imported dynamically: it's a large dependency only needed when
 * someone actually prints, so it shouldn't sit in the initial bundle.
 */
export async function downloadCampPlanPdf(data: CampPlanData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc: PdfDoc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = MARGIN;

  // ---- Title -------------------------------------------------------------
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(data.event.name, MARGIN, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  doc.text(formatDateRange(data.event), MARGIN, y);
  y += 8;
  doc.setTextColor(0);

  // ---- Camping site ------------------------------------------------------
  if (data.site) {
    y = sectionHeading(doc, "Camping site", y);

    const siteRows: [string, string][] = [["Site", data.site.name]];
    if (data.site.phone) siteRows.push(["Phone", data.site.phone]);
    if (data.site.email) siteRows.push(["Email", data.site.email]);
    if (data.site.address) siteRows.push(["Address", data.site.address]);
    if (data.site.description) siteRows.push(["About", data.site.description]);
    if (data.site.notes) siteRows.push(["Notes", data.site.notes]);

    autoTable(doc, {
      startY: y,
      body: siteRows,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 1.5, valign: "top" },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 28 },
        1: { cellWidth: pageWidth - MARGIN * 2 - 28 },
      },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = afterTable(doc);
  }

  // ---- Equipment ---------------------------------------------------------
  y = sectionHeading(doc, "Equipment to pack", y);
  if (data.packing.length === 0) {
    y = emptyNote(doc, "No equipment listed.", y);
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Qty", "Item", "Category", "Stored in", "Condition", "Packed"]],
      body: data.packing.map((line) => [
        String(line.quantity),
        line.equipment.name,
        line.equipment.category ?? "—",
        line.equipment.location,
        line.equipment.condition,
        "", // tick-box column for use on the day
      ]),
      theme: "striped",
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 10 },
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 14 }, 5: { cellWidth: 18 } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = afterTable(doc);
  }

  // ---- Food plan ---------------------------------------------------------
  if (data.foodPlan.length > 0) {
    y = sectionHeading(doc, "Food needed", y);
    autoTable(doc, {
      startY: y,
      head: [["Item", "Needed", "In store", "To buy"]],
      body: data.foodPlan.map((line) => [
        line.name,
        `${roundQuantity(line.needed)} ${line.unit}`,
        `${roundQuantity(line.inStock)} ${line.unit}`,
        line.toBuy > 0 ? `${roundQuantity(line.toBuy)} ${line.unit}` : "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 10 },
      styles: { fontSize: 10, cellPadding: 2 },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = afterTable(doc);
  }

  // ---- Shopping list (own page: it gets taken to the shop) ---------------
  if (data.shopping.length > 0) {
    doc.addPage();
    y = MARGIN;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Shopping list", MARGIN, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90);
    doc.text(`${data.event.name} — only what the food store doesn't cover`, MARGIN, y);
    doc.setTextColor(0);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Buy", "Item", "Category", "Got it"]],
      body: data.shopping.map((line) => [
        `${roundQuantity(line.toBuy)} ${line.unit}`,
        line.name,
        line.category ?? "—",
        "",
      ]),
      theme: "striped",
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 10 },
      styles: { fontSize: 11, cellPadding: 2.5 },
      columnStyles: { 0: { cellWidth: 26 }, 3: { cellWidth: 20 } },
      margin: { left: MARGIN, right: MARGIN },
    });
  }

  addFooters(doc);
  doc.save(campPlanFilename(data.event));
}


function sectionHeading(doc: PdfDoc, text: string, y: number): number {
  const next = ensureSpace(doc, y, 16);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(text, MARGIN, next);
  doc.setFont("helvetica", "normal");
  return next + 4;
}

function emptyNote(doc: PdfDoc, text: string, y: number): number {
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(text, MARGIN, y + 2);
  doc.setTextColor(0);
  return y + 10;
}

function afterTable(doc: PdfDoc): number {
  return (doc.lastAutoTable?.finalY ?? MARGIN) + 10;
}

/** Starts a new page when the next block wouldn't fit. */
function ensureSpace(doc: PdfDoc, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function addFooters(doc: PdfDoc): void {
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const printed = format(new Date(), "d MMM yyyy");

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`BaseMind · printed ${printed}`, MARGIN, pageHeight - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - MARGIN, pageHeight - 8, { align: "right" });
    doc.setTextColor(0);
  }
}
