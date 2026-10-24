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

  doc.setFillColor(24, 24, 27);
  doc.roundedRect(x, y, size, size, u(24), u(24), "F");

  // The same six points as the SVG's polygon, as deltas from the peak.
  // Filled rather than stroked: a stroke would make this copy depend on
  // jsPDF and the browser agreeing about joins and caps as well as
  // coordinates, and they do not have to.
  doc.setFillColor(255, 255, 255);
  doc.lines(
    [
      [u(-33), u(49)], // peak down to the left foot
      [u(19), u(0)], //  flat along the ground
      [u(14), u(-27)], // up the inside of the left leg
      [u(14), u(27)], //  down the inside of the right leg
      [u(19), u(0)], //  flat along the ground
    ],
    x + u(50),
    y + u(21),
    [1, 1],
    "F",
    true,
  );

  doc.setFillColor(184, 161, 255);
  doc.roundedRect(x + u(14), y + u(76.5), u(72), u(7.5), u(3.75), u(3.75), "F");
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
