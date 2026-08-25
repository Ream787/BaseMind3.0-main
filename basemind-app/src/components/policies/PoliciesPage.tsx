import { useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { FileText, Loader2, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import {
  extractDocumentText,
  isSupportedDocument,
  UnreadableDocumentError,
} from "@/lib/documentText";
import type { Policy } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { PolicyChat } from "@/components/policies/PolicyChat";

export function PoliciesPage() {
  const { hasRole, profile } = useAuth();
  const { rows: policies, loading } = useRealtimeTable("policies", { orderBy: "title" });

  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Policy | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  // Adding a policy changes what the assistant tells everyone, so it's held
  // to Manager and above — the same bar as the database enforces.
  const canManage = hasRole(["Admin", "Manager"]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return policies;
    return policies.filter((p) =>
      [p.title, p.description, p.category, p.content].some((v) =>
        (v ?? "").toLowerCase().includes(term),
      ),
    );
  }, [policies, search]);

  async function handleUpload(file: File) {
    if (!isSupportedDocument(file)) {
      toast.error("Upload a PDF or a plain text file.");
      return;
    }

    setUploading(true);
    try {
      // Extract first: a document with no readable text is useless to the
      // assistant, so it's rejected before anything is stored rather than
      // sitting in the list never appearing in an answer.
      const { text, pageCount } = await extractDocumentText(file);

      let storagePath: string | null = null;
      if (file.type === "application/pdf") {
        const path = `${crypto.randomUUID()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from("policies")
          .upload(path, file, { contentType: "application/pdf" });
        if (uploadError) throw new Error(uploadError.message);
        storagePath = path;
      }

      const { error: insertError } = await supabase.from("policies").insert({
        title: file.name.replace(/\.(pdf|txt|md)$/i, ""),
        description: null,
        category: null,
        storage_path: storagePath,
        content: text,
        page_count: pageCount,
        created_by: profile?.id ?? null,
      });
      if (insertError) throw new Error(insertError.message);

      toast.success(
        `${file.name} added — ${text.length.toLocaleString()} characters of text read`,
      );
    } catch (err) {
      if (err instanceof UnreadableDocumentError) toast.error(err.message, { duration: 8000 });
      else toast.error(err instanceof Error ? err.message : "Couldn't add that document.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function openOriginal(policy: Policy) {
    if (!policy.storage_path) return;
    setOpening(policy.id);
    const { data, error } = await supabase.storage
      .from("policies")
      .createSignedUrl(policy.storage_path, 60);
    setOpening(null);
    if (error || !data) {
      toast.error(error?.message ?? "Couldn't open that document.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.storage_path) {
      await supabase.storage.from("policies").remove([deleteTarget.storage_path]);
    }
    const { error } = await supabase.from("policies").delete().eq("id", deleteTarget.id);
    if (error) toast.error(error.message);
    else toast.success(`${deleteTarget.title} removed`);
    setDeleteTarget(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Policies</h1>
          <p className="text-sm text-muted-foreground">
            Your group&apos;s rules, and an assistant that answers from them.
          </p>
        </div>
        {canManage && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,text/plain,.txt,.md"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? "Reading…" : "Add policy"}
            </Button>
          </>
        )}
      </div>

      {!canManage && (
        <p className="text-sm text-muted-foreground">
          Only Group Managers and Admins can add or remove policies.
        </p>
      )}

      {/* ---- Ask ---------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Ask a question</h2>
        <PolicyChat policies={policies} />
      </section>

      {/* ---- Documents ---------------------------------------------------- */}
      <section className="flex flex-col gap-3 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">
            Documents{policies.length > 0 && ` (${policies.length})`}
          </h2>
          {policies.length > 0 && (
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search policies…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading policies…</p>
        ) : filtered.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            <FileText className="size-5" />
            {policies.length === 0 ? (
              <>
                <p>No policies yet.</p>
                <p className="max-w-md text-xs">
                  PDFs need real text — if a document is a scan or photo of a page, there&apos;s
                  nothing to read and it will be refused.
                </p>
              </>
            ) : (
              <p>Nothing matches that search.</p>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((policy) => (
              <li key={policy.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-medium">{policy.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {policy.page_count ? `${policy.page_count} pages · ` : ""}
                      added {format(parseISO(policy.created_at), "d MMM yyyy")}
                    </span>
                    {policy.description && (
                      <span className="mt-1 text-sm text-muted-foreground">
                        {policy.description}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {policy.category && <Badge variant="outline">{policy.category}</Badge>}
                    {policy.storage_path && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={opening === policy.id}
                        onClick={() => openOriginal(policy)}
                      >
                        Open
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${policy.title}`}
                        onClick={() => setDeleteTarget(policy)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              The document and its text are deleted, and the assistant will stop answering from
              it. This can&apos;t be undone — you&apos;d need to upload the file again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
