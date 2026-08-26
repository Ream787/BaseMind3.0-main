import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Images, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { labDb } from "@/lib/lab/client";
import { useLabTable } from "@/lib/lab/useLabTable";
import type { Photo } from "@/types/lab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LabPage } from "@/components/lab/LabPage";
import { EmptyState } from "@/components/lab/LabUi";
import { BOARD_TABS } from "@/components/layout/SectionTabs";

/**
 * Camp photographs.
 *
 * The bucket is private and the thumbnails are signed URLs, which matters
 * more here than anywhere else in the app: these are pictures of other
 * people's children, and a public bucket is a public bucket whether or not
 * anybody has the link. Signed URLs expire, so the grid re-signs on every
 * visit rather than caching a URL that would eventually 400.
 *
 * There is no consent checking here, on purpose — it would be a checkbox
 * pretending to be a safeguard. The roster records who has consent; that
 * is a conversation for whoever is uploading, not a modal.
 */

const SIGNED_URL_SECONDS = 60 * 60;

export function GalleryPage() {
  const { hasRole, profile } = useAuth();
  const { rows: events } = useRealtimeTable("events", { orderBy: "start_date", ascending: false });
  const { rows: photos, loading } = useLabTable("photos", {
    orderBy: "created_at",
    ascending: false,
  });

  const [eventFilter, setEventFilter] = useState("all");
  const [uploadEvent, setUploadEvent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  const canUpload = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);

  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const visible = useMemo(() => {
    if (eventFilter === "all") return photos;
    if (eventFilter === "none") return photos.filter((p) => !p.event_id);
    return photos.filter((p) => p.event_id === eventFilter);
  }, [photos, eventFilter]);

  /**
   * Sign every path in one request rather than one per tile. Forty photos
   * meant forty round trips and a grid that filled in over five seconds.
   */
  useEffect(() => {
    const paths = visible.map((p) => p.storage_path).filter(Boolean);
    if (paths.length === 0) return;

    let active = true;
    supabase.storage
      .from("lab-photos")
      .createSignedUrls(paths, SIGNED_URL_SECONDS)
      .then(({ data }) => {
        if (!active || !data) return;
        const next: Record<string, string> = {};
        for (const entry of data) {
          if (entry.path && entry.signedUrl) next[entry.path] = entry.signedUrl;
        }
        setUrls((prev) => ({ ...prev, ...next }));
      });

    return () => {
      active = false;
    };
  }, [visible]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0 || !profile) return;
    setUploading(true);

    let added = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} isn't an image`);
        continue;
      }

      const extension = file.name.split(".").pop() ?? "jpg";
      const path = `${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("lab-photos")
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        toast.error(`${file.name}: ${uploadError.message}`);
        continue;
      }

      const { error } = await labDb.from("photos").insert({
        event_id: uploadEvent || null,
        storage_path: path,
        caption: null,
        taken_on: new Date(file.lastModified).toISOString().slice(0, 10),
        uploaded_by: profile.id,
      });

      if (error) {
        // The file is already up; leaving it there with no row would be an
        // orphan nobody can see or delete.
        await supabase.storage.from("lab-photos").remove([path]);
        toast.error(error.message);
        continue;
      }
      added += 1;
    }

    setUploading(false);
    if (added > 0) toast.success(`${added} ${added === 1 ? "photo" : "photos"} added`);
  }

  async function remove(photo: Photo) {
    const { error } = await labDb.from("photos").delete().eq("id", photo.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.storage.from("lab-photos").remove([photo.storage_path]);
    if (lightbox?.id === photo.id) setLightbox(null);
  }

  return (
    <LabPage
      title="Gallery"
      description="Camp photographs, in a private bucket rather than a public one."
      feature="gallery"
      tabs={BOARD_TABS}
      actions={
        canUpload ? (
          <label className="inline-flex">
            <Button size="sm" asChild>
              <span>
                <Upload className="size-4" />
                {uploading ? "Uploading…" : "Add photos"}
              </span>
            </Button>
            <Input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                void upload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        ) : undefined
      }
    >
      <div className="flex flex-wrap gap-2">
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Every camp</SelectItem>
            <SelectItem value="none">Not from a camp</SelectItem>
            {events.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canUpload && (
          <Select
            value={uploadEvent || "none"}
            onValueChange={(v) => setUploadEvent(v === "none" ? "" : v)}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Upload into…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Upload without a camp</SelectItem>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  Upload into {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading && photos.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Images className="size-6" />}
          title="No photographs yet"
          description="Add a few from the last camp. They stay in a private bucket — only people signed in to BaseMind can see them."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((photo) => {
            const url = urls[photo.storage_path];
            const event = photo.event_id ? eventsById.get(photo.event_id) : null;

            return (
              <li key={photo.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setLightbox(photo)}
                  className="block w-full overflow-hidden rounded-lg border bg-muted"
                >
                  {url ? (
                    <img
                      src={url}
                      alt={photo.caption ?? ""}
                      loading="lazy"
                      className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex aspect-square w-full items-center justify-center text-xs text-muted-foreground">
                      Loading…
                    </span>
                  )}
                </button>

                {(photo.caption || event) && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {photo.caption ?? event?.name}
                  </p>
                )}

                {canDelete && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-1 top-1 size-7 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label="Delete photo"
                    onClick={() => remove(photo)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-4 top-4"
            aria-label="Close"
            onClick={() => setLightbox(null)}
          >
            <X className="size-4" />
          </Button>
          <figure className="max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={urls[lightbox.storage_path]}
              alt={lightbox.caption ?? ""}
              className="max-h-[80vh] w-auto rounded-lg object-contain"
            />
            <figcaption className="mt-2 text-center text-sm text-white/80">
              {lightbox.caption}
              {lightbox.taken_on && (
                <span className="ml-2 opacity-70">
                  {format(parseISO(lightbox.taken_on), "d MMM yyyy")}
                </span>
              )}
            </figcaption>
          </figure>
        </div>
      )}
    </LabPage>
  );
}
