import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Backpack,
  CalendarDays,
  CornerDownLeft,
  MapPin,
  Package,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { useLabTable } from "@/lib/lab/useLabTable";
import { useLab } from "@/context/LabContext";
import { useFeatures } from "@/context/FeaturesContext";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  BOARD_TABS,
  CAMP_TABS,
  EQUIPMENT_TABS,
  FOOD_TABS,
  GROUP_TABS,
  TOOLKIT_TABS,
  useVisibleTabs,
} from "@/components/layout/SectionTabs";

/**
 * Search everything, from anywhere.
 *
 * The app has grown from six pages to nearly thirty, and past about a
 * dozen the nav stops being a way of finding things and starts being a
 * list you read. This is the answer to "where was that": one keystroke,
 * type three letters of what you remember, press enter.
 *
 * It searches destinations *and* data, because "sites" and "Bluebell
 * Wood" are the same intention, and which one somebody remembers is not
 * something the app gets to choose.
 */

type Item = {
  id: string;
  label: string;
  hint?: string;
  to: string;
  group: string;
  icon: typeof Package;
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Cmd+K on a Mac, Ctrl+K everywhere else — the shortcut every
      // other search box in every other app already uses.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((was) => !was);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      {/* The button matters as much as the shortcut: most people will
          never learn ⌘K, and the ones who do do not need the button. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent sm:px-3"
        aria-label="Search everything"
      >
        <Search className="size-4" />
        <span className="hidden lg:inline">Search…</span>
        <kbd className="hidden rounded border bg-muted px-1 text-xs lg:inline">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[10%] max-h-[80vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">
            Search pages, equipment, members, camps, sites and activities.
          </DialogDescription>
          {/* Mounted only while open, so none of the tables below are
              fetched on pages that never open the palette. */}
          {open && <PaletteContents onClose={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PaletteContents({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const lab = useLab();
  const { isEnabled } = useFeatures();
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const destinations = [
    ...useVisibleTabs(EQUIPMENT_TABS),
    ...useVisibleTabs(CAMP_TABS),
    ...useVisibleTabs(FOOD_TABS),
    ...useVisibleTabs(GROUP_TABS),
    ...useVisibleTabs(BOARD_TABS),
    ...useVisibleTabs(TOOLKIT_TABS),
  ];

  const { rows: equipment } = useRealtimeTable("equipment", { orderBy: "name" });
  const { rows: events } = useRealtimeTable("events", { orderBy: "start_date", ascending: false });
  const { rows: sites } = useRealtimeTable("camping_sites", { orderBy: "name" });
  const { rows: members } = useLabTable("members", {
    orderBy: "first_name",
    enabled: lab.isEnabled("members"),
  });
  const { rows: activities } = useLabTable("activities", {
    orderBy: "name",
    enabled: lab.isEnabled("programme"),
  });

  const items: Item[] = useMemo(() => {
    const list: Item[] = [
      { id: "nav:/dashboard", label: "Dashboard", to: "/dashboard", group: "Go to", icon: Sparkles },
      ...destinations.map((tab) => ({
        id: `nav:${tab.to}`,
        label: tab.label,
        to: tab.to,
        group: "Go to",
        icon: Sparkles,
      })),
    ];

    if (isEnabled("equipment")) {
      for (const item of equipment) {
        list.push({
          id: `eq:${item.id}`,
          label: item.name,
          hint: [item.location, item.category].filter(Boolean).join(" · "),
          to: "/equipment",
          group: "Equipment",
          icon: Package,
        });
      }
    }

    if (isEnabled("events")) {
      for (const event of events) {
        list.push({
          id: `ev:${event.id}`,
          label: event.name,
          hint: event.start_date,
          to: `/events/${event.id}`,
          group: "Camps",
          icon: CalendarDays,
        });
      }
    }

    if (isEnabled("sites")) {
      for (const site of sites) {
        list.push({
          id: `site:${site.id}`,
          label: site.name,
          hint: site.address ?? undefined,
          to: "/sites",
          group: "Sites",
          icon: MapPin,
        });
      }
    }

    for (const member of members) {
      list.push({
        id: `member:${member.id}`,
        label: `${member.first_name} ${member.last_name}`,
        hint: member.rank ?? undefined,
        to: "/members",
        group: "Members",
        icon: Users,
      });
    }

    for (const activity of activities) {
      list.push({
        id: `act:${activity.id}`,
        label: activity.name,
        hint: `${activity.duration_minutes} min${activity.kind ? ` · ${activity.kind}` : ""}`,
        to: "/activities",
        group: "Activities",
        icon: Backpack,
      });
    }

    return list;
  }, [destinations, equipment, events, sites, members, activities, isEnabled]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    // With nothing typed, show the destinations — the palette should be
    // useful as a menu before it is useful as a search.
    if (!term) return items.filter((item) => item.group === "Go to").slice(0, 12);

    return items
      .filter((item) => `${item.label} ${item.hint ?? ""}`.toLowerCase().includes(term))
      .sort((a, b) => {
        // Things that start with what was typed come first: typing "te"
        // should offer "Tent" before "Water container".
        const aStarts = a.label.toLowerCase().startsWith(term);
        const bStarts = b.label.toLowerCase().startsWith(term);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 30);
  }, [items, query]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  function choose(item: Item | undefined) {
    if (!item) return;
    navigate(item.to);
    onClose();
  }

  return (
    <div className="flex max-h-[80vh] flex-col">
      <div className="flex items-center gap-2 border-b px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pages, kit, people, camps…"
          className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlighted((h) => Math.min(h + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlighted((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(results[highlighted]);
            }
          }}
        />
      </div>

      <ul ref={listRef} className="flex-1 overflow-y-auto p-1">
        {results.length === 0 ? (
          <li className="px-3 py-8 text-center text-sm text-muted-foreground">
            Nothing matches “{query}”.
          </li>
        ) : (
          results.map((item, index) => {
            const showGroup = index === 0 || results[index - 1].group !== item.group;
            return (
              <li key={item.id}>
                {showGroup && (
                  <p className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {item.group}
                  </p>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => choose(item)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm ${
                    index === highlighted ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <item.icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && (
                    <span className="shrink-0 truncate text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  )}
                  {index === highlighted && (
                    <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
