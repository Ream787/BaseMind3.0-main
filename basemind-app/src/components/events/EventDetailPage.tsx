import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useOffline } from "@/context/OfflineContext";
import { useWritePermissions } from "@/lib/useWritePermissions";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { buildClaims, buildFoodPlan, roundQuantity, toShoppingList } from "@/lib/shoppingList";
import { todayISO } from "@/lib/loans";
import { aggregateMenuRequirements, mealsByDay, mergeRequirements } from "@/lib/menus";
import { downloadCampPlanPdf, formatDateRange } from "@/lib/campPlanPdf";
import { EventMenuSection } from "@/components/menus/EventMenuSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
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
import { EventFormDialog } from "@/components/events/EventFormDialog";
import { SafetyPlanSection } from "@/components/safety/SafetyPlanSection";

export function EventDetailPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { addRow } = useOffline();

  const { rows: events, loading: eventsLoading } = useRealtimeTable("events");
  const { rows: sites } = useRealtimeTable("camping_sites", { orderBy: "name" });
  const { rows: equipment } = useRealtimeTable("equipment", { orderBy: "name" });
  const { rows: foodStock } = useRealtimeTable("food_items", { orderBy: "name" });
  const { rows: eventEquipment } = useRealtimeTable("event_equipment");
  const { rows: eventFood } = useRealtimeTable("event_food");
  const { rows: allMenus } = useRealtimeTable("menus", { orderBy: "name" });
  const { rows: allMeals } = useRealtimeTable("menu_meals");
  const { rows: allMealItems } = useRealtimeTable("menu_meal_items");
  const { rows: safetyPlans } = useRealtimeTable("safety_plans");
  const { rows: safetyScenarios } = useRealtimeTable("safety_scenarios");

  const [editOpen, setEditOpen] = useState(false);
  const [addEquipmentId, setAddEquipmentId] = useState("");
  const [addEquipmentQty, setAddEquipmentQty] = useState("1");
  const [addFoodId, setAddFoodId] = useState("");
  const [addFoodQty, setAddFoodQty] = useState("1");
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { canAdd, canEdit, canDelete, blockedByOffline } = useWritePermissions();

  const event = events.find((e) => e.id === eventId) ?? null;
  const site = event?.site_id ? (sites.find((s) => s.id === event.site_id) ?? null) : null;

  const equipmentById = useMemo(() => new Map(equipment.map((e) => [e.id, e])), [equipment]);

  const packing = useMemo(
    () =>
      eventEquipment
        .filter((row) => row.event_id === eventId)
        .map((row) => {
          const item = equipmentById.get(row.equipment_id);
          return item ? { rowId: row.id, equipment: item, quantity: row.quantity } : null;
        })
        .filter((l): l is { rowId: string; equipment: (typeof equipment)[number]; quantity: number } => l !== null)
        .sort((a, b) => a.equipment.name.localeCompare(b.equipment.name, undefined, { sensitivity: "base" })),
    [eventEquipment, eventId, equipmentById],
  );

  const menu = useMemo(
    () => allMenus.find((m) => m.event_id === eventId) ?? null,
    [allMenus, eventId],
  );
  const menuPresets = useMemo(() => allMenus.filter((m) => m.event_id === null), [allMenus]);
  const safetyPlan = useMemo(
    () => safetyPlans.find((p) => p.event_id === eventId) ?? null,
    [safetyPlans, eventId],
  );
  const planScenarios = useMemo(
    () => (safetyPlan ? safetyScenarios.filter((s) => s.safety_plan_id === safetyPlan.id) : []),
    [safetyScenarios, safetyPlan],
  );
  const menuMeals = useMemo(
    () => (menu ? allMeals.filter((m) => m.menu_id === menu.id) : []),
    [allMeals, menu],
  );
  const menuItems = useMemo(
    () => allMealItems.filter((i) => menuMeals.some((m) => m.id === i.meal_id)),
    [allMealItems, menuMeals],
  );

  // Stock other upcoming camps have already spoken for. Past camps release
  // their claim — their food has been eaten, or was never bought.
  const claims = useMemo(() => {
    const today = todayISO();
    const upcomingOthers = events.filter(
      (e) => e.id !== eventId && (e.end_date ?? e.start_date) >= today,
    );

    const otherRequirements = upcomingOthers.flatMap((other) => {
      const otherMenu = allMenus.find((m) => m.event_id === other.id);
      const otherMeals = otherMenu ? allMeals.filter((m) => m.menu_id === otherMenu.id) : [];
      const otherItems = allMealItems.filter((i) => otherMeals.some((m) => m.id === i.meal_id));
      const fromMenu = aggregateMenuRequirements(otherMeals, otherItems);
      const manual = eventFood.filter((row) => row.event_id === other.id);

      return mergeRequirements(fromMenu, manual).map((req) => ({
        eventName: other.name,
        food_item_id: req.food_item_id,
        quantity: req.quantity,
      }));
    });

    return buildClaims(otherRequirements);
  }, [events, eventId, allMenus, allMeals, allMealItems, eventFood]);

  // The camp menu's quantities were already scaled when the menu was applied,
  // so no further scaling here — roll the meals up, add anything entered by
  // hand, then measure against stock other camps haven't already claimed.
  const foodPlan = useMemo(() => {
    const fromMenu = aggregateMenuRequirements(menuMeals, menuItems);
    const manual = eventFood.filter((row) => row.event_id === eventId);
    return buildFoodPlan(mergeRequirements(fromMenu, manual), foodStock, claims);
  }, [menuMeals, menuItems, eventFood, eventId, foodStock, claims]);

  const shopping = useMemo(() => toShoppingList(foodPlan), [foodPlan]);

  /** Ingredients that come from the menu can't be edited as standalone rows. */
  const manualFoodIds = useMemo(
    () =>
      new Set(
        eventFood.filter((row) => row.event_id === eventId).map((row) => row.food_item_id),
      ),
    [eventFood, eventId],
  );

  const unusedEquipment = useMemo(
    () => equipment.filter((e) => !packing.some((p) => p.equipment.id === e.id)),
    [equipment, packing],
  );
  const unusedFood = useMemo(
    () => foodStock.filter((f) => !foodPlan.some((p) => p.foodItemId === f.id)),
    [foodStock, foodPlan],
  );

  if (eventsLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Loading event…
      </div>
    );
  }
  if (!event) return <Navigate to="/events" replace />;

  async function addEquipment() {
    if (!addEquipmentId) return;
    const { error } = await addRow("event_equipment", {
      event_id: event!.id,
      equipment_id: addEquipmentId,
      quantity: Math.max(1, Number(addEquipmentQty) || 1),
    });
    if (error) toast.error(error);
    else {
      setAddEquipmentId("");
      setAddEquipmentQty("1");
    }
  }

  async function updateEquipmentQty(rowId: string, quantity: number) {
    if (quantity < 1) return;
    const { error } = await supabase
      .from("event_equipment")
      .update({ quantity })
      .eq("id", rowId);
    if (error) toast.error(error.message);
  }

  async function removeEquipment(rowId: string) {
    const { error } = await supabase.from("event_equipment").delete().eq("id", rowId);
    if (error) toast.error(error.message);
  }

  async function addFood() {
    if (!addFoodId) return;
    const { error } = await addRow("event_food", {
      event_id: event!.id,
      food_item_id: addFoodId,
      quantity: Math.max(0, Number(addFoodQty) || 0),
    });
    if (error) toast.error(error);
    else {
      setAddFoodId("");
      setAddFoodQty("1");
    }
  }

  async function updateFoodQty(rowId: string, quantity: number) {
    const { error } = await supabase
      .from("event_food")
      .update({ quantity: Math.max(0, quantity) })
      .eq("id", rowId);
    if (error) toast.error(error.message);
  }

  async function removeFood(rowId: string) {
    const { error } = await supabase.from("event_food").delete().eq("id", rowId);
    if (error) toast.error(error.message);
  }

  async function deleteEvent() {
    setDeleting(true);
    const { error } = await supabase.from("events").delete().eq("id", event!.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${event!.name} deleted`);
    navigate("/events", { replace: true });
  }

  async function exportPdf() {
    setExporting(true);
    try {
      await downloadCampPlanPdf({
        event: event!,
        site,
        menuName: menu?.name ?? null,
        menuDays: mealsByDay(menuMeals).map(({ day, meals: dayMeals }) => ({
          day,
          meals: dayMeals.map((m) => ({ slot: m.meal_slot, name: m.name, notes: m.notes })),
        })),
        packing: packing.map(({ equipment: item, quantity }) => ({ equipment: item, quantity })),
        foodPlan,
        shopping,
      });
      toast.success("Camp plan downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate the PDF");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/events"
            className="mb-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Calendar
          </Link>
          <h1>{event.name}</h1>
          <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0" />
              {formatDateRange(event)}
            </span>
            {site && (
              <>
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 shrink-0" />
                  {site.name}
                </span>
                {site.phone && (
                  <a
                    href={`tel:${site.phone}`}
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <Phone className="size-3.5 shrink-0" />
                    {site.phone}
                  </a>
                )}
              </>
            )}
          </div>
          {event.notes && <p className="mt-2 max-w-prose text-sm">{event.notes}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPdf} disabled={exporting}>
            <Download className="size-4" />
            {exporting ? "Preparing…" : "Download plan"}
          </Button>
          {canEdit && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              aria-label="Delete camp"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {blockedByOffline && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          You&apos;re offline. You can still add things to this camp — they&apos;ll sync when
          you&apos;re back. Changing or removing what&apos;s already here waits until then, so
          nobody else&apos;s edits get overwritten.
        </p>
      )}

      {/* ---- Equipment ---------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-medium">Equipment to pack</h2>
          <span className="text-sm text-muted-foreground">
            {packing.length} {packing.length === 1 ? "item" : "items"}
          </span>
        </div>

        {canAdd && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1">
              <Select value={addEquipmentId} onValueChange={setAddEquipmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose equipment…" />
                </SelectTrigger>
                <SelectContent>
                  {unusedEquipment.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Everything is already on the list
                    </div>
                  ) : (
                    unusedEquipment.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.location})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Input
              type="number"
              min={1}
              className="w-24"
              aria-label="Quantity"
              value={addEquipmentQty}
              onChange={(e) => setAddEquipmentQty(e.target.value)}
            />
            <Button onClick={addEquipment} disabled={!addEquipmentId}>
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        )}

        {packing.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No equipment on this list yet.
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Stored in</TableHead>
                  <TableHead>Condition</TableHead>
                  {canEdit && <TableHead className="text-right">Remove</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {packing.map((line) => (
                  <TableRow key={line.rowId}>
                    <TableCell>
                      {canEdit ? (
                        <Input
                          type="number"
                          min={1}
                          className="h-8 w-20"
                          aria-label={`Quantity of ${line.equipment.name}`}
                          value={line.quantity}
                          onChange={(e) =>
                            updateEquipmentQty(line.rowId, Number(e.target.value) || 1)
                          }
                        />
                      ) : (
                        line.quantity
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{line.equipment.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {line.equipment.location}
                    </TableCell>
                    <TableCell>
                      {line.equipment.condition === "Good" ? (
                        <span className="text-muted-foreground">Good</span>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                        >
                          {line.equipment.condition}
                        </Badge>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${line.equipment.name}`}
                          onClick={() => removeEquipment(line.rowId)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <EventMenuSection
        event={event}
        menu={menu}
        meals={menuMeals}
        items={menuItems}
        presets={menuPresets}
        food={foodStock}
        canEdit={canEdit}
      />

      {/* ---- Food --------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-medium">Food needed</h2>
          <Link to="/food" className="text-sm text-primary hover:underline">
            Manage food store
          </Link>
        </div>

        {canAdd && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1">
              <Select value={addFoodId} onValueChange={setAddFoodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose food…" />
                </SelectTrigger>
                <SelectContent>
                  {unusedFood.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Nothing left to add
                    </div>
                  ) : (
                    unusedFood.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.unit})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Input
              type="number"
              min={0}
              step="any"
              className="w-24"
              aria-label="Quantity needed"
              value={addFoodQty}
              onChange={(e) => setAddFoodQty(e.target.value)}
            />
            <Button onClick={addFood} disabled={!addFoodId}>
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        )}

        {foodPlan.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No food planned yet.
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-32">Needed</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>To buy</TableHead>
                  {canEdit && <TableHead className="text-right">Remove</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {foodPlan.map((line) => {
                  const fromMenu = !manualFoodIds.has(line.foodItemId);
                  return (
                  <TableRow key={line.eventFoodId}>
                    <TableCell className="font-medium">
                      {line.name}
                      {fromMenu && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          from menu
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canEdit && !fromMenu ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            className="h-8 w-20"
                            aria-label={`Quantity of ${line.name} needed`}
                            value={line.needed}
                            onChange={(e) =>
                              updateFoodQty(line.eventFoodId, Number(e.target.value) || 0)
                            }
                          />
                          <span className="text-sm text-muted-foreground">{line.unit}</span>
                        </div>
                      ) : (
                        `${roundQuantity(line.needed)} ${line.unit}`
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {roundQuantity(line.availableToUs)} {line.unit}
                      {line.claimedElsewhere > 0 && (
                        <span
                          className="block text-xs"
                          title={`${roundQuantity(line.inStock)} ${line.unit} in the store; ${roundQuantity(line.claimedElsewhere)} claimed by ${line.claimedBy.join(", ")}`}
                        >
                          {roundQuantity(line.claimedElsewhere)} claimed by{" "}
                          {line.claimedBy.join(", ")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {line.toBuy > 0 ? (
                        <span className="font-medium text-primary">
                          {roundQuantity(line.toBuy)} {line.unit}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Covered</span>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        {fromMenu ? (
                          <span className="text-xs text-muted-foreground">edit in menu</span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${line.name}`}
                            onClick={() => removeFood(line.eventFoodId)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ---- Shopping list ------------------------------------------------ */}
      {shopping.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 font-medium">
            <ShoppingCart className="size-4 text-primary" />
            Shopping list
          </h2>
          <p className="text-sm text-muted-foreground">
            What the food store doesn&apos;t cover. Included on the downloaded plan.
          </p>
          <ul className="divide-y rounded-lg border">
            {shopping.map((line) => (
              <li key={line.eventFoodId} className="flex items-center justify-between gap-3 p-3">
                <span className="font-medium">{line.name}</span>
                <span className="text-sm">
                  {roundQuantity(line.toBuy)} {line.unit}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SafetyPlanSection
        event={event}
        site={site}
        plan={safetyPlan}
        scenarios={planScenarios}
        canEdit={canEdit}
      />

      <EventFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        event={event}
        sites={sites}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {event.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its menu, packing list and food plan go with it, and any food it had claimed is
              released back to other camps. Equipment, sites and the food store are untouched.
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteEvent} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete camp"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
