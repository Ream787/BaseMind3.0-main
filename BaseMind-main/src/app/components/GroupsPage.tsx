import { useState } from "react";
import { useData, type Group } from "../context/DataContext";
import { Plus, Edit2, Trash2, X, UsersRound, Users, Package } from "lucide-react";

export function GroupsPage() {
  const { groups, setGroups, users, equipment } = useData();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form, setForm] = useState({ name: "" });

  const openAdd = () => { setEditing(null); setForm({ name: "" }); setShowModal(true); };
  const openEdit = (g: Group) => { setEditing(g); setForm({ name: g.name }); setShowModal(true); };
  const save = () => {
    if (!form.name) return;
    if (editing) setGroups((p) => p.map((g) => g.id === editing.id ? { ...g, name: form.name } : g));
    else setGroups((p) => [...p, { id: `grp${Date.now()}`, name: form.name, createdAt: new Date().toISOString().split("T")[0] }]);
    setShowModal(false);
  };
  const remove = (id: string) => { if (confirm("Delete group?")) setGroups((p) => p.filter((g) => g.id !== id)); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground">Groups</h1>
          <p className="text-sm text-muted-foreground">{groups.length} groups</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Group
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((g) => {
          const groupUsers = users.filter((u) => u.groupIds?.includes(g.id));
          const groupEquip = equipment.filter((e) => e.groupId === g.id);
          return (
            <div key={g.id} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <UsersRound className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-foreground">{g.name}</h3>
                    <p className="text-xs text-muted-foreground">Created {g.createdAt}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(g)} className="p-1.5 hover:bg-accent rounded"><Edit2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                  <button onClick={() => remove(g.id)} className="p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                </div>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{groupUsers.length} members</span>
                <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" />{groupEquip.length} equipment</span>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-foreground">{editing ? "Edit" : "Add"} Group</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div>
              <label className="text-sm">Name</label>
              <input value={form.name} onChange={(e) => setForm({ name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground mt-1" />
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
