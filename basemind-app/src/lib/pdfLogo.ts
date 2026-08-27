import type { jsPDF } from "jspdf";

/** Height of the footer mark in mm — sized to sit level with 8pt footer text. */
export const FOOTER_LOGO_SIZE = 4;

/**
 * Draws the BaseMind mark into a PDF as vectors.
 *
 * The same shapes as public/favicon.svg, mapped from its 100-unit viewBox onto
 * `size` millimetres. Drawn rather than embedded as an image so it stays sharp
 * at any zoom and print resolution, and costs the file nothing — a raster of
 * this at print DPI would be several kB per page.
 *
 * If you redraw the mark, redraw it here too: this is the one copy that isn't
 * the SVG. See [[src/components/ui/logo.tsx]] for the on-screen one.
 */
export function drawLogo(doc: jsPDF, x: number, y: number, size: number): void {
  /** favicon viewBox units -> mm */
  const u = (n: number) => (n / 100) * size;

  doc.setFillColor(124, 58, 237);
  doc.roundedRect(x, y, size, size, u(24), u(24), "F");

  doc.setFillColor(255, 255, 255);
  doc.triangle(
    x + u(50), y + u(22),
    x + u(82), y + u(70),
    x + u(18), y + u(70),
    "F",
  );

  doc.setFillColor(124, 58, 237);
  doc.triangle(
    x + u(50), y + u(44),
    x + u(64), y + u(70),
    x + u(36), y + u(70),
    "F",
  );

  // In the SVG this bar is white at 50% over the tile. PDF fills don't blend
  // for free, so use the colour that combination already resolves to.
  doc.setFillColor(190, 157, 246);
  doc.roundedRect(x + u(14), y + u(76), u(72), u(8), u(4), u(4), "F");
}

/**
 * Places the mark at the left of a page footer, level with the footer text.
 *
 * Returns the x the caller should start its text at, so the two stay spaced
 * consistently across both PDFs.
 */
export function drawFooterLogo(doc: jsPDF, x: number, baselineY: number): number {
  // Helvetica at 8pt has a cap height of ~2.0mm, so the text band runs from
  // the baseline to 2.0mm above it and centres 1.0mm up. Dropping the mark by
  // that much puts the two on the same optical line — measured off the
  // generated content stream, not guessed.
  drawLogo(doc, x, baselineY - FOOTER_LOGO_SIZE + 1.0, FOOTER_LOGO_SIZE);
  return x + FOOTER_LOGO_SIZE + 2;
}
