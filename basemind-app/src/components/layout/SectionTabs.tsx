import { NavLink } from "react-router";

import { useFeatures } from "@/context/FeaturesContext";
import type { FeatureKey } from "@/types/database";

export type SectionTab = {
  to: string;
  label: string;
  feature?: FeatureKey;
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
  const { isEnabled } = useFeatures();
  const visible = tabs.filter((tab) => !tab.feature || isEnabled(tab.feature));

  if (visible.length < 2) return null;

  return (
    <div className="-mx-4 mb-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
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

/** The three sections, so the tab lists stay in one place. */
export const EQUIPMENT_TABS: SectionTab[] = [
  { to: "/equipment", label: "Inventory", feature: "equipment" },
  { to: "/loans", label: "Borrowed", feature: "loans" },
];

export const CAMP_TABS: SectionTab[] = [
  { to: "/events", label: "Calendar", feature: "events" },
  { to: "/sites", label: "Sites", feature: "sites" },
  { to: "/forms", label: "Forms", feature: "forms" },
];

export const FOOD_TABS: SectionTab[] = [
  { to: "/food", label: "Food store", feature: "food" },
  { to: "/menus", label: "Menus", feature: "menus" },
];
