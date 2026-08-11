import { useState } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { FileText, Printer, AlertTriangle, Package, CalendarDays, Search as SearchIcon } from "lucide-react";

type ReportType = "camp" | "audit" | "overdue" | "missing";

export function ReportsPage() {
  const { equipment, campPlans, locations, groups } = useData();
  const { currentUser, activeGroupId } = useAuth();
  const [activeReport, setActiveReport] = useState<ReportType>("audit");

  const userGroupIds = currentUser?.role === "Admin"
    ? groups.map((g) => g.id)
    : currentUser?.groupIds || [];

  const filterByGroup = <T extends { groupId: string }>(items: T[]) => {
    if (activeGroupId && activeGroupId !== "all") return items.filter((i) => i.groupId === activeGroupId);
    return items.filter((i) => !i.groupId || userGroupIds.includes(i.groupId));
  };

  const orgEquip = filterByGroup(equipment);
  const orgCamps = filterByGroup(campPlans);
  const now = new Date();

  const overdueChecks = orgEquip.filter((e) => new Date(e.nextCheckDate) < now);
  const missingEquip = orgEquip.filter((e) => e.condition === "Missing" || e.condition === "Broken");

  const reports = [
    { type: "audit" as const, label: "Equipment Audit", icon: Package, count: orgEquip.length },
    { type: "overdue" as const, label: "Overdue Checks", icon: AlertTriangle, count: overdueChecks.length },
    { type: "missing" as const, label: "Missing/Broken", icon: SearchIcon, count: missingEquip.length },
    { type: "camp" as const, label: "Camp Reports", icon: CalendarDays, count: orgCamps.length },
  ];

  const printCurrentReport = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Report</title><style>body{font-family:sans-serif;padding:2rem}table{width:100%;border-collapse:collapse;margin:1rem 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#7c3aed;color:white}h1{color:#7c3aed}.warning{color:#d97706}.danger{color:#dc2626}</style></head><body>`);

    if (activeReport === "audit") {
      w.document.write(`<h1>Equipment Audit Report</h1><p>Generated: ${now.toLocaleDateString()}</p>`);
      w.document.write(`<table><tr><th>Name</th><th>Qty</th><th>Condition</th><th>Location</th><th>Last Checked</th><th>Next Check</th></tr>`);
      orgEquip.forEach((e) => w.document.write(`<tr><td>${e.name}</td><td>${e.quantity}</td><td>${e.condition}</td><td>${e.location}</td><td>${e.dateLastChecked}</td><td>${e.nextCheckDate}</td></tr>`));
      w.document.write(`</table>`);
    } else if (activeReport === "overdue") {
      w.document.write(`<h1>Overdue Checks Report</h1><p>Generated: ${now.toLocaleDateString()}</p>`);
      w.document.write(`<table><tr><th>Name</th><th>Due Date</th><th>Last Checked By</th><th>Condition</th></tr>`);
      overdueChecks.forEach((e) => w.document.write(`<tr><td>${e.name}</td><td class="danger">${e.nextCheckDate}</td><td>${e.checkedBy}</td><td>${e.condition}</td></tr>`));
      w.document.write(`</table>`);
    } else if (activeReport === "missing") {
      w.document.write(`<h1>Missing/Broken Equipment Report</h1><p>Generated: ${now.toLocaleDateString()}</p>`);
      w.document.write(`<table><tr><th>Name</th><th>Condition</th><th>Notes</th><th>Group</th></tr>`);
      missingEquip.forEach((e) => w.document.write(`<tr><td>${e.name}</td><td class="danger">${e.condition}</td><td>${e.notes}</td><td>${groups.find((g) => g.id === e.groupId)?.name || ""}</td></tr>`));
      w.document.write(`</table>`);
    } else {
      w.document.write(`<h1>Camp Reports</h1><p>Generated: ${now.toLocaleDateString()}</p>`);
      orgCamps.forEach((c) => {
        const loc = locations.find((l) => l.id === c.locationId);
        w.document.write(`<h2>${c.name}</h2><p>Dates: ${c.startDate} - ${c.endDate}</p><p>Location: ${loc?.name || "N/A"}</p><p>Equipment items: ${c.equipmentIds.length}</p><hr>`);
      });
    }
    w.document.write(`</body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Generate and export reports</p>
        </div>
        <button onClick={printCurrentReport} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
          <Printer className="w-4 h-4" /> Export PDF
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {reports.map((r) => (
          <button key={r.type} onClick={() => setActiveReport(r.type)} className={`p-4 rounded-xl border text-left transition-colors ${activeReport === r.type ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50"}`}>
            <r.icon className="w-5 h-5 mb-2" />
            <p className="text-sm">{r.label}</p>
            <p className="text-2xl mt-1">{r.count}</p>
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        {activeReport === "audit" && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="px-4 py-3">Name</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Condition</th><th className="px-4 py-3 hidden md:table-cell">Location</th><th className="px-4 py-3 hidden md:table-cell">Next Check</th></tr></thead>
            <tbody>{orgEquip.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0"><td className="px-4 py-3 text-foreground">{e.name}</td><td className="px-4 py-3">{e.quantity}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${e.condition === "Good" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : e.condition === "Needs Repair" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}`}>{e.condition}</span></td><td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{e.location}</td><td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{e.nextCheckDate}</td></tr>
            ))}</tbody>
          </table>
        )}
        {activeReport === "overdue" && (
          overdueChecks.length === 0 ? <p className="p-8 text-center text-muted-foreground">No overdue checks</p> :
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="px-4 py-3">Name</th><th className="px-4 py-3">Due Date</th><th className="px-4 py-3">Last Checked By</th><th className="px-4 py-3">Condition</th></tr></thead>
            <tbody>{overdueChecks.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0"><td className="px-4 py-3 text-foreground">{e.name}</td><td className="px-4 py-3 text-destructive">{e.nextCheckDate}</td><td className="px-4 py-3 text-muted-foreground">{e.checkedBy}</td><td className="px-4 py-3">{e.condition}</td></tr>
            ))}</tbody>
          </table>
        )}
        {activeReport === "missing" && (
          missingEquip.length === 0 ? <p className="p-8 text-center text-muted-foreground">No missing or broken equipment</p> :
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="px-4 py-3">Name</th><th className="px-4 py-3">Condition</th><th className="px-4 py-3">Notes</th><th className="px-4 py-3 hidden md:table-cell">Group</th></tr></thead>
            <tbody>{missingEquip.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0"><td className="px-4 py-3 text-foreground">{e.name}</td><td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">{e.condition}</span></td><td className="px-4 py-3 text-muted-foreground">{e.notes}</td><td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{groups.find((g) => g.id === e.groupId)?.name || "—"}</td></tr>
            ))}</tbody>
          </table>
        )}
        {activeReport === "camp" && (
          orgCamps.length === 0 ? <p className="p-8 text-center text-muted-foreground">No camps to report</p> :
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="px-4 py-3">Camp</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Equipment</th></tr></thead>
            <tbody>{orgCamps.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0"><td className="px-4 py-3 text-foreground">{c.name}</td><td className="px-4 py-3 text-muted-foreground">{locations.find((l) => l.id === c.locationId)?.name || "—"}</td><td className="px-4 py-3 text-muted-foreground">{c.startDate} — {c.endDate}</td><td className="px-4 py-3">{c.equipmentIds.length} items</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}