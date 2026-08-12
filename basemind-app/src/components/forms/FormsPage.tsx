import { useMemo, useRef, useState } from "react";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import {
  FIELD_OPTIONS,
  fillPdfForm,
  readPdfFields,
  downloadBytes,
  type PdfFieldInfo,
} from "@/lib/formFill";
import type { CampForm } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const UNMAPPED = "__unmapped";

export function FormsPage() {
  const { hasRole } = useAuth();
  const { rows: forms, loading } = useRealtimeTable("camp_forms", { orderBy: "name" });
  const { rows: events } = useRealtimeTable("events", { orderBy: "start_date", ascending: false });
  const { rows: sites } = useRealtimeTable("camping_sites");
  const { rows: plans } = useRealtimeTable("safety_plans");
  const { rows: scenarios } = useRealtimeTable("safety_scenarios");
  const { rows: eventEquipment } = useRealtimeTable("event_equipment");

  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [pdfFields, setPdfFields] = useState<PdfFieldInfo[] | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CampForm | null>(null);

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);

  const openForm = openFormId ? (forms.find((f) => f.id === openFormId) ?? null) : null;

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof FIELD_OPTIONS>();
    for (const option of FIELD_OPTIONS) {
      const bucket = groups.get(option.group);
      if (bucket) bucket.push(option);
      else groups.set(option.group, [option]);
    }
    return [...groups.entries()];
  }, []);

  async function handleUpload(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("That isn't a PDF.");
      return;
    }
    setUploading(true);
    try {
      const bytes = await file.arrayBuffer();

      // Check it's actually fillable before storing it — a flat scan can't be
      // filled, and finding that out later is worse.
      let fields: PdfFieldInfo[] = [];
      try {
        fields = await readPdfFields(bytes);
      } catch {
        toast.error("Couldn't read that PDF.");
        return;
      }
      if (fields.length === 0) {
        toast.error(
          "That PDF has no fillable fields, so there's nothing to fill in. It's probably a scan or a flattened form.",
        );
        return;
      }

      const path = `${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("camp-forms")
        .upload(path, file, { contentType: "application/pdf" });
      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }

      const { error: insertError } = await supabase.from("camp_forms").insert({
        name: file.name.replace(/\.pdf$/i, ""),
        description: null,
        storage_path: path,
        field_map: {},
      });
      if (insertError) {
        toast.error(insertError.message);
        return;
      }
      toast.success(`Uploaded — ${fields.length} fillable fields found`);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function inspect(form: CampForm) {
    setInspecting(true);
    setPdfFields(null);
    try {
      const { data, error } = await supabase.storage.from("camp-forms").download(form.storage_path);
      if (error || !data) {
        toast.error(error?.message ?? "Couldn't load the form.");
        return;
      }
      setPdfFields(await readPdfFields(await data.arrayBuffer()));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read the form.");
    } finally {
      setInspecting(false);
    }
  }

  async function setMapping(form: CampForm, pdfField: string, dataKey: string) {
    const next = { ...form.field_map };
    if (dataKey === UNMAPPED) delete next[pdfField];
    else next[pdfField] = dataKey;
    const { error } = await supabase
      .from("camp_forms")
      .update({ field_map: next })
      .eq("id", form.id);
    if (error) toast.error(error.message);
  }

  async function generate(form: CampForm, eventId: string) {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    setGeneratingFor(eventId);
    try {
      const { data, error } = await supabase.storage.from("camp-forms").download(form.storage_path);
      if (error || !data) {
        toast.error(error?.message ?? "Couldn't load the form.");
        return;
      }

      const plan = plans.find((p) => p.event_id === event.id) ?? null;
      const result = await fillPdfForm(await data.arrayBuffer(), form.field_map, {
        event,
        site: event.site_id ? (sites.find((s) => s.id === event.site_id) ?? null) : null,
        plan,
        scenarios: plan ? scenarios.filter((s) => s.safety_plan_id === plan.id) : [],
        equipmentCount: eventEquipment.filter((r) => r.event_id === event.id).length,
      });

      downloadBytes(
        result.bytes,
        `${form.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${event.start_date}.pdf`,
      );

      if (result.missing.length > 0) {
        toast.warning(
          `Filled ${result.filled.length} fields. ${result.missing.length} mapped field(s) weren't found in the PDF.`,
        );
      } else {
        toast.success(`Filled ${result.filled.length} fields`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't fill the form.");
    } finally {
      setGeneratingFor(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await supabase.storage.from("camp-forms").remove([deleteTarget.storage_path]);
    const { error } = await supabase.from("camp_forms").delete().eq("id", deleteTarget.id);
    if (error) toast.error(error.message);
    else toast.success(`${deleteTarget.name} deleted`);
    setDeleteTarget(null);
  }

  // ---- Field mapping view ---------------------------------------------
  if (openForm) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <button
            type="button"
            onClick={() => {
              setOpenFormId(null);
              setPdfFields(null);
            }}
            className="mb-1 text-sm text-muted-foreground hover:text-foreground"
          >
            ← All forms
          </button>
          <h1>{openForm.name}</h1>
          <p className="text-sm text-muted-foreground">
            Match each box in the PDF to the data that should go in it. Anything left unmapped is
            left blank for you to complete by hand.
          </p>
        </div>

        {!pdfFields && (
          <Button className="self-start" onClick={() => inspect(openForm)} disabled={inspecting}>
            {inspecting ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            {inspecting ? "Reading…" : "Read the form's fields"}
          </Button>
        )}

        {pdfFields && (
          <div className="rounded-lg border">
            {pdfFields.map((field) => (
              <div
                key={field.name}
                className="flex flex-wrap items-center gap-3 border-b p-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{field.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {field.type.replace("PDF", "")}
                  </span>
                </div>
                <Select
                  value={openForm.field_map[field.name] ?? UNMAPPED}
                  onValueChange={(v) => setMapping(openForm, field.name, v)}
                >
                  <SelectTrigger className="w-64" disabled={!canEdit}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNMAPPED}>Leave blank</SelectItem>
                    {grouped.map(([group, options]) => (
                      <SelectGroup key={group}>
                        <SelectLabel>{group}</SelectLabel>
                        {options.map((option) => (
                          <SelectItem key={option.key} value={option.key}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 border-t pt-4">
          <h2 className="font-medium">Generate for a camp</h2>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No camps to generate for yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {events.slice(0, 10).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{event.name}</span>
                    <span className="text-xs text-muted-foreground">{event.start_date}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generate(openForm, event.id)}
                    disabled={
                      generatingFor === event.id || Object.keys(openForm.field_map).length === 0
                    }
                  >
                    {generatingFor === event.id ? "Filling…" : "Fill & download"}
                  </Button>
                </div>
              ))}
            </div>
          )}
          {Object.keys(openForm.field_map).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Map at least one field first, or the copy would come out blank.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---- Library ---------------------------------------------------------
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Forms</h1>
          <p className="text-sm text-muted-foreground">
            Upload an official fillable PDF once, then generate filled copies per camp.
          </p>
        </div>
        {canEdit && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? "Uploading…" : "Upload a form"}
            </Button>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Loading forms…
        </div>
      ) : forms.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          <FileText className="size-5" />
          <p>No forms uploaded yet.</p>
          <p className="max-w-md text-xs">
            The PDF must have real fillable boxes. A scanned or flattened form can&apos;t be filled
            in automatically — open it in a PDF reader and check you can type into it.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => {
            const mapped = Object.keys(form.field_map).length;
            return (
              <div key={form.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenFormId(form.id)}
                    className="min-w-0 flex-1 text-left font-medium hover:text-primary"
                  >
                    {form.name}
                  </button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${form.name}`}
                      onClick={() => setDeleteTarget(form)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <Badge variant={mapped > 0 ? "secondary" : "outline"} className="w-fit">
                  {mapped > 0 ? `${mapped} fields mapped` : "Not set up yet"}
                </Badge>
                <button
                  type="button"
                  onClick={() => setOpenFormId(form.id)}
                  className="mt-auto text-left text-sm text-primary hover:underline"
                >
                  {mapped > 0 ? "Fill for a camp →" : "Set up fields →"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The uploaded PDF and its field mapping are both removed. Copies you already
              downloaded are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
