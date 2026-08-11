import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import type { CampEvent, CampingSite } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const NO_SITE = "__none";

const emptyForm = {
  name: "",
  start_date: "",
  end_date: "",
  site_id: NO_SITE,
  notes: "",
};

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CampEvent | null;
  sites: CampingSite[];
  /** Prefills the start date when adding from a calendar day. */
  defaultDate?: string;
}

export function EventFormDialog({
  open,
  onOpenChange,
  event,
  sites,
  defaultDate,
}: EventFormDialogProps) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDateError(null);
    setForm(
      event
        ? {
            name: event.name,
            start_date: event.start_date,
            end_date: event.end_date ?? "",
            site_id: event.site_id ?? NO_SITE,
            notes: event.notes ?? "",
          }
        : { ...emptyForm, start_date: defaultDate ?? "" },
    );
  }, [open, event, defaultDate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Mirrors the events_dates_ordered constraint so the user gets a clear
    // message instead of a raw Postgres error.
    if (form.end_date && form.end_date < form.start_date) {
      setDateError("The end date can't be before the start date.");
      return;
    }
    setDateError(null);
    setSubmitting(true);

    const payload = {
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date || null,
      site_id: form.site_id === NO_SITE ? null : form.site_id,
      notes: form.notes.trim() || null,
      // Headcount is set on the event page alongside the menu it scales.
      headcount: event?.headcount ?? null,
    };

    const { error } = event
      ? await supabase.from("events").update(payload).eq("id", event.id)
      : await supabase.from("events").insert(payload);

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(event ? `${payload.name} updated` : `${payload.name} added`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "Add event"}</DialogTitle>
          <DialogDescription>
            Camps, hikes and meetings. Leave the end date blank for a single-day event.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="event-name">Name</Label>
            <Input
              id="event-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-start">Start date</Label>
              <Input
                id="event-start"
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-end">End date</Label>
              <Input
                id="event-end"
                type="date"
                min={form.start_date || undefined}
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>
          {dateError && <p className="text-sm text-destructive">{dateError}</p>}
          <div className="flex flex-col gap-2">
            <Label>Camping site</Label>
            <Select
              value={form.site_id}
              onValueChange={(v) => setForm({ ...form, site_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="No site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SITE}>No site</SelectItem>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="event-notes">Notes</Label>
            <Textarea
              id="event-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : event ? "Save changes" : "Add event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
