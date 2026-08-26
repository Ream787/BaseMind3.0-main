import { NavLink } from "react-router";

import { useFeatures } from "@/context/FeaturesContext";
import { useLab } from "@/context/LabContext";
import type { FeatureKey } from "@/types/database";
import type { LabFeatureKey } from "@/types/lab";

export type SectionTab = {
  to: string;
  label: string;
  /** Gated on the app's own switches, in public.feature_flags. */
  feature?: FeatureKey;
  /**
   * Gated on the lab schema's switches instead. A tab with this set also
   * disappears when the lab schema isn't installed at all, which is what
   * keeps a stock BaseMind looking exactly like a stock BaseMind.
   */
  labFeature?: LabFeatureKey;
};

/**
 * Tab strip for pages that belong to the same section.
 *
 * Related pages used to be separate top-level destinations, which made the nav
 * too long to fit a phone. Grouping them here keeps every URL working — these
 * are ordinary links, not local state — while the main nav stays short.
 *
 * A single remaining tab renders nothing: a lone tab is just noise.
 */
export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const visible = useVisibleTabs(tabs);

  if (visible.length < 2) return null;

  return (
    // On a phone the strip sits directly under the header: -mt-4 cancels the
    // whole of main's top padding, which was dead space you had to scroll past
    // on every visit. From sm up there is room to spare, so it stays.
    <div className="-mx-4 -mt-4 mb-2 overflow-x-auto px-4 sm:mx-0 sm:mt-0 sm:px-0">
      <nav className="flex w-max min-w-full gap-1 border-b">
        {visible.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              `-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/**
 * Which of a section's tabs this group can actually see.
 *
 * Shared with the header and the bottom bar so a section, its tabs and the
 * page it lands on can never disagree about what exists.
 */
export function useVisibleTabs(tabs: SectionTab[]) {
  const { isEnabled } = useFeatures();
  const lab = useLab();

  return tabs.filter((tab) => {
    if (tab.feature && !isEnabled(tab.feature)) return false;
    if (tab.labFeature && !lab.isEnabled(tab.labFeature)) return false;
    return true;
  });
}

/** The sections, so the tab lists stay in one place. */
export const EQUIPMENT_TABS: SectionTab[] = [
  { to: "/equipment", label: "Inventory", feature: "equipment" },
  { to: "/loans", label: "Borrowed", feature: "loans" },
  { to: "/maintenance", label: "Repairs", labFeature: "maintenance" },
  { to: "/stocktake", label: "Stocktake", labFeature: "maintenance" },
  { to: "/wishlist", label: "Wishlist", labFeature: "wishlist" },
];

export const CAMP_TABS: SectionTab[] = [
  { to: "/events", label: "Calendar", feature: "events" },
  { to: "/sites", label: "Sites", feature: "sites" },
  { to: "/tasks", label: "To do", labFeature: "tasks" },
  { to: "/duties", label: "Duties", labFeature: "duties" },
  { to: "/money", label: "Money", labFeature: "money" },
  { to: "/risk", label: "Risk", labFeature: "risk" },
  { to: "/reviews", label: "Reviews", labFeature: "reviews" },
  { to: "/forms", label: "Forms", feature: "forms" },
  { to: "/policies", label: "Policies", feature: "policies" },
];

export const FOOD_TABS: SectionTab[] = [
  { to: "/food", label: "Food store", feature: "food" },
  { to: "/menus", label: "Menus", feature: "menus" },
];

/** The young people, and everything that is about them. */
export const GROUP_TABS: SectionTab[] = [
  { to: "/members", label: "Members", labFeature: "members" },
  { to: "/attendance", label: "Attendance", labFeature: "attendance" },
  { to: "/progression", label: "Progression", labFeature: "progression" },
  { to: "/points", label: "Points", labFeature: "points" },
  { to: "/programme", label: "Programme", labFeature: "programme" },
  { to: "/activities", label: "Activities", labFeature: "programme" },
];

/** Everything the group says to each other. */
export const BOARD_TABS: SectionTab[] = [
  { to: "/noticeboard", label: "Notices", labFeature: "noticeboard" },
  { to: "/chat", label: "Chat", labFeature: "chat" },
  { to: "/polls", label: "Polls", labFeature: "polls" },
  { to: "/gallery", label: "Gallery", labFeature: "gallery" },
];

export const TOOLKIT_TABS: SectionTab[] = [
  { to: "/toolkit", label: "Tools", labFeature: "toolkit" },
  { to: "/kitlists", label: "Kit lists", labFeature: "kitlists" },
];
