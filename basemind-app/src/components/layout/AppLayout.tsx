import { Navigate, Outlet, NavLink } from "react-router";
import {
  CalendarDays,
  ChefHat,
  FileText,
  HandCoins,
  LogOut,
  MapPin,
  Moon,
  MoreHorizontal,
  Package,
  Settings,
  ShoppingBasket,
  Sun,
  Users,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useFeatures } from "@/context/FeaturesContext";
import type { FeatureKey } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Role } from "@/types/database";

/** Desktop overflow menu for the less-used sections. */
function MoreMenu({ items }: { items: NavItem[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
        <MoreHorizontal className="size-4" />
        More
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {items.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <NavLink to={item.to} className="flex items-center gap-2">
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type NavItem = {
  to: string;
  label: string;
  icon: typeof Package;
  roles?: Role[];
  feature?: FeatureKey;
};

/**
 * Split so the bar never overflows.
 *
 * Everything in one row meant eight items scrolling off a phone and, on a
 * narrower desktop window, the last item (Admin) being clipped out of sight
 * entirely. Four primary items plus a More menu fits a 375px screen exactly.
 */
const primaryNav: NavItem[] = [
  { to: "/equipment", label: "Equipment", icon: Package, feature: "equipment" },
  { to: "/events", label: "Camps", icon: CalendarDays, feature: "events" },
  { to: "/loans", label: "Borrowed", icon: HandCoins, feature: "loans" },
  { to: "/food", label: "Food", icon: ShoppingBasket, feature: "food" },
];

const secondaryNav: NavItem[] = [
  { to: "/menus", label: "Menus", icon: ChefHat, feature: "menus" },
  { to: "/sites", label: "Sites", icon: MapPin, feature: "sites" },
  { to: "/forms", label: "Forms", icon: FileText, feature: "forms" },
  { to: "/users", label: "Users", icon: Users, roles: ["Admin"] },
  { to: "/admin", label: "Admin", icon: Settings, roles: ["Admin"] },
];

export function AppLayout() {
  const { session, profile, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isEnabled } = useFeatures();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (!profile || profile.status !== "Active") return <Navigate to="/pending" replace />;

  const canSee = (item: NavItem) =>
    (!item.roles || item.roles.includes(profile.role)) &&
    (!item.feature || isEnabled(item.feature));

  const primary = primaryNav.filter(canSee);
  const secondary = secondaryNav.filter(canSee);

  const initials =
    profile.name.trim().length > 0
      ? profile.name
          .split(" ")
          .filter(Boolean)
          .map((part) => part[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      : profile.email[0]?.toUpperCase();

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
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
            {secondary.length > 0 && <MoreMenu items={secondary} />}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-md p-1 hover:bg-accent">
                <Avatar className="size-8">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
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

      {/* Fixed count, so nothing ever scrolls off the edge. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        {primary.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            <item.icon className="size-5" />
            <span className="max-w-full truncate">{item.label}</span>
          </NavLink>
        ))}
        {secondary.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium text-muted-foreground">
              <MoreHorizontal className="size-5" />
              More
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="mb-1">
              {secondary.map((item) => (
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
