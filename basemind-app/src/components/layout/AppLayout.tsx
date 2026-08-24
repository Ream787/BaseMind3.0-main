import { Navigate, Outlet, NavLink } from "react-router";
import {
  CalendarDays,
  ChefHat,
  FileText,
  HandCoins,
  LogOut,
  MapPin,
  Moon,
  Package,
  Settings,
  ShoppingBasket,
  Sun,
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

const navItems: {
  to: string;
  label: string;
  icon: typeof Package;
  roles?: Role[];
  feature?: FeatureKey;
}[] = [
  { to: "/equipment", label: "Equipment", icon: Package, feature: "equipment" },
  { to: "/loans", label: "Borrowed", icon: HandCoins, feature: "loans" },
  { to: "/events", label: "Calendar", icon: CalendarDays, feature: "events" },
  { to: "/sites", label: "Sites", icon: MapPin, feature: "sites" },
  { to: "/menus", label: "Menus", icon: ChefHat, feature: "menus" },
  { to: "/food", label: "Food", icon: ShoppingBasket, feature: "food" },
  { to: "/forms", label: "Forms", icon: FileText, feature: "forms" },
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

  const visibleNavItems = navItems.filter(
    (item) =>
      (!item.roles || item.roles.includes(profile.role)) &&
      (!item.feature || isEnabled(item.feature)),
  );

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
          {/* Eight items won't fit across a phone. Below md they move into the
              bottom bar, which is easier to reach one-handed anyway. */}
          <nav className="hidden items-center gap-1 md:flex">
            {visibleNavItems.map((item) => (
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

      <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t bg-background md:hidden">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex min-w-16 flex-1 flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-medium transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            <item.icon className="size-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
