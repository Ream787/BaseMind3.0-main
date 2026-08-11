import { useMemo, useState } from "react";
import { BookmarkPlus, ChefHat, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { menuScale } from "@/lib/menus";
import type { CampEvent, FoodItem, Menu, MenuMeal, MenuMealItem } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { MenuEditor } from "@/components/menus/MenuEditor";

interface EventMenuSectionProps {
  event: CampEvent;
  menu: Menu | null;
  meals: MenuMeal[];
  items: MenuMealItem[];
  presets: Menu[];
  food: FoodItem[];
  canEdit: boolean;
}

export function EventMenuSection({
  event,
  menu,
  meals,
  items,
  presets,
  food,
  canEdit,
}: EventMenuSectionProps) {
  const [applyOpen, setApplyOpen] = useState(false);
  const [presetId, setPresetId] = useState("");
  const [applying, setApplying] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetCategory, setPresetCategory] = useState("");
  const [clearOpen, setClearOpen] = useState(false);

  const selectedPreset = presets.find((p) => p.id === presetId) ?? null;

  const previewScale = useMemo(
    () => (selectedPreset ? menuScale(selectedPreset, event.headcount) : 1),
    [selectedPreset, event.headcount],
  );

  async function applyPreset() {
    if (!presetId) return;
    setApplying(true);
    const { error } = await supabase.rpc("apply_menu_preset", {
      preset_id: presetId,
      target_event_id: event.id,
      target_headcount: event.headcount,
    });
    setApplying(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      event.headcount
        ? `Menu applied and scaled for ${event.headcount}`
        : "Menu applied",
    );
    setApplyOpen(false);
    setPresetId("");
  }

  async function saveAsPreset() {
    if (!menu || !presetName.trim()) return;
    const { error } = await supabase.rpc("save_menu_as_preset", {
      source_menu_id: menu.id,
      preset_name: presetName.trim(),
      preset_category: presetCategory.trim() || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Saved "${presetName.trim()}" to the menu library`);
    setSaveOpen(false);
    setPresetName("");
    setPresetCategory("");
  }

  async function clearMenu() {
    if (!menu) return;
    const { error } = await supabase.from("menus").delete().eq("id", menu.id);
    if (error) toast.error(error.message);
    else toast.success("Menu cleared");
    setClearOpen(false);
  }

  async function updateHeadcount(value: string) {
    const headcount = Number(value) || null;
    const { error } = await supabase
      .from("events")
      .update({ headcount: headcount && headcount > 0 ? headcount : null })
      .eq("id", event.id);
    if (error) toast.error(error.message);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-medium">Menu</h2>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <div className="flex items-center gap-2">
              <Label htmlFor="event-headcount" className="text-sm text-muted-foreground">
                People
              </Label>
              <Input
                id="event-headcount"
                type="number"
                min={1}
                className="h-8 w-20"
                placeholder="—"
                defaultValue={event.headcount ?? ""}
                onBlur={(e) => updateHeadcount(e.target.value)}
              />
            </div>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setApplyOpen(true)}>
              <Copy className="size-4" />
              {menu ? "Replace with preset" : "Use a preset"}
            </Button>
          )}
          {canEdit && menu && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPresetName(menu.name);
                  setPresetCategory(menu.category ?? "");
                  setSaveOpen(true);
                }}
              >
                <BookmarkPlus className="size-4" />
                Save as preset
              </Button>
              <Button variant="ghost" size="icon" aria-label="Clear menu" onClick={() => setClearOpen(true)}>
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {!event.headcount && canEdit && (
        <p className="text-sm text-muted-foreground">
          Set how many people are going and presets will scale their quantities to match.
        </p>
      )}

      {menu ? (
        <>
          <p className="text-sm text-muted-foreground">
            {menu.name} · quantities for {menu.serves}{" "}
            {menu.serves === 1 ? "person" : "people"}. Ingredients roll up into the food list
            below.
          </p>
          <MenuEditor menu={menu} meals={meals} items={items} food={food} canEdit={canEdit} />
        </>
      ) : (
        <div className="flex h-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm text-muted-foreground">
          <ChefHat className="size-5" />
          No menu for this camp yet.
        </div>
      )}

      {/* ---- Apply a preset ------------------------------------------- */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Use a preset menu</DialogTitle>
            <DialogDescription>
              This copies the menu onto this camp. Editing it here won&apos;t change the original,
              and vice versa.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Menu</Label>
              <Select value={presetId} onValueChange={setPresetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a menu…" />
                </SelectTrigger>
                <SelectContent>
                  {presets.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No presets saved yet
                    </div>
                  ) : (
                    presets.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.name} — {preset.day_count}d, feeds {preset.serves}
                        {preset.category ? ` · ${preset.category}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedPreset && (
              <p className="text-sm text-muted-foreground">
                {event.headcount
                  ? previewScale === 1
                    ? `Quantities stay as written — this camp has ${event.headcount} people, same as the menu.`
                    : `Quantities will be scaled ×${previewScale.toFixed(2)} for ${event.headcount} people (menu is written for ${selectedPreset.serves}).`
                  : "No headcount set for this camp, so quantities are copied exactly as written."}
              </p>
            )}

            {menu && (
              <p className="text-sm text-destructive">
                This replaces the current menu for this camp.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyPreset} disabled={!presetId || applying}>
              {applying ? "Applying…" : "Apply menu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Save as preset ------------------------------------------- */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save to the menu library</DialogTitle>
            <DialogDescription>
              Keeps a copy you can reuse on future camps. This camp&apos;s menu stays as it is.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="preset-name">Name</Label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="preset-category">Type</Label>
              <Input
                id="preset-category"
                placeholder="Camping, Hiking…"
                value={presetCategory}
                onChange={(e) => setPresetCategory(e.target.value)}
              />
            </div>
            {menu && event.headcount && menu.serves !== event.headcount && (
              <p className="text-sm text-muted-foreground">
                It will be saved as feeding {menu.serves}, matching this camp&apos;s quantities.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAsPreset} disabled={!presetName.trim()}>
              Save preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this camp&apos;s menu?</AlertDialogTitle>
            <AlertDialogDescription>
              The meals and their ingredients are removed from this camp, and the food list below
              loses whatever came from them. Presets in the library aren&apos;t touched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearMenu}>Clear menu</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
