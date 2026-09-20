import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Hospital, Mail, MapPin, Phone, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import type { CampingSite } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionTabs, CAMP_TABS } from "@/components/layout/SectionTabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  description: "",
  notes: "",
  hospital_name: "",
  hospital_phone: "",
  hospital_address: "",
  hospital_distance: "",
  emergency_access: "",
  emergency_notes: "",
};

export function CampingSitesPage() {
  const { hasRole } = useAuth();
  const { rows: sites, loading, error } = useRealtimeTable("camping_sites", { orderBy: "name" });

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CampingSite | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CampingSite | null>(null);

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);

  useEffect(() => {
    if (!dialogOpen) return;
    setForm(
      editing
        ? {
            name: editing.name,
            phone: editing.phone ?? "",
            email: editing.email ?? "",
            address: editing.address ?? "",
            description: editing.description ?? "",
            notes: editing.notes ?? "",
            hospital_name: editing.hospital_name ?? "",
            hospital_phone: editing.hospital_phone ?? "",
            hospital_address: editing.hospital_address ?? "",
            hospital_distance: editing.hospital_distance ?? "",
            emergency_access: editing.emergency_access ?? "",
            emergency_notes: editing.emergency_notes ?? "",
          }
        : emptyForm,
    );
  }, [dialogOpen, editing]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sites;
    return sites.filter((s) =>
      [s.name, s.address, s.description].some((f) => (f ?? "").toLowerCase().includes(term)),
    );
  }, [sites, search]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
      hospital_name: form.hospital_name.trim() || null,
      hospital_phone: form.hospital_phone.trim() || null,
      hospital_address: form.hospital_address.trim() || null,
      hospital_distance: form.hospital_distance.trim() || null,
      emergency_access: form.emergency_access.trim() || null,
      emergency_notes: form.emergency_notes.trim() || null,
    };

    const { error: saveError } = editing
      ? await supabase.from("camping_sites").update(payload).eq("id", editing.id)
      : await supabase.from("camping_sites").insert(payload);

    setSubmitting(false);
    if (saveError) {
      toast.error(saveError.message);
      return;
    }
    toast.success(editing ? `${payload.name} updated` : `${payload.name} added`);
    setDialogOpen(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error: deleteError } = await supabase
      .from("camping_sites")
      .delete()
      .eq("id", deleteTarget.id);
    if (deleteError) toast.error(deleteError.message);
    else toast.success(`${deleteTarget.name} deleted`);
    setDeleteTarget(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionTabs tabs={CAMP_TABS} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Camping sites</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "site" : "sites"}
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add site
          </Button>
        )}
      </div>

      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search sites…"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Loading sites…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          No camping sites yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((site) => (
            <div key={site.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{site.name}</span>
                <div className="flex shrink-0 gap-1">
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${site.name}`}
                      onClick={() => {
                        setEditing(site);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${site.name}`}
                      onClick={() => setDeleteTarget(site)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>

              {site.description && (
                <p className="text-sm text-muted-foreground">{site.description}</p>
              )}

              <div className="flex flex-col gap-1 text-sm">
                {site.phone && (
                  <a
                    href={`tel:${site.phone}`}
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Phone className="size-3.5 shrink-0" />
                    {site.phone}
                  </a>
                )}
                {site.email && (
                  <a
                    href={`mailto:${site.email}`}
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{site.email}</span>
                  </a>
                )}
                {site.address && (
                  <span className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" />
                    {site.address}
                  </span>
                )}
              </div>

              {/* The hospital was only visible by opening the edit form, so
                  the one detail worth checking before a camp was the one you
                  had to go looking for. */}
              {site.hospital_name ? (
                <p className="flex items-start gap-2 border-t pt-2 text-sm">
                  <Hospital className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span>
                    {site.hospital_name}
                    {site.hospital_distance && (
                      <span className="text-muted-foreground"> · {site.hospital_distance}</span>
                    )}
                    {site.hospital_phone && (
                      <a
                        href={`tel:${site.hospital_phone}`}
                        className="ml-2 text-primary hover:underline"
                      >
                        {site.hospital_phone}
                      </a>
                    )}
                  </span>
                </p>
              ) : (
                <p className="border-t pt-2 text-sm text-muted-foreground">
                  No hospital recorded.
                </p>
              )}

              {site.notes && (
                <p className="border-t pt-2 text-sm text-muted-foreground">{site.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit site" : "Add camping site"}</DialogTitle>
            <DialogDescription>
              Contact details and notes appear on the printed camp plan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="site-name">Name</Label>
              <Input
                id="site-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="site-phone">Phone</Label>
                <Input
                  id="site-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="site-email">Email</Label>
                <Input
                  id="site-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="site-address">Address</Label>
              <Input
                id="site-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="site-description">Description</Label>
              <Textarea
                id="site-description"
                placeholder="Facilities, terrain, what it's good for…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="site-notes">Notes</Label>
              <Textarea
                id="site-notes"
                placeholder="Booking quirks, gate codes, things to remember…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-4 border-t pt-4">
              <div>
                <h3 className="text-sm font-medium">Emergency details</h3>
                <p className="text-sm text-muted-foreground">
                  Used on safety plans. Check these yourself — nothing here is looked up.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="site-hospital">Nearest hospital</Label>
                <Input
                  id="site-hospital"
                  value={form.hospital_name}
                  onChange={(e) => setForm({ ...form, hospital_name: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="site-hospital-phone">Hospital phone</Label>
                  <Input
                    id="site-hospital-phone"
                    type="tel"
                    value={form.hospital_phone}
                    onChange={(e) => setForm({ ...form, hospital_phone: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="site-hospital-distance">How far</Label>
                  <Input
                    id="site-hospital-distance"
                    placeholder="20 km, about 25 min"
                    value={form.hospital_distance}
                    onChange={(e) => setForm({ ...form, hospital_distance: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="site-hospital-address">Hospital address</Label>
                <Input
                  id="site-hospital-address"
                  value={form.hospital_address}
                  onChange={(e) => setForm({ ...form, hospital_address: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="site-access">Emergency vehicle access</Label>
                <Input
                  id="site-access"
                  placeholder="Where an ambulance should meet you"
                  value={form.emergency_access}
                  onChange={(e) => setForm({ ...form, emergency_access: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="site-emergency-notes">Emergency notes</Label>
                <Textarea
                  id="site-emergency-notes"
                  placeholder="No signal in the valley, gate locked after 22h00…"
                  value={form.emergency_notes}
                  onChange={(e) => setForm({ ...form, emergency_notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editing ? "Save changes" : "Add site"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Events held here keep their details but lose the site link. This can&apos;t be undone.
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
