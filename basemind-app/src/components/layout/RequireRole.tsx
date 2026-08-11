import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/types/database";

// This is a UI-layer convenience only. The real enforcement is the RLS
// policies in supabase/migrations/0001_init.sql — even if someone bypasses
// this guard, the database rejects any write their role doesn't allow.
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { profile } = useAuth();

  if (!profile || !roles.includes(profile.role)) {
    return <Navigate to="/equipment" replace />;
  }

  return <>{children}</>;
}
