import { Navigate, Outlet, NavLink, useLocation } from "react-router";
import {
  CalendarDays,
  LogOut,
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
import { useFeatures } from "@/context/FeaturesContext";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/users/UserAvatar";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import {
  CAMP_TABS,
  EQUIPMENT_TABS,
  FOOD_TABS,
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
 * Three sections, not eight destinations. Related pages are tabs within a
 * section rather than each taking a slot in the bar — eight items never
 * fitted a phone, and on a narrow desktop the last one was clipped.
 *
 * A section's tabs are its source of truth, so it survives as long as any one
 * of them is switched on. Gating a section on a single feature meant turning
 * off Food also hid Menus, which sits in the same section but has its own
 * switch.
 *
 * Admin isn't here on purpose: settings belong in the header, permanently
 * visible, not buried behind an overflow menu.
 */
const primaryNav: { label: string; icon: typeof Package; tabs: SectionTab[] }[] = [
  { label: "Equipment", icon: Package, tabs: EQUIPMENT_TABS },
  { label: "Camps", icon: CalendarDays, tabs: CAMP_TABS },
  { label: "Food", icon: ShoppingBasket, tabs: FOOD_TABS },
];

export function AppLayout() {
  const { session, profile, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isEnabled } = useFeatures();
  const location = useLocation();

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

  // A section appears if any of its tabs is switched on, and points at the
  // first one that is — so turning off Food still leaves Menus reachable.
  const primary = primaryNav
    .map((section) => {
      const tabs = section.tabs.filter((tab) => !tab.feature || isEnabled(tab.feature));
      return { ...section, tabs, to: tabs[0]?.to };
    })
    .filter((section): section is typeof section & { to: string } => !!section.to);

  /** A section stays lit while you're on any of its available tabs. */
  const isSectionActive = (section: { tabs: SectionTab[] }) =>
    section.tabs.some(
      (tab) =>
        location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`),
    );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-6">
          <span className="shrink-0 text-lg font-semibold text-primary">BaseMind</span>
          {/* On phones this row is hidden and the bottom bar takes over —
              easier to reach one-handed. */}
          <nav className="hidden items-center gap-1 md:flex">
            {primary.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isSectionActive(item)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
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

      {/* Three wide targets rather than a row that scrolls off the edge. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        {primary.map((item) => (
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
      </nav>
    </div>
  );
}
