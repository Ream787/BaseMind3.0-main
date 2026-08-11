import { useState } from "react";
import { useData, type CampPlan } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { Plus, X, CalendarDays, MapPin, Package, AlertTriangle, Printer } from "lucide-react";

export function CampPlanningPage() {
  const { campPlans, setCampPlans, locations, equipment, groups } = useData();
  const { currentUser, hasPermission, activeGroupId } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState<CampPlan | null>(null);
  const [form, setForm] = useState({ name: "", locationId: "", startDate: "", endDate: "", equipmentIds: [] as string[], notes: "" });
  const canManage = hasPermission(["Admin", "Group Manager"]);

  const userGroupIds = currentUser?.role === "Admin"
    ? groups.map((g) => g.id)
    : currentUser?.groupIds || [];

  const filterByGroup = <T extends { groupId: string }>(items: T[]) => {
    if (activeGroupId && activeGroupId !== "all") return items.filter((i) => i.groupId === activeGroupId);
    return items.filter((i) => !i.groupId || userGroupIds.includes(i.groupId));
  };

  const myCamps = filterByGroup(campPlans);
  const myLocations = filterByGroup(locations);
  const myEquipment = filterByGroup(equipment);

  const openAdd = () => { setForm({ name: "", locationId: "", startDate: "", endDate: "", equipmentIds: [], notes: "" }); setShowModal(true); };

  const save = () => {
    if (!form.name || !form.locationId || !form.startDate) return;
    const newCamp: CampPlan = {
      id: `cp${Date.now()}`, ...form, groupId: activeGroupId === "all" ? "" : activeGroupId,
      createdBy: currentUser?.id || "", createdAt: new Date().toISOString().split("T")[0],
    };
    setCampPlans((p) => [...p, newCamp]);
    setShowModal(false);
  };

  const toggleEquip = (id: string) => {
    setForm((f) => ({ ...f, equipmentIds: f.equipmentIds.includes(id) ? f.equipmentIds.filter((i) => i !== id) : [...f.equipmentIds, id] }));
  };

  const getShortages = (camp: CampPlan) => {
    return camp.equipmentIds
      .map((id) => myEquipment.find((e) => e.id === id))
      .filter((e) => e && (e.condition === "Broken" || e.condition === "Missing" || e.condition === "Needs Repair"));
  };

  const printReport = (camp: CampPlan) => {
    const loc = myLocations.find((l) => l.id === camp.locationId);
    const eqs = camp.equipmentIds.map((id) => myEquipment.find((e) => e.id === id)).filter(Boolean);
    const shortages = getShortages(camp);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Camp Report - ${camp.name}</title><style>body{font-family:sans-serif;padding:2rem}table{width:100%;border-collapse:collapse;margin:1rem 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#7c3aed;color:white}h1{color:#7c3aed}.shortage{color:red}</style></head><body>`);
    w.document.write(`<h1>${camp.name}</h1><p><strong>Dates:</strong> ${camp.startDate} to ${camp.endDate}</p>`);
    if (loc) w.document.write(`<h2>Location</h2><p>${loc.name}<br>${loc.address}<br>Phone: ${loc.phone}<br>Email: ${loc.email}<br>Capacity: ${loc.capacity}</p>`);
    w.document.write(`<h2>Equipment Checklist</h2><table><tr><th>Item</th><th>Qty</th><th>Condition</th><th>Location</th></tr>`);
    eqs.forEach((e) => { if (e) w.document.write(`<tr><td>${e.name}</td><td>${e.quantity}</td><td>${e.condition}</td><td>${e.location}</td></tr>`); });
    w.document.write(`</table>`);
    if (shortages.length > 0) {
      w.document.write(`<h2 class="shortage">Equipment Shortages/Issues</h2><ul>`);
      shortages.forEach((s) => { if (s) w.document.write(`<li>${s.name} - ${s.condition}</li>`); });
      w.document.write(`</ul>`);
    }
    if (camp.notes) w.document.write(`<h2>Notes</h2><p>${camp.notes}</p>`);
    w.document.write(`</body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground">Camp Planning</h1>
          <p className="text-sm text-muted-foreground">{myCamps.length} camps planned</p>
        </div>
        {canManage && (
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
            <Plus className="w-4 h-4" /> New Camp
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myCamps.map((camp) => {
          const loc = myLocations.find((l) => l.id === camp.locationId);
          const shortages = getShortages(camp);
          const eqCount = camp.equipmentIds.length;
          return (
            <div key={camp.id} className="bg-card rounded-xl border border-border p-5 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setShowDetail(camp)}>
              <h3 className="text-foreground">{camp.name}</h3>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4" />{camp.startDate} — {camp.endDate}</div>
                <div className="flex items-center gap-2"><MapPin className="w-4 h-4" />{loc?.name || "Unknown"}</div>
                <div className="flex items-center gap-2"><Package className="w-4 h-4" />{eqCount} equipment items</div>
                {shortages.length > 0 && (
                  <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400"><AlertTriangle className="w-4 h-4" />{shortages.length} issue(s)</div>
                )}
              </div>
            </div>
          );
        })}
        {myCamps.length === 0 && <p className="text-muted-foreground col-span-3 text-center py-8">No camps planned yet</p>}
      </div>

      {/* Detail modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-foreground">{showDetail.name}</h2>
              <div className="flex gap-2">
                <button onClick={() => printReport(showDetail)} className="p-2 hover:bg-accent rounded"><Printer className="w-4 h-4 text-muted-foreground" /></button>
                <button onClick={() => setShowDetail(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
              </div>
            </div>
            {(() => {
              const loc = myLocations.find((l) => l.id === showDetail.locationId);
              const eqs = showDetail.equipmentIds.map((id) => myEquipment.find((e) => e.id === id)).filter(Boolean);
              const shortages = getShortages(showDetail);
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-muted-foreground">Start Date</p><p className="text-foreground">{showDetail.startDate}</p></div>
                    <div><p className="text-muted-foreground">End Date</p><p className="text-foreground">{showDetail.endDate}</p></div>
                  </div>
                  {loc && (
                    <div className="bg-secondary/50 rounded-lg p-4 text-sm">
                      <h4 className="text-foreground mb-2">Location: {loc.name}</h4>
                      <p className="text-muted-foreground">{loc.address}</p>
                      <p className="text-muted-foreground">Phone: {loc.phone} | Email: {loc.email}</p>
                      <p className="text-muted-foreground">Capacity: {loc.capacity}</p>
                    </div>
                  )}
                  <div>
                    <h4 className="text-foreground mb-2">Equipment Checklist ({eqs.length})</h4>
                    <div className="space-y-1">
                      {eqs.map((e) => e && (
                        <div key={e.id} className="flex justify-between text-sm py-1 border-b border-border">
                          <span className="text-foreground">{e.name} (x{e.quantity})</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${e.condition === "Good" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"}`}>{e.condition}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {shortages.length > 0 && (
                    <div className="bg-destructive/10 rounded-lg p-4">
                      <h4 className="text-destructive mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Equipment Issues</h4>
                      {shortages.map((s) => s && <p key={s.id} className="text-sm text-destructive">{s.name}: {s.condition}</p>)}
                    </div>
                  )}
                  {showDetail.notes && <div><h4 className="text-foreground mb-1">Notes</h4><p className="text-sm text-muted-foreground">{showDetail.notes}</p></div>}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Add camp modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-foreground">New Camp</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm">Camp Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              <div>
                <label className="text-sm">Location</label>
                <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground">
                  <option value="">Select location</option>
                  {myLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm">Start Date</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
                </div>
                <div>
                  <label className="text-sm">End Date</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
                </div>
              </div>
              <div>
                <label className="text-sm">Equipment (select items)</label>
                <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2 space-y-1 mt-1">
                  {myEquipment.map((e) => (
                    <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer py-1 px-2 rounded hover:bg-muted">
                      <input type="checkbox" checked={form.equipmentIds.includes(e.id)} onChange={() => toggleEquip(e.id)} className="accent-primary" />
                      <span className="text-foreground">{e.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">x{e.quantity}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-border rounded-lg text-foreground hover:bg-muted">Cancel</button>
              <button onClick={save} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">Create Camp</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}