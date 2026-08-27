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

/** The three sections, so the tab lists stay in one place. */
export const EQUIPMENT_TABS: SectionTab[] = [
  { to: "/equipment", label: "Inventory", feature: "equipment" },
  { to: "/boxes", label: "Boxes", feature: "equipment" },
  { to: "/loans", label: "Borrowed", feature: "loans" },
];

export const CAMP_TABS: SectionTab[] = [
  { to: "/events", label: "Calendar", feature: "events" },
  { to: "/sites", label: "Sites", feature: "sites" },
  { to: "/forms", label: "Forms", feature: "forms" },
];

/**
 * The assistant is its own section, not a tab under Camps.
 *
 * It answers about anything the group has written down — safety, transport,
 * money, behaviour — so filing it under camps put it somewhere nobody would
 * look for the answer to "what do I do about a photo consent form".
 */
export const ASSISTANT_TABS: SectionTab[] = [
  { to: "/assistant", label: "Ask", feature: "policies" },
  { to: "/policies", label: "Documents", feature: "policies" },
];

export const FOOD_TABS: SectionTab[] = [
  { to: "/food", label: "Food store", feature: "food" },
  { to: "/menus", label: "Menus", feature: "menus" },
];
