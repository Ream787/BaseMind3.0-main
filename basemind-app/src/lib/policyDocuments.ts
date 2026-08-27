/**
 * Adding a policy document, however it arrived.
 *
 * Uploading a file, pasting a link and re-checking a link all end up here, so
 * there is one definition of what happens when a document with a name you
 * already have turns up: it replaces the old one in place, keeping the same
 * row. Two copies of "Safety Policy" would mean the assistant quoting
 * whichever it read first, and an edit to one silently not applying.
 */
import { supabase } from "@/lib/supabase/client";
import { extractDocumentText, extractPdfTextFromBytes } from "@/lib/documentText";
import type { Policy } from "@/types/database";

export type SaveResult = {
  title: string;
  replaced: boolean;
  characters: number;
  pageCount: number | null;
};

/** The document name we'd give this file, with the extension taken off. */
export function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.(pdf|txt|md)$/i, "").replace(/[_-]+/g, " ").trim() || fileName;
}

/** An existing document with this name, ignoring case and stray spacing. */
export function findByTitle(policies: Policy[], title: string): Policy | undefined {
  const wanted = title.replace(/\s+/g, " ").trim().toLowerCase();
  return policies.find((p) => p.title.replace(/\s+/g, " ").trim().toLowerCase() === wanted);
}

/**
 * Downloads a PDF through the Edge Function.
 *
 * Not fetched directly from the browser: almost nothing serves a PDF with
 * headers that allow a cross-origin read, so this would fail on most links
 * that a person can open perfectly well in a tab.
 */
export async function downloadPolicyPdf(url: string): Promise<File> {
  const { data, error } = await supabase.functions.invoke("fetch-policy-pdf", {
    body: { url },
  });

  if (error) {
    const context = (error as { context?: Response }).context;
    const body = await context?.json().catch(() => null);
    const parts = [body?.error, body?.detail].filter(Boolean);
    throw new Error(parts.length > 0 ? parts.join(" — ") : error.message);
  }
  if (!data?.base64) throw new Error("The download came back empty.");

  const binary = atob(data.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return new File([bytes], data.fileName ?? "policy.pdf", { type: "application/pdf" });
}

/**
 * Reads a document, stores it, and adds or replaces the policy row.
 *
 * The text is extracted first, on purpose: a PDF with nothing readable in it
 * is useless to the assistant, and refusing it here beats storing it and
 * leaving someone to wonder why it never turns up in an answer.
 */
export async function savePolicyDocument({
  file,
  bytes,
  title,
  sourceUrl,
  existing,
  userId,
}: {
  file: File;
  /** Already-decoded bytes, when the caller has them (a download). */
  bytes?: ArrayBuffer;
  title: string;
  sourceUrl?: string | null;
  existing?: Policy;
  userId: string | null;
}): Promise<SaveResult> {
  const isPdf = file.type === "application/pdf";
  const extracted =
    isPdf && bytes ? await extractPdfTextFromBytes(bytes) : await extractDocumentText(file);

  let storagePath: string | null = null;
  if (isPdf) {
    // A fresh path rather than overwriting the old object: if the database
    // write below fails, the document people can already open is untouched.
    storagePath = `${crypto.randomUUID()}.pdf`;
    const { error } = await supabase.storage
      .from("policies")
      .upload(storagePath, file, { contentType: "application/pdf" });
    if (error) throw new Error(error.message);
  }

  const fields = {
    content: extracted.text,
    page_count: extracted.pageCount,
    source_url: sourceUrl ?? null,
    source_fetched_at: sourceUrl ? new Date().toISOString() : null,
    ...(storagePath ? { storage_path: storagePath } : {}),
  };

  try {
    if (existing) {
      const { error } = await supabase
        .from("policies")
        .update(fields)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);

      // Only once the row points at the new file. Doing it first would mean a
      // failed update left the policy pointing at something deleted.
      if (storagePath && existing.storage_path) {
        await supabase.storage.from("policies").remove([existing.storage_path]);
      }
    } else {
      const { error } = await supabase.from("policies").insert({
        title,
        description: null,
        category: null,
        storage_path: storagePath,
        created_by: userId,
        ...fields,
      });
      if (error) {
        throw new Error(
          error.code === "23505"
            ? `A policy called "${title}" already exists. Reload the page and try again — it should replace it.`
            : error.message,
        );
      }
    }
  } catch (err) {
    // Don't leave the uploaded file orphaned in the bucket.
    if (storagePath) await supabase.storage.from("policies").remove([storagePath]);
    throw err;
  }

  return {
    title,
    replaced: !!existing,
    characters: extracted.text.length,
    pageCount: extracted.pageCount,
  };
}
