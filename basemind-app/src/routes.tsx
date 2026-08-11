import { createBrowserRouter, Navigate } from "react-router";

import { AppLayout } from "@/components/layout/AppLayout";
import { RequireRole } from "@/components/layout/RequireRole";
import { LoginPage } from "@/components/auth/LoginPage";
import { RegisterPage } from "@/components/auth/RegisterPage";
import { PendingApprovalPage } from "@/components/auth/PendingApprovalPage";
import { EquipmentPage } from "@/components/equipment/EquipmentPage";
import { EventsPage } from "@/components/events/EventsPage";
import { EventDetailPage } from "@/components/events/EventDetailPage";
import { CampingSitesPage } from "@/components/sites/CampingSitesPage";
import { FoodPage } from "@/components/food/FoodPage";
import { UserManagementPage } from "@/components/users/UserManagementPage";
import { EquipmentProvider } from "@/context/EquipmentContext";

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
          <EquipmentProvider>
            <EquipmentPage />
          </EquipmentProvider>
        ),
      },
      { path: "events", element: <EventsPage /> },
      { path: "events/:eventId", element: <EventDetailPage /> },
      { path: "sites", element: <CampingSitesPage /> },
      { path: "food", element: <FoodPage /> },
      {
        path: "users",
        element: (
          <RequireRole roles={["Admin"]}>
            <UserManagementPage />
          </RequireRole>
        ),
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
