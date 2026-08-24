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
  ShoppingBasket,
  Sun,
  Users,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
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

const navItems: { to: string; label: string; icon: typeof Package; roles?: Role[] }[] = [
  { to: "/equipment", label: "Equipment", icon: Package },
  { to: "/loans", label: "Borrowed", icon: HandCoins },
  { to: "/events", label: "Calendar", icon: CalendarDays },
  { to: "/sites", label: "Sites", icon: MapPin },
  { to: "/menus", label: "Menus", icon: ChefHat },
  { to: "/food", label: "Food", icon: ShoppingBasket },
  { to: "/forms", label: "Forms", icon: FileText },
  { to: "/users", label: "Users", icon: Users, roles: ["Admin"] },
];

export function AppLayout() {
  const { session, profile, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

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
    (item) => !item.roles || item.roles.includes(profile.role),
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
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold text-primary">BaseMind</span>
          <nav className="flex items-center gap-1">
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
        <div className="flex items-center gap-3">
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
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
