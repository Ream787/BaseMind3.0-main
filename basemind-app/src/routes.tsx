import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router";

import { AppLayout } from "@/components/layout/AppLayout";
import { RequireRole } from "@/components/layout/RequireRole";
import { RequireFeature } from "@/components/layout/RequireFeature";
import { RouteError } from "@/components/layout/RouteError";
import type { FeatureKey } from "@/types/database";
import { LoginPage } from "@/components/auth/LoginPage";
import { RegisterPage } from "@/components/auth/RegisterPage";
import { PendingApprovalPage } from "@/components/auth/PendingApprovalPage";
import { EquipmentProvider } from "@/context/EquipmentContext";

// Auth pages stay eagerly loaded — they're the first thing anyone sees, so
// splitting them would only add a spinner to the critical path. Everything
// behind the login is lazy, which keeps the initial download small on a phone
// with camp-grade signal.
const EquipmentPage = lazy(() =>
  import("@/components/equipment/EquipmentPage").then((m) => ({ default: m.EquipmentPage })),
);
const LoansPage = lazy(() =>
  import("@/components/loans/LoansPage").then((m) => ({ default: m.LoansPage })),
);
const EventsPage = lazy(() =>
  import("@/components/events/EventsPage").then((m) => ({ default: m.EventsPage })),
);
const EventDetailPage = lazy(() =>
  import("@/components/events/EventDetailPage").then((m) => ({ default: m.EventDetailPage })),
);
const CampWizardPage = lazy(() =>
  import("@/components/events/CampWizardPage").then((m) => ({ default: m.CampWizardPage })),
);
const CampingSitesPage = lazy(() =>
  import("@/components/sites/CampingSitesPage").then((m) => ({ default: m.CampingSitesPage })),
);
const MenusPage = lazy(() =>
  import("@/components/menus/MenusPage").then((m) => ({ default: m.MenusPage })),
);
const FoodPage = lazy(() =>
  import("@/components/food/FoodPage").then((m) => ({ default: m.FoodPage })),
);
const FormsPage = lazy(() =>
  import("@/components/forms/FormsPage").then((m) => ({ default: m.FormsPage })),
);
const UserManagementPage = lazy(() =>
  import("@/components/users/UserManagementPage").then((m) => ({ default: m.UserManagementPage })),
);
const PoliciesPage = lazy(() =>
  import("@/components/policies/PoliciesPage").then((m) => ({ default: m.PoliciesPage })),
);
const AdminPage = lazy(() =>
  import("@/components/admin/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const ProfilePage = lazy(() =>
  import("@/components/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);

// --- The lab schema's pages -------------------------------------------
//
// Lazy for the same reason as everything above, plus one of their own: a
// BaseMind whose lab schema was never installed should not be downloading
// twenty chunks it can never render. None of this is in the initial bundle
// and none of it is fetched until somebody navigates to it.
const DashboardPage = lazy(() =>
  import("@/components/lab/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const MembersPage = lazy(() =>
  import("@/components/lab/members/MembersPage").then((m) => ({ default: m.MembersPage })),
);
const AttendancePage = lazy(() =>
  import("@/components/lab/attendance/AttendancePage").then((m) => ({
    default: m.AttendancePage,
  })),
);
const ProgressionPage = lazy(() =>
  import("@/components/lab/progression/ProgressionPage").then((m) => ({
    default: m.ProgressionPage,
  })),
);
const PointsPage = lazy(() =>
  import("@/components/lab/points/PointsPage").then((m) => ({ default: m.PointsPage })),
);
const ProgrammePage = lazy(() =>
  import("@/components/lab/programme/ProgrammePage").then((m) => ({ default: m.ProgrammePage })),
);
const ActivitiesPage = lazy(() =>
  import("@/components/lab/programme/ActivitiesPage").then((m) => ({ default: m.ActivitiesPage })),
);
const TasksPage = lazy(() =>
  import("@/components/lab/tasks/TasksPage").then((m) => ({ default: m.TasksPage })),
);
const DutiesPage = lazy(() =>
  import("@/components/lab/duties/DutiesPage").then((m) => ({ default: m.DutiesPage })),
);
const MoneyPage = lazy(() =>
  import("@/components/lab/money/MoneyPage").then((m) => ({ default: m.MoneyPage })),
);
const RiskPage = lazy(() =>
  import("@/components/lab/risk/RiskPage").then((m) => ({ default: m.RiskPage })),
);
const SiteReviewsPage = lazy(() =>
  import("@/components/lab/reviews/SiteReviewsPage").then((m) => ({ default: m.SiteReviewsPage })),
);
const NoticeboardPage = lazy(() =>
  import("@/components/lab/board/NoticeboardPage").then((m) => ({ default: m.NoticeboardPage })),
);
const ChatPage = lazy(() =>
  import("@/components/lab/board/ChatPage").then((m) => ({ default: m.ChatPage })),
);
const PollsPage = lazy(() =>
  import("@/components/lab/board/PollsPage").then((m) => ({ default: m.PollsPage })),
);
const GalleryPage = lazy(() =>
  import("@/components/lab/board/GalleryPage").then((m) => ({ default: m.GalleryPage })),
);
const MaintenancePage = lazy(() =>
  import("@/components/lab/kit/MaintenancePage").then((m) => ({ default: m.MaintenancePage })),
);
const StocktakePage = lazy(() =>
  import("@/components/lab/kit/StocktakePage").then((m) => ({ default: m.StocktakePage })),
);
const WishlistPage = lazy(() =>
  import("@/components/lab/kit/WishlistPage").then((m) => ({ default: m.WishlistPage })),
);
const ToolkitPage = lazy(() =>
  import("@/components/lab/toolkit/ToolkitPage").then((m) => ({ default: m.ToolkitPage })),
);
const KitListsPage = lazy(() =>
  import("@/components/lab/toolkit/KitListsPage").then((m) => ({ default: m.KitListsPage })),
);

/** Lazy-loaded and hidden when its feature is switched off. */
function Gate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  return (
    <RequireFeature feature={feature}>
      <Lazy>{children}</Lazy>
    </RequireFeature>
  );
}

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

// Lab routes deliberately have no `Gate`. Every lab page renders through
// `LabPage`, which already distinguishes "not installed", "installed but
// switched off" and "cannot be reached" — and can say which. A route-level
// guard could only redirect, which loses the one piece of information the
// person following an old link actually needs.

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage />, errorElement: <RouteError /> },
  { path: "/register", element: <RegisterPage />, errorElement: <RouteError /> },
  { path: "/pending", element: <PendingApprovalPage />, errorElement: <RouteError /> },
  {
    path: "/",
    element: <AppLayout />,
    // Catches lazy-chunk failures from any page below, which is what a
    // deploy landing mid-session looks like.
    errorElement: <RouteError />,
    children: [
      // The dashboard is the front door. Without the lab schema it shows
      // the setup notice, which is still a better landing for somebody who
      // has just signed in than the equipment table was.
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Lazy><DashboardPage /></Lazy> },
      {
        path: "equipment",
        element: (
          <Lazy>
            <EquipmentProvider>
              <EquipmentPage />
            </EquipmentProvider>
          </Lazy>
        ),
      },
      { path: "loans", element: <Gate feature="loans"><LoansPage /></Gate> },
      { path: "events", element: <Gate feature="events"><EventsPage /></Gate> },
      { path: "events/new", element: <Gate feature="events"><CampWizardPage /></Gate> },
      { path: "events/:eventId", element: <Gate feature="events"><EventDetailPage /></Gate> },
      { path: "sites", element: <Gate feature="sites"><CampingSitesPage /></Gate> },
      { path: "menus", element: <Gate feature="menus"><MenusPage /></Gate> },
      { path: "food", element: <Gate feature="food"><FoodPage /></Gate> },
      { path: "forms", element: <Gate feature="forms"><FormsPage /></Gate> },
      { path: "policies", element: <Gate feature="policies"><PoliciesPage /></Gate> },

      // --- the lab schema ---
      { path: "members", element: <Lazy><MembersPage /></Lazy> },
      { path: "attendance", element: <Lazy><AttendancePage /></Lazy> },
      { path: "progression", element: <Lazy><ProgressionPage /></Lazy> },
      { path: "points", element: <Lazy><PointsPage /></Lazy> },
      { path: "programme", element: <Lazy><ProgrammePage /></Lazy> },
      { path: "activities", element: <Lazy><ActivitiesPage /></Lazy> },
      { path: "tasks", element: <Lazy><TasksPage /></Lazy> },
      { path: "duties", element: <Lazy><DutiesPage /></Lazy> },
      { path: "money", element: <Lazy><MoneyPage /></Lazy> },
      { path: "risk", element: <Lazy><RiskPage /></Lazy> },
      { path: "reviews", element: <Lazy><SiteReviewsPage /></Lazy> },
      { path: "noticeboard", element: <Lazy><NoticeboardPage /></Lazy> },
      { path: "chat", element: <Lazy><ChatPage /></Lazy> },
      { path: "polls", element: <Lazy><PollsPage /></Lazy> },
      { path: "gallery", element: <Lazy><GalleryPage /></Lazy> },
      { path: "maintenance", element: <Lazy><MaintenancePage /></Lazy> },
      { path: "stocktake", element: <Lazy><StocktakePage /></Lazy> },
      { path: "wishlist", element: <Lazy><WishlistPage /></Lazy> },
      { path: "toolkit", element: <Lazy><ToolkitPage /></Lazy> },
      { path: "kitlists", element: <Lazy><KitListsPage /></Lazy> },

      { path: "profile", element: <Lazy><ProfilePage /></Lazy> },
      {
        path: "admin",
        element: (
          <RequireRole roles={["Admin"]}>
            <Lazy>
              <AdminPage />
            </Lazy>
          </RequireRole>
        ),
      },
      {
        path: "users",
        element: (
          <RequireRole roles={["Admin"]}>
            <Lazy>
              <UserManagementPage />
            </Lazy>
          </RequireRole>
        ),
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
