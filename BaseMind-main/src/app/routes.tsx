import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { LoginPage } from "./components/LoginPage";
import { RegisterPage } from "./components/RegisterPage";
import { DashboardPage } from "./components/DashboardPage";
import { EquipmentPage } from "./components/EquipmentPage";
import { CampingLocationsPage } from "./components/CampingLocationsPage";
import { CampPlanningPage } from "./components/CampPlanningPage";
import { ReportsPage } from "./components/ReportsPage";
import { FileManagerPage } from "./components/FileManagerPage";
import { UserManagementPage } from "./components/UserManagementPage";
import { GroupMembersPage } from "./components/GroupMembersPage";
import { GroupsPage } from "./components/GroupsPage";
import { SettingsPage } from "./components/SettingsPage";
import { NotFoundPage } from "./components/NotFoundPage";

export const router = createBrowserRouter([
  { path: "/login", Component: LoginPage },
  { path: "/register", Component: RegisterPage },
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: DashboardPage },
      { path: "equipment", Component: EquipmentPage },
      { path: "locations", Component: CampingLocationsPage },
      { path: "camp-planning", Component: CampPlanningPage },
      { path: "reports", Component: ReportsPage },
      { path: "files", Component: FileManagerPage },
      { path: "users", Component: UserManagementPage },
      { path: "group-members", Component: GroupMembersPage },
      { path: "groups", Component: GroupsPage },
      { path: "settings", Component: SettingsPage },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);