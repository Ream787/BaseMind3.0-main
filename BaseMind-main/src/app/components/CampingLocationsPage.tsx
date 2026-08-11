import { useState } from "react";
import { useData, type CampingLocation } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { Plus, Search, Edit2, Trash2, X, MapPin, Phone, Mail, Users as UsersIcon } from "lucide-react";

export function CampingLocationsPage() {
  const { locations, setLocations, groups } = useData();
  const { currentUser, hasPermission, activeGroupId } = useAuth();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CampingLocation | null>(null);
  const [form, setForm] = useState<Omit<CampingLocation, "id">>({ name: "", address: "", phone: "", email: "", capacity: 0, facilities: "", notes: "", groupId: "" });
  const canManage = hasPermission(["Admin", "Group Manager"]);

  const userGroupIds = currentUser?.role === "Admin"
    ? groups.map((g) => g.id)
    : currentUser?.groupIds || [];

  const myLocations = locations.filter((l) => {
    if (activeGroupId && activeGroupId !== "all") return l.groupId === activeGroupId;
    return userGroupIds.includes(l.groupId);
  });
  const filtered = myLocations.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()) || l.address.toLowerCase().includes(search.toLowerCase()));
  const userGroups = currentUser?.role === "Admin" ? groups : groups.filter((g) => userGroupIds.includes(g.id));

  const openAdd = () => { setEditing(null); setForm({ name: "", address: "", phone: "", email: "", capacity: 0, facilities: "", notes: "", groupId: activeGroupId === "all" ? "" : activeGroupId || "" }); setShowModal(true); };
  const openEdit = (l: CampingLocation) => { setEditing(l); setForm({ ...l }); setShowModal(true); };
  const save = () => {
    if (!form.name) return;
    if (editing) setLocations((p) => p.map((l) => l.id === editing.id ? { ...form, id: editing.id } : l));
    else setLocations((p) => [...p, { ...form, id: `loc${Date.now()}` }]);
    setShowModal(false);
  };
  const remove = (id: string) => { if (confirm("Delete?")) setLocations((p) => p.filter((l) => l.id !== id)); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground">Camping Locations</h1>
          <p className="text-sm text-muted-foreground">{myLocations.length} locations</p>
        </div>
        {canManage && (
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Location
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search locations..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((l) => (
          <div key={l.id} className="bg-card rounded-xl border border-border p-5">
            <div className="flex justify-between items-start">
              <h3 className="text-foreground">{l.name}</h3>
              {canManage && (
                <div className="flex gap-1">
                  <button onClick={() => openEdit(l)} className="p-1.5 hover:bg-accent rounded"><Edit2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                  <button onClick={() => remove(l.id)} className="p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                </div>
              )}
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-start gap-2 text-muted-foreground"><MapPin className="w-4 h-4 shrink-0 mt-0.5" />{l.address}</div>
              {l.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4 shrink-0" />{l.phone}</div>}
              {l.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4 shrink-0" />{l.email}</div>}
              <div className="flex items-center gap-2 text-muted-foreground"><UsersIcon className="w-4 h-4 shrink-0" />Capacity: {l.capacity}</div>
            </div>
            {l.facilities && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Facilities</p>
                <div className="flex flex-wrap gap-1">
                  {l.facilities.split(",").map((f, i) => (
                    <span key={i} className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs">{f.trim()}</span>
                  ))}
                </div>
              </div>
            )}
            {l.notes && <p className="mt-3 text-xs text-muted-foreground">{l.notes}</p>}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-muted-foreground col-span-2 text-center py-8">No locations found</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-foreground">{editing ? "Edit Location" : "Add Location"}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: "Name", key: "name" as const, type: "text" },
                { label: "Address", key: "address" as const, type: "text" },
                { label: "Phone", key: "phone" as const, type: "tel" },
                { label: "Email", key: "email" as const, type: "email" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-sm">{f.label}</label>
                  <input type={f.type} value={form[f.key] as string} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
                </div>
              ))}
              <div>
                <label className="text-sm">Capacity</label>
                <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: +e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              <div>
                <label className="text-sm">Group</label>
                <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground">
                  <option value="">Select group</option>
                  {userGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm">Facilities (comma-separated)</label>
                <input value={form.facilities} onChange={(e) => setForm({ ...form, facilities: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              <div>
                <label className="text-sm">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
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
