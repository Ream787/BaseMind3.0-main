import { useState } from "react";
import { useData, type Equipment, type EquipmentCondition } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { Plus, Search, Edit2, Trash2, X } from "lucide-react";

const conditionColors: Record<EquipmentCondition, string> = {
  Good: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  "Needs Repair": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Broken: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  Missing: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

const emptyEquip: Omit<Equipment, "id"> = {
  name: "", quantity: 1, location: "", dateLastChecked: "", checkedBy: "", nextCheckDate: "",
  condition: "Good", notes: "", groupId: "",
};

export function EquipmentPage() {
  const { equipment, setEquipment, groups } = useData();
  const { currentUser, hasPermission, activeGroupId } = useAuth();
  const [search, setSearch] = useState("");
  const [filterCondition, setFilterCondition] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"table"|"category"|"location">("table");
  const [customLocations, setCustomLocations] = useState<string[]>([]);
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState(emptyEquip);
  const canEdit = hasPermission(["Admin", "Group Manager", "Member"]);
  const canManage = hasPermission(["Admin", "Group Manager"]);

  const userGroupIds = currentUser?.role === "Admin"
    ? groups.map((g) => g.id)
    : currentUser?.groupIds || [];

  const visibleEquipment = equipment.filter((e) => {
    if (activeGroupId && activeGroupId !== "all") return e.groupId === activeGroupId;
    return userGroupIds.includes(e.groupId);
  });

  const filtered = visibleEquipment.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.location.toLowerCase().includes(search.toLowerCase());
    const matchCondition = filterCondition === "All" || e.condition === filterCondition;
    return matchSearch && matchCondition;
  });

  const locationOptions = Array.from(new Set([
    ...visibleEquipment.map((e) => e.location).filter(Boolean),
    ...customLocations,
  ]));

  const addNewLocation = () => {
    const cleaned = newLocationName.trim();
    if (!cleaned) return;
    const formatted = cleaned.replace(/^./, (char) => char.toUpperCase());
    if (!locationOptions.includes(formatted)) {
      setCustomLocations((prev) => [...prev, formatted]);
    }
    setForm((prev) => ({ ...prev, location: formatted }));
    setNewLocationName("");
    setAddingLocation(false);
  };

  // Grouping helpers
  const categories = Array.from(new Set(filtered.map((e) => (e as any).category || "Uncategorized")));
  const equipmentByCategory: Record<string, Equipment[]> = {};
  categories.forEach((c) => { equipmentByCategory[c] = filtered.filter((e) => ((e as any).category || "Uncategorized") === c); });

  const locations = Array.from(new Set(filtered.map((e) => e.location || "Unknown")));
  const equipmentByLocation: Record<string, Equipment[]> = {};
  locations.forEach((l) => { equipmentByLocation[l] = filtered.filter((e) => (e.location || "Unknown") === l); });

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyEquip, groupId: activeGroupId === "all" ? "" : activeGroupId || "" });
    setShowModal(true);
  };

  const openEdit = (e: Equipment) => {
    setEditing(e);
    setForm({ ...e });
    setShowModal(true);
  };

  const save = () => {
    if (!form.name) return;
    if (editing) {
      setEquipment((prev) => prev.map((e) => (e.id === editing.id ? { ...form, id: editing.id } : e)));
    } else {
      setEquipment((prev) => [...prev, { ...form, id: `eq${Date.now()}` }]);
    }
    setShowModal(false);
  };

  const remove = (id: string) => {
    if (confirm("Delete this equipment?")) setEquipment((prev) => prev.filter((e) => e.id !== id));
  };

  const userGroups = currentUser?.role === "Admin" ? groups : groups.filter((g) => userGroupIds.includes(g.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground">Equipment</h1>
          <p className="text-sm text-muted-foreground">{visibleEquipment.length} items total</p>
        </div>
        {canManage && (
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Equipment
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search equipment..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
        </div>
        <select value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-input-background text-foreground">
          <option value="All">All Conditions</option>
          <option value="Good">Good</option>
          <option value="Needs Repair">Needs Repair</option>
          <option value="Broken">Broken</option>
          <option value="Missing">Missing</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setViewMode("table")} className={`px-3 py-2 rounded-lg ${viewMode==="table"?"bg-primary text-primary-foreground":"border border-border"}`}>Table</button>
          <button onClick={() => setViewMode("category")} className={`px-3 py-2 rounded-lg ${viewMode==="category"?"bg-primary text-primary-foreground":"border border-border"}`}>By Category</button>
          <button onClick={() => setViewMode("location")} className={`px-3 py-2 rounded-lg ${viewMode==="location"?"bg-primary text-primary-foreground":"border border-border"}`}>By Location</button>
        </div>
      </div>

      {viewMode === "table" && (
        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3 hidden md:table-cell">Location</th>
              <th className="px-4 py-3 hidden lg:table-cell">Last Checked</th>
              <th className="px-4 py-3 hidden lg:table-cell">Next Check</th>
              <th className="px-4 py-3">Condition</th>
              <th className="px-4 py-3 hidden xl:table-cell">Group</th>
              {canEdit && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3 text-foreground">{e.name}</td>
                <td className="px-4 py-3 text-foreground">{e.quantity}</td>
                <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{e.location}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{e.dateLastChecked}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{e.nextCheckDate}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${conditionColors[e.condition]}`}>{e.condition}</span>
                </td>
                <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground">{userGroups.find((g) => g.id === e.groupId)?.name || "—"}</td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(e)} className="p-1.5 hover:bg-accent rounded"><Edit2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                      {canManage && <button onClick={() => remove(e.id)} className="p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No equipment found</td></tr>
            )}
          </tbody>
        </table>
        </div>
      )}

      {viewMode === "category" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((c) => (
            <div key={c} className="p-4 bg-card rounded-lg border border-border hover:shadow-md cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-foreground font-semibold">{c}</h4>
                  <p className="text-sm text-muted-foreground">{equipmentByCategory[c].length} items</p>
                </div>
                <div className="text-primary text-xl font-bold">{equipmentByCategory[c].length}</div>
              </div>
              <div className="mt-3 space-y-2">
                {equipmentByCategory[c].slice(0,4).map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="text-foreground">{e.name}</div>
                      <div className="text-xs text-muted-foreground">{e.location} · Qty {e.quantity}</div>
                    </div>
                    <div className="text-xs"><span className={`px-2 py-0.5 rounded text-xs ${conditionColors[e.condition]}`}>{e.condition}</span></div>
                  </div>
                ))}
                {equipmentByCategory[c].length > 4 && <div className="text-xs text-muted-foreground">+{equipmentByCategory[c].length-4} more</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === "location" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {locations.map((l) => (
            <div key={l} className="p-4 bg-card rounded-lg border border-border hover:shadow-md cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-foreground font-semibold">{l}</h4>
                  <p className="text-sm text-muted-foreground">{equipmentByLocation[l].length} items</p>
                </div>
                <div className="text-primary text-xl font-bold">{equipmentByLocation[l].length}</div>
              </div>
              <div className="mt-3 space-y-2">
                {equipmentByLocation[l].slice(0,4).map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="text-foreground">{e.name}</div>
                      <div className="text-xs text-muted-foreground">Qty {e.quantity}</div>
                    </div>
                    <div className="text-xs"><span className={`px-2 py-0.5 rounded text-xs ${conditionColors[e.condition]}`}>{e.condition}</span></div>
                  </div>
                ))}
                {equipmentByLocation[l].length > 4 && <div className="text-xs text-muted-foreground">+{equipmentByLocation[l].length-4} more</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-foreground">{editing ? "Edit Equipment" : "Add Equipment"}</h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm">Quantity</label>
                  <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
                </div>
                <div>
                  <label className="text-sm">Condition</label>
                  <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value as EquipmentCondition })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground">
                    <option>Good</option><option>Needs Repair</option><option>Broken</option><option>Missing</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm">Location</label>
                {!addingLocation ? (
                  <div className="flex gap-2 items-center">
                    <select value={form.location} onChange={(e) => {
                      if (e.target.value === "__new") {
                        setAddingLocation(true);
                        setForm((prev) => ({ ...prev, location: "" }));
                      } else {
                        setForm((prev) => ({ ...prev, location: e.target.value }));
                      }
                    }} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground">
                      <option value="">Select location</option>
                      {locationOptions.map((loc) => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                      <option value="__new">+ Add new location</option>
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)} placeholder="Enter new location" className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
                    <div className="flex gap-2">
                      <button type="button" onClick={addNewLocation} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg">Add</button>
                      <button type="button" onClick={() => { setAddingLocation(false); setNewLocationName(""); }} className="px-3 py-2 border border-border rounded-lg">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm">Last Checked</label>
                  <input type="date" value={form.dateLastChecked} onChange={(e) => setForm({ ...form, dateLastChecked: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
                </div>
                <div>
                  <label className="text-sm">Next Check</label>
                  <input type="date" value={form.nextCheckDate} onChange={(e) => setForm({ ...form, nextCheckDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
                </div>
              </div>
              <div>
                <label className="text-sm">Checked By</label>
                <input value={form.checkedBy} onChange={(e) => setForm({ ...form, checkedBy: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              <div>
                <label className="text-sm">Group</label>
                <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground">
                  <option value="">Select group</option>
                  {userGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
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
