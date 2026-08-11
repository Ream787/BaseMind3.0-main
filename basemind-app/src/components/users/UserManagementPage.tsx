import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { Role, UserProfile, UserStatus } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

const ROLES: Role[] = ["Admin", "Manager", "Member", "Viewer"];

const statusStyles: Record<UserStatus, string> = {
  Active:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  Pending:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  Rejected: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
};

export function UserManagementPage() {
  const { profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setUsers(data ?? []);
        setLoading(false);
      });
  }, []);

  const sorted = useMemo(() => {
    const order: Record<UserStatus, number> = { Pending: 0, Active: 1, Rejected: 2 };
    return [...users].sort(
      (a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name),
    );
  }, [users]);

  async function updateUser(
    id: string,
    patch: Partial<Pick<UserProfile, "role" | "status">>,
  ): Promise<UserProfile | null> {
    setBusyId(id);
    const { data, error } = await supabase
      .from("users")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return null;
    }
    setUsers((prev) => prev.map((u) => (u.id === id ? data : u)));
    return data;
  }

  async function approve(user: UserProfile, role: Role) {
    const updated = await updateUser(user.id, { role, status: "Active" });
    if (updated) toast.success(`${user.name || user.email} approved as ${role}`);
  }

  async function reject(user: UserProfile) {
    const updated = await updateUser(user.id, { status: "Rejected" });
    if (updated) toast.success(`${user.name || user.email} rejected`);
  }

  async function reactivate(user: UserProfile) {
    const updated = await updateUser(user.id, { status: "Active" });
    if (updated) toast.success(`${user.name || user.email} reactivated`);
  }

  async function deactivate(user: UserProfile) {
    const updated = await updateUser(user.id, { status: "Rejected" });
    if (updated) toast.success(`${user.name || user.email} deactivated`);
  }

  async function changeRole(user: UserProfile, role: Role) {
    const updated = await updateUser(user.id, { role });
    if (updated) toast.success(`${user.name || user.email} is now ${role}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1>Users</h1>
        <p className="text-sm text-muted-foreground">Approve new accounts and manage roles.</p>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Loading users…
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((user) => {
                const isSelf = user.id === currentProfile?.id;
                const busy = busyId === user.id;
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name || "—"}{" "}
                      {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusStyles[user.status]}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.status === "Active" && !isSelf ? (
                        <Select value={user.role} onValueChange={(v) => changeRole(user, v as Role)}>
                          <SelectTrigger className="w-32" disabled={busy}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        user.role
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isSelf ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : user.status === "Pending" ? (
                        <PendingActions user={user} busy={busy} onApprove={approve} onReject={reject} />
                      ) : user.status === "Active" ? (
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => deactivate(user)}>
                          Deactivate
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => reactivate(user)}>
                          Reactivate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function PendingActions({
  user,
  busy,
  onApprove,
  onReject,
}: {
  user: UserProfile;
  busy: boolean;
  onApprove: (user: UserProfile, role: Role) => void;
  onReject: (user: UserProfile) => void;
}) {
  const [role, setRole] = useState<Role>("Member");

  return (
    <div className="flex items-center justify-end gap-2">
      <Select value={role} onValueChange={(v) => setRole(v as Role)}>
        <SelectTrigger className="w-32" disabled={busy}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" disabled={busy} onClick={() => onApprove(user, role)}>
        Approve
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onReject(user)}>
        Reject
      </Button>
    </div>
  );
}
