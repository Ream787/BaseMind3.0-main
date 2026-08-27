/**
 * Pulls readable text out of an uploaded policy.
 *
 * The assistant answers only from this text and quotes are checked against
 * it, so a document that yields nothing readable is useless to it. That's
 * detected here at upload rather than discovered later as a policy that
 * silently never appears in any answer.
 */

export type ExtractedDocument = {
  text: string;
  pageCount: number | null;
};

export class UnreadableDocumentError extends Error {}

const PLAIN_TEXT_TYPES = ["text/plain", "text/markdown", "text/csv"];

export function isSupportedDocument(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    PLAIN_TEXT_TYPES.includes(file.type) ||
    /\.(txt|md)$/i.test(file.name)
  );
}

export async function extractDocumentText(file: File): Promise<ExtractedDocument> {
  if (file.type === "application/pdf") return extractPdfText(file);

  if (PLAIN_TEXT_TYPES.includes(file.type) || /\.(txt|md)$/i.test(file.name)) {
    const text = (await file.text()).trim();
    if (!text) throw new UnreadableDocumentError("That file is empty.");
    return { text, pageCount: null };
  }

  throw new UnreadableDocumentError(
    "Only PDF and plain text files can be read. Save the document as a PDF or paste its text instead.",
  );
}

async function extractPdfText(file: File): Promise<ExtractedDocument> {
  return extractPdfTextFromBytes(await file.arrayBuffer());
}

/**
 * The same extraction, for a PDF that arrived as bytes rather than as a file
 * the user picked - a document downloaded from a link, for instance.
 *
 * Sharing this with the upload path is deliberate: "readable" has to mean
 * exactly one thing, or a document could be accepted by one route and be
 * useless to the assistant anyway.
 */
export async function extractPdfTextFromBytes(
  data: ArrayBuffer,
): Promise<ExtractedDocument> {
  // pdf.js is ~350 kB and only needed when someone adds a document, so it's
  // loaded on demand rather than shipped in the main bundle.
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      // pdf.js emits a lot of incidental spacing; collapsing it here keeps
      // stored text close to what a reader sees, which matters because
      // citations are matched against it.
      .replace(/\s+/g, " ")
      .trim();
    if (text) pages.push(text);
  }

  const text = pages.join("\n\n").trim();

  if (!text) {
    throw new UnreadableDocumentError(
      "No text could be read from that PDF. It's most likely a scan or photograph, " +
        "which stores the pages as images — try a version exported from the original document.",
    );
  }

  return { text, pageCount: doc.numPages };
}
