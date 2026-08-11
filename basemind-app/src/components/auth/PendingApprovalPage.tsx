import { Navigate } from "react-router";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";

export function PendingApprovalPage() {
  const { session, profile, loading, logout } = useAuth();

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.status === "Active") return <Navigate to="/" replace />;

  const rejected = profile?.status === "Rejected";

  const title = !profile
    ? "Couldn't load your account"
    : rejected
      ? "Account rejected"
      : "Pending approval";

  const description = !profile
    ? "Something went wrong loading your profile. Try signing out and back in."
    : rejected
      ? "Your account request was rejected. Contact an admin if you think this is a mistake."
      : "Your account is waiting for an admin to approve it. Check back soon.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button variant="outline" onClick={() => logout()}>
            Sign out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
