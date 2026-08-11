import { useState } from "react";
import { useData, type User, type UserRole, type UserStatus } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { Search, CheckCircle, XCircle, Edit2, Trash2, X, UserPlus, RefreshCw, Copy } from "lucide-react";

const statusColors: Record<UserStatus, string> = {
  Active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function UserManagementPage() {
  const { users, setUsers, groups } = useData();
  const { currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", groupIds: [] as string[], role: "Member" as UserRole, status: "Active" as UserStatus, password: "" });
  const [resetPassword, setResetPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { console.error("Failed to copy text: ", err); }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let pw = "";
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return pw;
  };

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || u.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const pendingUsers = users.filter((u) => u.status === "Pending");

  const approve = (id: string) => setUsers((p) => p.map((u) => u.id === id ? { ...u, status: "Active" as const } : u));
  const reject = (id: string) => setUsers((p) => p.map((u) => u.id === id ? { ...u, status: "Rejected" as const } : u));
  const remove = (id: string) => { if (confirm("Delete user?")) setUsers((p) => p.filter((u) => u.id !== id)); };

  const openAdd = () => { setEditing(null); setForm({ name: "", email: "", phone: "", groupIds: [], role: "Member", status: "Active", password: "changeme123" }); setResetPassword(null); setShowModal(true); };
  const openEdit = (u: User) => { setEditing(u); setForm({ name: u.name, email: u.email, phone: u.phone, groupIds: u.groupIds || [], role: u.role, status: u.status, password: "" }); setResetPassword(null); setShowModal(true); };

  const save = () => {
    if (!form.name || !form.email) return;
    if (editing) {
      const newPw = resetPassword || undefined;
      setUsers((p) => p.map((u) => u.id === editing.id ? {
        ...u,
        ...form,
        password: newPw || u.password,
        ...(newPw ? { passwordResetAt: new Date().toISOString(), mustChangePassword: true } : {}),
      } : u));
    } else {
      setUsers((p) => [...p, { id: `u${Date.now()}`, ...form, password: form.password || "changeme123", createdAt: new Date().toISOString().split("T")[0] }]);
    }
    setShowModal(false);
  };

  const toggleGroup = (gId: string) => {
    setForm((f) => ({
      ...f,
      groupIds: f.groupIds.includes(gId)
        ? f.groupIds.filter((id) => id !== gId)
        : [...f.groupIds, gId],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">{users.length} users · {pendingUsers.length} pending</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
          <UserPlus className="w-4 h-4" /> Add User
        </button>
      </div>

      {pendingUsers.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-xl p-4">
          <h3 className="text-foreground mb-3">Pending Approvals ({pendingUsers.length})</h3>
          <div className="space-y-2">
            {pendingUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between bg-card rounded-lg p-3 border border-border">
                <div>
                  <p className="text-sm text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email} · {u.phone}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approve(u.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:opacity-90">
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button onClick={() => reject(u.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:opacity-90">
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-input-background text-foreground">
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Pending">Pending</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 hidden md:table-cell">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 hidden lg:table-cell">Groups</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3 text-foreground">{u.name}</td>
                <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">{u.role}</span></td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${statusColors[u.status]}`}>{u.status}</span></td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                  {u.groupIds && u.groupIds.length > 0
                    ? u.groupIds.map((gId) => groups.find((g) => g.id === gId)?.name).filter(Boolean).join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-accent rounded"><Edit2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    <button onClick={() => remove(u.id)} className="p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-foreground">{editing ? "Edit User" : "Add User"}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              <div>
                <label className="text-sm">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              <div>
                <label className="text-sm">Phone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              <div>
                {editing ? (
                  <div>
                    <label className="text-sm">Password</label>
                    {resetPassword ? (
                      <div className="mt-1 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">New password generated:</span>
                          <button type="button" onClick={() => copyToClipboard(resetPassword)} className="text-xs text-primary hover:underline flex items-center gap-1"><Copy className="w-3 h-3" /> {copied ? "Copied!" : "Copy"}</button>
                        </div>
                        <code className="text-sm font-mono text-foreground select-all">{resetPassword}</code>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { const pw = generatePassword(); setResetPassword(pw); setForm({ ...form, password: pw }); }} className="mt-1 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border bg-input-background text-foreground hover:bg-primary/10 hover:border-primary transition-colors">
                        <RefreshCw className="w-4 h-4" /> Reset Password
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="text-sm">Password</label>
                    <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm">Groups (select multiple)</label>
                <div className="mt-1 max-h-32 overflow-y-auto border border-border rounded-lg p-2 space-y-1">
                  {groups.length === 0 && <p className="text-xs text-muted-foreground py-1 px-2">No groups available</p>}
                  {groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer py-1 px-2 rounded hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={form.groupIds.includes(g.id)}
                        onChange={() => toggleGroup(g.id)}
                        className="accent-primary"
                      />
                      <span className="text-foreground">{g.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm">Role</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground">
                    <option>Admin</option><option>Group Manager</option><option>Member</option><option>Viewer</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as UserStatus })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground">
                    <option>Active</option><option>Pending</option><option>Rejected</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-border rounded-lg text-foreground hover:bg-muted">Cancel</button>
              <button onClick={save} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}