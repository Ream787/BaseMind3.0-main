import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ChefHat, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { MENU_CATEGORIES } from "@/lib/menus";
import type { Menu } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

const ANY = "__any";

const emptyForm = {
  name: "",
  description: "",
  serves: "12",
  day_count: "2",
  category: "Camping",
};

export function MenusPage() {
  const { hasRole } = useAuth();
  const { rows: allMenus, loading } = useRealtimeTable("menus", { orderBy: "name" });
  const { rows: meals } = useRealtimeTable("menu_meals");
  const { rows: mealItems } = useRealtimeTable("menu_meal_items");
  const { rows: food } = useRealtimeTable("food_items", { orderBy: "name" });

  const [search, setSearch] = useState("");
  const [dayFilter, setDayFilter] = useState<string>(ANY);
  const [categoryFilter, setCategoryFilter] = useState<string>(ANY);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Menu | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Menu | null>(null);

  const canEdit = hasRole(["Admin", "Manager", "Member"]);

  // Presets only — a camp's own menu lives on its event page.
  const presets = useMemo(() => allMenus.filter((m) => m.event_id === null), [allMenus]);

  useEffect(() => {
    if (!dialogOpen) return;
    setForm(
      editing
        ? {
            name: editing.name,
            description: editing.description ?? "",
            serves: String(editing.serves),
            day_count: String(editing.day_count),
            category: editing.category ?? "",
          }
        : emptyForm,
    );
  }, [dialogOpen, editing]);

  const dayOptions = useMemo(
    () => Array.from(new Set(presets.map((m) => m.day_count))).sort((a, b) => a - b),
    [presets],
  );
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...MENU_CATEGORIES,
          ...presets.map((m) => m.category).filter((c): c is string => !!c),
        ]),
      ).sort(),
    [presets],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return presets.filter((menu) => {
      if (dayFilter !== ANY && String(menu.day_count) !== dayFilter) return false;
      if (categoryFilter !== ANY && (menu.category ?? "") !== categoryFilter) return false;
      if (!term) return true;
      return [menu.name, menu.description, menu.category].some((v) =>
        (v ?? "").toLowerCase().includes(term),
      );
    });
  }, [presets, search, dayFilter, categoryFilter]);

  const openMenu = openMenuId ? (allMenus.find((m) => m.id === openMenuId) ?? null) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      serves: Math.max(1, Number(form.serves) || 1),
      day_count: Math.max(1, Number(form.day_count) || 1),
      category: form.category.trim() || null,
      event_id: null,
    };

    const { error } = editing
      ? await supabase.from("menus").update(payload).eq("id", editing.id)
      : await supabase.from("menus").insert(payload);

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? `${payload.name} updated` : `${payload.name} created`);
    setDialogOpen(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from("menus").delete().eq("id", deleteTarget.id);
    if (error) toast.error(error.message);
    else toast.success(`${deleteTarget.name} deleted`);
    setDeleteTarget(null);
  }

  // ---- Editing a single preset ----------------------------------------
  if (openMenu) {
    const menuMeals = meals.filter((m) => m.menu_id === openMenu.id);
    const menuItems = mealItems.filter((i) => menuMeals.some((m) => m.id === i.meal_id));
    return (
      <div className="flex flex-col gap-4">
        <div>
          <button
            type="button"
            onClick={() => setOpenMenuId(null)}
            className="mb-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            All menus
          </button>
          <h1>{openMenu.name}</h1>
          <p className="text-sm text-muted-foreground">
            {openMenu.day_count} {openMenu.day_count === 1 ? "day" : "days"} · feeds{" "}
            {openMenu.serves}
            {openMenu.category ? ` · ${openMenu.category}` : ""}
          </p>
          {openMenu.description && <p className="mt-2 max-w-prose text-sm">{openMenu.description}</p>}
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Quantities are for {openMenu.serves} people. They scale automatically when you apply
            this menu to a camp with a different headcount.
          </p>
        </div>

        <MenuEditor
          menu={openMenu}
          meals={menuMeals}
          items={menuItems}
          food={food}
          canEdit={canEdit}
        />
      </div>
    );
  }

  // ---- Library --------------------------------------------------------
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Menus</h1>
          <p className="text-sm text-muted-foreground">
            Reusable meal plans. Apply one to a camp and it works out the shopping.
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
            New menu
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search menus…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={dayFilter} onValueChange={setDayFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any length</SelectItem>
            {dayOptions.map((d) => (
              <SelectItem key={d} value={String(d)}>
                {d} {d === 1 ? "day" : "days"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any type</SelectItem>
            {categoryOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Loading menus…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm text-muted-foreground">
          <ChefHat className="size-5" />
          {presets.length === 0 ? "No menus yet." : "No menus match those filters."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((menu) => {
            const mealCount = meals.filter((m) => m.menu_id === menu.id).length;
            return (
              <div key={menu.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenMenuId(menu.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="font-medium hover:text-primary">{menu.name}</span>
                  </button>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${menu.name}`}
                        onClick={() => {
                          setEditing(menu);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${menu.name}`}
                        onClick={() => setDeleteTarget(menu)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">
                    {menu.day_count} {menu.day_count === 1 ? "day" : "days"}
                  </Badge>
                  {menu.category && <Badge variant="outline">{menu.category}</Badge>}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="size-3" />
                    {menu.serves}
                  </span>
                </div>

                {menu.description && (
                  <p className="text-sm text-muted-foreground">{menu.description}</p>
                )}

                <button
                  type="button"
                  onClick={() => setOpenMenuId(menu.id)}
                  className="mt-auto text-left text-sm text-primary hover:underline"
                >
                  {mealCount === 0
                    ? "Add meals →"
                    : `${mealCount} ${mealCount === 1 ? "meal" : "meals"} →`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit menu" : "New menu"}</DialogTitle>
            <DialogDescription>
              Write the quantities for a typical group size — they scale when you apply it.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="menu-name">Name</Label>
              <Input
                id="menu-name"
                required
                placeholder="Standard weekend camp"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="menu-days">Days</Label>
                <Input
                  id="menu-days"
                  type="number"
                  min={1}
                  required
                  value={form.day_count}
                  onChange={(e) => setForm({ ...form, day_count: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="menu-serves">Feeds</Label>
                <Input
                  id="menu-serves"
                  type="number"
                  min={1}
                  required
                  value={form.serves}
                  onChange={(e) => setForm({ ...form, serves: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="menu-category">Type</Label>
                <Input
                  id="menu-category"
                  list="menu-category-options"
                  placeholder="Camping"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
                <datalist id="menu-category-options">
                  {categoryOptions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="menu-description">Description</Label>
              <Textarea
                id="menu-description"
                placeholder="What it suits, anything to watch for…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editing ? "Save changes" : "Create menu"}
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
              Its meals and ingredients go too. Camps that already used this menu keep their own
              copy — they aren&apos;t affected.
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
