import { Outlet, useNavigate, useLocation } from "react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useTheme } from "../context/ThemeContext";
import {
  LayoutDashboard, Package, MapPin, CalendarDays, FileText, MessageSquare,
  FolderOpen, Users, Settings, LogOut, Sun, Moon, Menu, X, Compass, ChevronDown, UsersRound, Eye, EyeOff, ShieldAlert, Brain, Folder
} from "lucide-react";
import { HelpChatBubble } from "./HelpChatBubble";
import logoDark from "figma:asset/e972e34c0ee69793ee19ed90070e9fb5189579f7.png";
import logoLight from "figma:asset/a1d437bdae94a3564f190af7dea31a8623126f40.png";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["Admin", "Group Manager", "Member", "Viewer"], feature: null },
  { path: "/equipment", label: "Equipment", icon: Package, roles: ["Admin", "Group Manager", "Member", "Viewer"], feature: "equipmentTrackingEnabled" },
  { path: "/locations", label: "Camping Locations", icon: MapPin, roles: ["Admin", "Group Manager", "Member", "Viewer"], feature: "campPlanningEnabled" },
  { path: "/camp-planning", label: "Camp Planning", icon: CalendarDays, roles: ["Admin", "Group Manager", "Member", "Viewer"], feature: "campPlanningEnabled" },
  { path: "/reports", label: "Reports", icon: FileText, roles: ["Admin", "Group Manager"], feature: null },
  { path: "/files", label: "File Manager", icon: Folder, roles: ["Admin", "Group Manager", "Member", "Viewer"], feature: "documentManagementEnabled" },
  { path: "/users", label: "User Management", icon: Users, roles: ["Admin"], feature: null },
  { path: "/group-members", label: "Group Members", icon: Users, roles: ["Group Manager"], feature: "groupManagementEnabled" },
  { path: "/groups", label: "Groups", icon: UsersRound, roles: ["Admin"], feature: "groupManagementEnabled" },
  { path: "/settings", label: "Settings", icon: Settings, roles: ["Admin", "Group Manager", "Member", "Viewer"], feature: null },
];

export function Layout() {
  const { currentUser, logout, hasPermission, activeGroupId, switchGroup, mustChangePassword, clearMustChangePassword } = useAuth();
  const { groups, users, setUsers, settings } = useData();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [changePwForm, setChangePwForm] = useState({ newPassword: "", confirmPassword: "" });
  const [changePwError, setChangePwError] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
    }
  }, [currentUser, navigate]);

  // Check if trying to access a disabled feature
  useEffect(() => {
    const currentNavItem = navItems.find((item) => item.path === location.pathname);
    if (currentNavItem?.feature) {
      const isFeatureEnabled = settings.features?.[currentNavItem.feature as keyof typeof settings.features];
      if (!isFeatureEnabled) {
        navigate("/");
      }
    }
  }, [location.pathname, settings.features, navigate]);

  if (!currentUser) {
    return null;
  }

  const handleChangePassword = () => {
    if (changePwForm.newPassword.length < 8) {
      setChangePwError("Password must be at least 8 characters.");
      return;
    }
    if (changePwForm.newPassword !== changePwForm.confirmPassword) {
      setChangePwError("Passwords do not match.");
      return;
    }
    setUsers((prev) => prev.map((u) => u.id === currentUser.id ? { ...u, password: changePwForm.newPassword, mustChangePassword: false } : u));
    clearMustChangePassword();
    setChangePwForm({ newPassword: "", confirmPassword: "" });
    setChangePwError("");
  };

  const visibleNav = navItems.filter((item) => {
    // Check role permission
    if (!hasPermission(item.roles as any)) return false;
    // Check if feature is enabled
    if (item.feature && !settings.features?.[item.feature as keyof typeof settings.features]) {
      return false;
    }
    return true;
  });

  // Groups the user belongs to (Admins see all groups)
  const userGroups = currentUser.role === "Admin"
    ? groups
    : groups.filter((g) => (currentUser.groupIds || []).includes(g.id));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Force change password modal */}
      {mustChangePassword && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-foreground text-lg">Change Your Password</h2>
                <p className="text-xs text-muted-foreground">Your password was recently reset. You must set a new password to continue.</p>
              </div>
            </div>
            {changePwError && <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">{changePwError}</div>}
            <div className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-sm mb-1 text-foreground">New Password</label>
                <div className="relative">
                  <input
                    id="new-password"
                    name="newPassword"
                    type={showNewPw ? "text" : "password"}
                    value={changePwForm.newPassword}
                    onChange={(e) => setChangePwForm({ ...changePwForm, newPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground pr-10"
                    placeholder="Minimum 8 characters"
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1 text-foreground">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    value={changePwForm.confirmPassword}
                    onChange={(e) => setChangePwForm({ ...changePwForm, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground pr-10"
                    placeholder="Re-enter new password"
                  />
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button onClick={handleChangePassword} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border">
          <img src={theme === "light" ? logoLight : logoDark} alt="BaseMind Logo" className="w-9 h-9 rounded-lg object-contain" />
          <div>
            <h2 className="text-sm text-sidebar-foreground leading-tight font-semibold">BaseMind</h2>
            <p className="text-xs text-muted-foreground">{currentUser.role}</p>
          </div>
          <button className="lg:hidden ml-auto text-muted-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Group Switcher */}
        {userGroups.length > 0 && (
          <div className="px-3 pt-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 mb-1 block">Active Group</label>
            <div className="relative">
              <select
                value={activeGroupId}
                onChange={(e) => switchGroup(e.target.value)}
                className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border border-sidebar-border bg-sidebar text-sm text-sidebar-foreground cursor-pointer hover:bg-sidebar-accent transition-colors"
              >
                {(currentUser.role === "Admin" || userGroups.length > 1) && (
                  <option value="all">All Groups</option>
                )}
                {userGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {visibleNav.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate text-sidebar-foreground">{currentUser.name}</p>
              <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent">
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              {theme === "light" ? "Dark" : "Light"}
            </button>
            <button onClick={() => { logout(); navigate("/login"); }} className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm text-destructive hover:bg-sidebar-accent">
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <img src={theme === "light" ? logoLight : logoDark} alt="BaseMind" className="w-7 h-7 object-contain" />
          <h2 className="text-sm text-foreground font-semibold">BaseMind</h2>
        </header>
        <div className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
      <HelpChatBubble />
    </div>
  );
}