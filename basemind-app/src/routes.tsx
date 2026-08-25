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
const AdminPage = lazy(() =>
  import("@/components/admin/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const ProfilePage = lazy(() =>
  import("@/components/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })),
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
      { index: true, element: <Navigate to="/equipment" replace /> },
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
