import { Navigate, Outlet, NavLink, useLocation } from "react-router";
import {
  CalendarDays,
  Hammer,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MoreHorizontal,
  Moon,
  Package,
  Settings,
  ShoppingBasket,
  Sun,
  UserCog,
  Users,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useLab } from "@/context/LabContext";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/users/UserAvatar";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { CommandPalette } from "@/components/layout/CommandPalette";
import {
  BOARD_TABS,
  CAMP_TABS,
  EQUIPMENT_TABS,
  FOOD_TABS,
  GROUP_TABS,
  TOOLKIT_TABS,
  useVisibleTabs,
  type SectionTab,
} from "@/components/layout/SectionTabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Sections, not destinations. Related pages are tabs within a section rather
 * than each taking a slot in the bar — eight items never fitted a phone, and
 * on a narrow desktop the last one was clipped.
 *
 * A section's tabs are its source of truth, so it survives as long as any one
 * of them is switched on. Gating a section on a single feature meant turning
 * off Food also hid Menus, which sits in the same section but has its own
 * switch.
 *
 * With the lab schema installed there are seven sections rather than three,
 * which is past what a phone's bottom bar can hold. The first four get a slot
 * each and the rest go behind "More" — chosen by what gets opened at a camp,
 * not alphabetically. On a desktop they all fit, with the labels dropping to
 * icons between medium and large.
 *
 * Admin isn't here on purpose: settings belong in the header, permanently
 * visible, not buried behind an overflow menu.
 */
type Section = {
  label: string;
  icon: typeof Package;
  tabs: SectionTab[];
  /** Sections without tabs of their own — the dashboard — link straight here. */
  to?: string;
};

const SECTIONS: Section[] = [
  { label: "Home", icon: LayoutDashboard, tabs: [], to: "/dashboard" },
  { label: "Equipment", icon: Package, tabs: EQUIPMENT_TABS },
  { label: "Camps", icon: CalendarDays, tabs: CAMP_TABS },
  { label: "Food", icon: ShoppingBasket, tabs: FOOD_TABS },
  { label: "Group", icon: Users, tabs: GROUP_TABS },
  { label: "Board", icon: Megaphone, tabs: BOARD_TABS },
  { label: "Toolkit", icon: Hammer, tabs: TOOLKIT_TABS },
];

/** How many sections get their own slot on a phone before "More" takes over. */
const PHONE_SLOTS = 4;

export function AppLayout() {
  const { session, profile, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  // Hooks must run in the same order every render, so each section's tabs
  // are resolved unconditionally here rather than inside a loop.
  const equipmentTabs = useVisibleTabs(EQUIPMENT_TABS);
  const campTabs = useVisibleTabs(CAMP_TABS);
  const foodTabs = useVisibleTabs(FOOD_TABS);
  const groupTabs = useVisibleTabs(GROUP_TABS);
  const boardTabs = useVisibleTabs(BOARD_TABS);
  const toolkitTabs = useVisibleTabs(TOOLKIT_TABS);
  const lab = useLab();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (!profile || profile.status !== "Active") return <Navigate to="/pending" replace />;

  const isAdmin = profile.role === "Admin";

  const resolved: Record<string, SectionTab[]> = {
    Equipment: equipmentTabs,
    Camps: campTabs,
    Food: foodTabs,
    Group: groupTabs,
    Board: boardTabs,
    Toolkit: toolkitTabs,
  };

  // A section appears if any of its tabs is switched on, and points at the
  // first one that is — so turning off Food still leaves Menus reachable.
  // Home is the exception: it has no tabs, and it is hidden along with the
  // rest of the lab when the schema isn't installed.
  const sections = SECTIONS.map((section) => {
    if (section.to) {
      return { ...section, tabs: [], to: lab.isEnabled("dashboard") ? section.to : undefined };
    }
    const tabs = resolved[section.label] ?? [];
    return { ...section, tabs, to: tabs[0]?.to };
  }).filter((section): section is Section & { to: string } => !!section.to);

  /** A section stays lit while you're on any of its available tabs. */
  const isSectionActive = (section: { to: string; tabs: SectionTab[] }) =>
    section.tabs.length === 0
      ? location.pathname === section.to
      : section.tabs.some(
          (tab) => location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`),
        );

  const phoneSections = sections.slice(0, PHONE_SLOTS);
  const overflowSections = sections.slice(PHONE_SLOTS);

  return (
    <div className="flex min-h-screen flex-col">
      {/* py-1.5 on phones rather than py-3: the row is already as tall as its
          32px controls, and the extra padding only pushed the page down. */}
      <header className="flex items-center justify-between gap-2 border-b px-4 py-1.5 sm:py-3">
        {/* gap-4 rather than gap-6: seven sections plus the header's own
            controls do not fit at the wider gap on a small laptop. */}
        <div className="flex min-w-0 items-center gap-4">
          <span className="shrink-0 text-lg font-semibold text-primary">BaseMind</span>
          {/* On phones this row is hidden and the bottom bar takes over —
              easier to reach one-handed. */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {sections.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors lg:px-3 ${
                  isSectionActive(item)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <item.icon className="size-4 shrink-0" />
                {/* Labels are dropped between md and lg, where seven of them
                    would push the header's own controls off the end. */}
                <span className="hidden lg:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <CommandPalette />
          {/* Settings live in the header, not in the nav: always in the same
              place on every screen size, and never pushed off the end. */}
          {isAdmin && (
            <Button variant="ghost" size="icon" asChild aria-label="Admin settings">
              <NavLink
                to="/admin"
                className={({ isActive }) => (isActive ? "text-primary" : undefined)}
              >
                <Settings className="size-4" />
              </NavLink>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-md p-1 hover:bg-accent">
                <UserAvatar user={profile} size="sm" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{profile.name || profile.email}</span>
                  <span className="text-xs font-normal text-muted-foreground">{profile.role}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <NavLink to="/profile" className="flex items-center gap-2">
                  <UserCog className="size-4" />
                  Your profile
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isAdmin && (
                <>
                  <DropdownMenuItem asChild>
                    <NavLink to="/users" className="flex items-center gap-2">
                      <Users className="size-4" />
                      Manage users
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <NavLink to="/admin" className="flex items-center gap-2">
                      <Settings className="size-4" />
                      Admin settings
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onSelect={() => logout()}>
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <OfflineBanner />

      {/* pb-20 on mobile keeps content clear of the fixed bottom bar. */}
      <main className="flex-1 p-4 pb-20 sm:p-6 md:pb-6">
        <Outlet />
      </main>

      {/* Wide targets rather than a row that scrolls off the edge. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        {phoneSections.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={`flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-xs font-medium transition-colors ${
              isSectionActive(item) ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <item.icon className="size-5" />
            <span className="max-w-full truncate">{item.label}</span>
          </NavLink>
        ))}

        {overflowSections.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-xs font-medium transition-colors ${
                  overflowSections.some(isSectionActive)
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <MoreHorizontal className="size-5" />
                <span>More</span>
              </button>
            </DropdownMenuTrigger>
            {/* Opens upwards: it is the bottom of the screen. */}
            <DropdownMenuContent side="top" align="end" className="mb-2">
              {overflowSections.map((item) => (
                <DropdownMenuItem key={item.to} asChild>
                  <NavLink to={item.to} className="flex items-center gap-2">
                    <item.icon className="size-4" />
                    {item.label}
                  </NavLink>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </nav>
    </div>
  );
}
