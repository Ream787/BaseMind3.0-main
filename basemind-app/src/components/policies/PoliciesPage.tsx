import { useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  ChevronRight,
  DownloadCloud,
  FileText,
  FolderTree,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useOffline } from "@/context/OfflineContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { isSupportedDocument, UnreadableDocumentError } from "@/lib/documentText";
import {
  downloadPolicyPdf,
  findByTitle,
  savePolicyDocument,
  titleFromFileName,
} from "@/lib/policyDocuments";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SectionTabs, ASSISTANT_TABS } from "@/components/layout/SectionTabs";
import {
  categoriesInUse,
  groupPolicies,
  unfiled,
  verifyFilings,
} from "@/lib/policySort";

/** Just the site name from a link, since the full URL never fits. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function PoliciesPage() {
  const { hasRole, profile } = useAuth();
  const { online } = useOffline();
  const { rows: policies, loading } = useRealtimeTable("policies", { orderBy: "title" });

  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Policy | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [sorting, setSorting] = useState(false);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  // Which shelves are folded shut. Empty means everything is open, so a
  // first visit shows the documents rather than a row of closed drawers.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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
      const title = titleFromFileName(file.name);
      const saved = await savePolicyDocument({
        file,
        title,
        existing: findByTitle(policies, title),
        userId: profile?.id ?? null,
      });
      announce(saved.title, saved.replaced, saved.characters);
    } catch (err) {
      reportSaveFailure(err);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  /**
   * Adds a policy from a link.
   *
   * The download itself happens in an Edge Function, not here — almost no site
   * serves a PDF with headers that let another origin read it, so fetching it
   * from the browser would fail on links a person can open perfectly well.
   */
  async function handleLink() {
    const url = link.trim();
    if (!url || uploading) return;

    setUploading(true);
    try {
      const file = await downloadPolicyPdf(url);
      const title = titleFromFileName(file.name);
      const saved = await savePolicyDocument({
        file,
        bytes: await file.arrayBuffer(),
        title,
        sourceUrl: url,
        existing: findByTitle(policies, title),
        userId: profile?.id ?? null,
      });
      announce(saved.title, saved.replaced, saved.characters);
      setLink("");
      setLinkOpen(false);
    } catch (err) {
      reportSaveFailure(err);
    } finally {
      setUploading(false);
    }
  }

  /** Re-downloads a linked document and replaces it in place. */
  async function refreshFromSource(policy: Policy) {
    if (!policy.source_url) return;
    setRefreshing(policy.id);
    try {
      const file = await downloadPolicyPdf(policy.source_url);
      const saved = await savePolicyDocument({
        file,
        bytes: await file.arrayBuffer(),
        // Keep the name it already has: replacing in place is the point, and
        // the file name at the far end may well have changed.
        title: policy.title,
        sourceUrl: policy.source_url,
        existing: policy,
        userId: profile?.id ?? null,
      });
      toast.success(
        `${saved.title} updated — ${saved.characters.toLocaleString()} characters of text read`,
      );
    } catch (err) {
      reportSaveFailure(err);
    } finally {
      setRefreshing(null);
    }
  }

  function announce(title: string, replaced: boolean, characters: number) {
    toast.success(
      replaced
        ? `${title} replaced — ${characters.toLocaleString()} characters of text read`
        : `${title} added — ${characters.toLocaleString()} characters of text read`,
    );
  }

  function reportSaveFailure(err: unknown) {
    if (err instanceof UnreadableDocumentError) toast.error(err.message, { duration: 8000 });
    else toast.error(err instanceof Error ? err.message : "Couldn't add that document.", {
      duration: 8000,
    });
  }

  /** Listed but not yet readable: a link, and no text behind it. */
  const missingText = useMemo(
    () => policies.filter((p) => p.source_url && !p.content.trim()),
    [policies],
  );

  const linked = useMemo(() => policies.filter((p) => p.source_url), [policies]);

  /**
   * Fetches every document that has a link but no text yet.
   *
   * This is what turns a bulk-added list into something the assistant can
   * answer from: SQL can add a title and a link, but pulling the words out of
   * a PDF needs the file itself.
   *
   * One at a time, deliberately. Eighty parallel downloads would hammer
   * scouts.org.za and trip whatever rate limit it has, and the failure would
   * look like "some documents randomly didn't work". Slower and complete
   * beats fast and patchy.
   *
   * One document failing doesn't stop the rest — a moved link or a scanned
   * PDF with no text in it is entirely likely across eighty of them, and the
   * others are still worth having.
   */
  async function downloadMissing() {
    await fetchAll(missingText);
  }

  /** Re-downloads everything with a link, whether it has text or not. */
  async function reloadAll() {
    await fetchAll(linked);
  }

  async function fetchAll(queue: Policy[]) {
    if (queue.length === 0) return;

    setBulk({ done: 0, total: queue.length });
    const failed: string[] = [];

    for (const [index, policy] of queue.entries()) {
      try {
        const file = await downloadPolicyPdf(policy.source_url!);
        await savePolicyDocument({
          file,
          bytes: await file.arrayBuffer(),
          title: policy.title,
          sourceUrl: policy.source_url,
          existing: policy,
          userId: profile?.id ?? null,
        });
      } catch {
        failed.push(policy.title);
      }
      setBulk({ done: index + 1, total: queue.length });
    }

    setBulk(null);
    const read = queue.length - failed.length;
    if (failed.length === 0) {
      toast.success(`Read all ${read} documents`);
    } else {
      toast.warning(
        `Read ${read} of ${queue.length}. Couldn't read: ${failed.slice(0, 3).join(", ")}` +
          (failed.length > 3 ? ` and ${failed.length - 3} more` : ""),
        { duration: 10000 },
      );
    }
  }

  /**
   * Files the documents into categories.
   *
   * Only documents with no group are touched — one you have already filed
   * stays where you put it. New groups are allowed where nothing fits, but
   * the shelves that already exist are sent along so it reaches for those
   * first.
   *
   * Applied straight away rather than shown as suggestions: a group is a
   * label, and moving it back is one dropdown away. Merging two equipment
   * rows is not, which is why that one asks and this doesn't.
   */
  async function sortIntoCategories() {
    // Only the ones with nowhere to be. A document already filed is
    // somebody's decision, and re-filing it would quietly undo that.
    const toFile = unfiled(policies);
    if (toFile.length === 0) {
      toast.success("Everything already has a group.");
      return;
    }

    setSorting(true);
    try {
      const { data, error } = await supabase.functions.invoke("policy-sort", {
        body: {
          documents: toFile.map((p) => ({
            title: p.title,
            // The opening is enough to tell what a policy is about.
            excerpt: p.content.slice(0, 400),
          })),
          // The shelves that exist, so it puts things on those rather than
          // inventing a parallel set.
          inUse: categoriesInUse(policies),
        },
      });
      if (error) {
        const context = (error as { context?: Response }).context;
        const body = await context?.json().catch(() => null);
        throw new Error(body?.error ?? body?.detail ?? error.message);
      }

      const filings = verifyFilings(data?.filed ?? [], policies);
      if (filings.length === 0) {
        toast.success("Nothing new to file.");
        return;
      }

      for (const filing of filings) {
        const { error: updateError } = await supabase
          .from("policies")
          .update({ category: filing.category })
          .eq("id", filing.policyId);
        if (updateError) throw new Error(updateError.message);
      }
      const fresh = filings.filter((f) => f.isNewCategory).length;
      toast.success(
        filings.length === 1
          ? `Filed "${filings[0].title}" under ${filings[0].category}`
          : `Filed ${filings.length} documents` +
              (fresh > 0 ? ` · ${fresh} new ${fresh === 1 ? "group" : "groups"}` : ""),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't sort those.");
    } finally {
      setSorting(false);
    }
  }

  /**
   * Opens the actual PDF.
   *
   * Our stored copy when there is one, otherwise the original link. A
   * bulk-added document has a link long before anyone has downloaded it, and
   * "you cannot read this yet" would be a strange thing to say about a file
   * that is one click away on the Scouts website.
   */
  async function openOriginal(policy: Policy) {
    if (!policy.storage_path) {
      if (policy.source_url) window.open(policy.source_url, "_blank", "noopener,noreferrer");
      return;
    }
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
      <SectionTabs tabs={ASSISTANT_TABS} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Documents</h1>
          <p className="text-sm text-muted-foreground">
            Your group&apos;s rules. These are the only thing the assistant answers from.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
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
            {linked.length > 0 && (
              <Button
                variant="outline"
                onClick={reloadAll}
                disabled={bulk !== null || !online}
                title={
                  online
                    ? "Fetch every linked document again, replacing what we hold"
                    : "Needs a connection"
                }
              >
                <RefreshCw className={`size-4 ${bulk ? "animate-spin" : ""}`} />
                Reload all ({linked.length})
              </Button>
            )}
            {missingText.length > 0 && (
              <Button
                onClick={downloadMissing}
                disabled={bulk !== null || !online}
                title={
                  online
                    ? "Fetch and read every document that has a link but no text yet"
                    : "Needs a connection"
                }
              >
                {bulk ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <DownloadCloud className="size-4" />
                )}
                {bulk
                  ? `Reading ${bulk.done} of ${bulk.total}…`
                  : `Download missing text (${missingText.length})`}
              </Button>
            )}
            {policies.length > 1 && (
              <Button
                variant="outline"
                onClick={sortIntoCategories}
                disabled={sorting || !online}
                title={online ? "Group them by what they are about" : "Needs a connection"}
              >
                {sorting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FolderTree className="size-4" />
                )}
                {sorting ? "Filing…" : "Sort into groups"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setLinkOpen(true)}
              disabled={uploading || !online}
              title={online ? undefined : "Needs a connection — the file is fetched by the server"}
            >
              <Link2 className="size-4" />
              Add from link
            </Button>
            <Button
              onClick={() => fileInput.current?.click()}
              disabled={uploading || !online}
              title={online ? undefined : "Needs a connection to store the document"}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? "Reading…" : "Upload"}
            </Button>
          </div>
        )}
      </div>

      {!canManage && (
        <p className="text-sm text-muted-foreground">
          Only Group Managers and Admins can add or remove policies.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">
            {policies.length > 0 ? `${policies.length} in the shelf` : "Nothing added yet"}
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
          <div className="flex flex-col gap-5">
            {groupPolicies(filtered).map((group) => {
              const shut = collapsed.has(group.category);
              return (
              <section key={group.category} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(group.category)) next.delete(group.category);
                      else next.add(group.category);
                      return next;
                    })
                  }
                  aria-expanded={!shut}
                  className="flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight
                    className={`size-4 transition-transform ${shut ? "" : "rotate-90"}`}
                  />
                  {group.category}
                  <span className="font-normal">{group.policies.length}</span>
                </button>
                <ul className={`flex flex-col gap-2 ${shut ? "hidden" : ""}`}>
                  {group.policies.map((policy) => (
              <li key={policy.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-medium">{policy.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {policy.page_count ? `${policy.page_count} pages · ` : ""}
                      {policy.source_fetched_at
                        ? `downloaded ${format(parseISO(policy.source_fetched_at), "d MMM yyyy")}`
                        : `added ${format(parseISO(policy.created_at), "d MMM yyyy")}`}
                    </span>
                    {policy.source_url && (
                      <span className="truncate text-xs text-muted-foreground">
                        from {hostOf(policy.source_url)}
                      </span>
                    )}
                    {policy.description && (
                      <span className="mt-1 text-sm text-muted-foreground">
                        {policy.description}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {policy.category && <Badge variant="outline">{policy.category}</Badge>}
                    {(policy.storage_path || policy.source_url) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={opening === policy.id || !online}
                        title={
                          !online
                            ? "Needs a connection"
                            : policy.storage_path
                              ? "Open our copy"
                              : "Open the original on scouts.org.za"
                        }
                        onClick={() => openOriginal(policy)}
                      >
                        Open
                      </Button>
                    )}
                    {canManage && policy.source_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Check ${policy.title} for an update`}
                        title={
                          online
                            ? "Download it again from the link and replace this copy"
                            : "Needs a connection to re-download"
                        }
                        disabled={refreshing === policy.id || !online}
                        onClick={() => refreshFromSource(policy)}
                      >
                        <RefreshCw
                          className={`size-4 ${refreshing === policy.id ? "animate-spin" : ""}`}
                        />
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
              </section>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={linkOpen} onOpenChange={(open) => !uploading && setLinkOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a policy from a link</DialogTitle>
            <DialogDescription>
              Paste a link straight to a PDF and it&apos;s downloaded, read and kept here. If a
              document with the same name already exists, this replaces it.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleLink();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="policy-link">PDF link</Label>
              <Input
                id="policy-link"
                type="url"
                inputMode="url"
                placeholder="https://example.org/safety-policy.pdf"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                disabled={uploading}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                It has to be the PDF itself, not the page it sits on. A document behind a
                sign-in can&apos;t be reached — save it and upload the file instead.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLinkOpen(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={uploading || !link.trim()}>
                {uploading && <Loader2 className="size-4 animate-spin" />}
                {uploading ? "Downloading…" : "Download"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
