import type { jsPDF } from "jspdf";

import type { FoodItem, Menu, MenuMeal, MenuMealItem } from "@/types/database";
import { aggregateMenuRequirements, mealsByDay } from "@/lib/menus";
import { roundQuantity } from "@/lib/shoppingList";
import { drawFooterLogo } from "@/lib/pdfLogo";

type PdfDoc = jsPDF & { lastAutoTable?: { finalY: number } };

const MARGIN = 14;

export type MenuPdfData = {
  menu: Menu;
  meals: MenuMeal[];
  items: MenuMealItem[];
  food: FoodItem[];
  /** Shown when printing a camp's own menu rather than a library preset. */
  eventName?: string | null;
};

export function menuPdfFilename(menu: Menu): string {
  const slug = menu.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `menu-${slug || "menu"}.pdf`;
}

/**
 * Prints a menu: the meals day by day, then one combined ingredient list.
 *
 * The shopping total is worth having on the same sheet — a cook planning from
 * the meals still needs to know it's five loaves in total across the weekend,
 * not two here and three there.
 *
 * jsPDF is imported dynamically so its weight only loads when someone prints.
 */
export async function downloadMenuPdf(data: MenuPdfData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc: PdfDoc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(data.menu.name, MARGIN, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  const summary = [
    `${data.menu.day_count} ${data.menu.day_count === 1 ? "day" : "days"}`,
    `feeds ${data.menu.serves}`,
    data.menu.category,
  ]
    .filter(Boolean)
    .join(" · ");
  doc.text(summary, MARGIN, y);
  y += 5;
  if (data.eventName) {
    doc.text(`For ${data.eventName}`, MARGIN, y);
    y += 5;
  }
  doc.setTextColor(0);
  y += 4;

  if (data.menu.description) {
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(
      data.menu.description,
      doc.internal.pageSize.getWidth() - MARGIN * 2,
    );
    doc.text(lines, MARGIN, y);
    y += lines.length * 5 + 4;
  }

  // ---- Meals, day by day -------------------------------------------------
  const days = mealsByDay(data.meals);
  const foodById = new Map(data.food.map((f) => [f.id, f]));

  if (days.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("No meals planned.", MARGIN, y);
    doc.setTextColor(0);
  }

  for (const { day, meals } of days) {
    y = ensureSpace(doc, y, 24);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`Day ${day}`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Meal", "What's cooking", "Ingredients"]],
      body: meals.map((meal) => {
        const ingredients = data.items
          .filter((item) => item.meal_id === meal.id)
          .map((item) => {
            const f = foodById.get(item.food_item_id);
            return f ? `${f.name} — ${roundQuantity(item.quantity)} ${f.unit}` : null;
          })
          .filter(Boolean)
          .join("\n");
        return [
          meal.meal_slot,
          meal.notes ? `${meal.name}\n(${meal.notes})` : meal.name,
          ingredients || "—",
        ];
      }),
      theme: "striped",
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 10 },
      styles: { fontSize: 10, cellPadding: 2, valign: "top" },
      columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 58 } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 8;
  }

  // ---- Everything needed, totalled --------------------------------------
  const totals = aggregateMenuRequirements(data.meals, data.items);
  if (totals.length > 0) {
    y = ensureSpace(doc, y, 30);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Everything needed", MARGIN, y);
    doc.setFont("helvetica", "normal");
    y += 2;
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Totalled across all meals, for ${data.menu.serves} people.`, MARGIN, y + 3);
    doc.setTextColor(0);
    y += 7;

    autoTable(doc, {
      startY: y,
      head: [["Ingredient", "Total", "Got it"]],
      body: totals
        .map((line) => {
          const f = foodById.get(line.food_item_id);
          return f ? [f.name, `${roundQuantity(line.quantity)} ${f.unit}`, ""] : null;
        })
        .filter((row): row is string[] => row !== null)
        .sort((a, b) => a[0].localeCompare(b[0])),
      theme: "striped",
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 10 },
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 1: { cellWidth: 30 }, 2: { cellWidth: 20 } },
      margin: { left: MARGIN, right: MARGIN },
    });
  }

  addFooters(doc);
  doc.save(menuPdfFilename(data.menu));
}

function ensureSpace(doc: PdfDoc, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function addFooters(doc: PdfDoc): void {
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    drawFooterLogo(doc, MARGIN, pageHeight - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - MARGIN, pageHeight - 8, { align: "right" });
    doc.setTextColor(0);
  }
}
