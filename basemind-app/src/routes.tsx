import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router";

import { AppLayout } from "@/components/layout/AppLayout";
import { RequireRole } from "@/components/layout/RequireRole";
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
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/pending", element: <PendingApprovalPage /> },
  {
    path: "/",
    element: <AppLayout />,
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
      { path: "loans", element: <Lazy><LoansPage /></Lazy> },
      { path: "events", element: <Lazy><EventsPage /></Lazy> },
      { path: "events/new", element: <Lazy><CampWizardPage /></Lazy> },
      { path: "events/:eventId", element: <Lazy><EventDetailPage /></Lazy> },
      { path: "sites", element: <Lazy><CampingSitesPage /></Lazy> },
      { path: "menus", element: <Lazy><MenusPage /></Lazy> },
      { path: "food", element: <Lazy><FoodPage /></Lazy> },
      { path: "forms", element: <Lazy><FormsPage /></Lazy> },
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
