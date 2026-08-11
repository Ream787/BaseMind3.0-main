import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { Package, MapPin, CalendarDays, AlertTriangle, Clock, FileText, Users, CheckCircle } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import "react-day-picker/dist/style.css";
import { useState } from "react";

export function DashboardPage() {
  const { equipment, campPlans, documents, users, locations, groups } = useData();
  const { currentUser, hasPermission, activeGroupId } = useAuth();
  const isAdmin = hasPermission(["Admin"]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const userGroupIds = currentUser?.role === "Admin"
    ? groups.map((g) => g.id)
    : currentUser?.groupIds || [];

  const filterByGroup = <T extends { groupId: string }>(items: T[]) => {
    if (activeGroupId && activeGroupId !== "all") return items.filter((i) => i.groupId === activeGroupId);
    return items.filter((i) => !i.groupId || userGroupIds.includes(i.groupId));
  };

  const myEquipment = filterByGroup(equipment);
  const myCamps = filterByGroup(campPlans);
  const myDocs = filterByGroup(documents);
  const myLocations = filterByGroup(locations);
  const pendingUsers = users.filter((u) => u.status === "Pending");

  const conditionCounts = { Good: 0, "Needs Repair": 0, Broken: 0, Missing: 0 };
  myEquipment.forEach((e) => { conditionCounts[e.condition]++; });

  const pieData = Object.entries(conditionCounts).map(([name, value]) => ({ name, value }));
  const pieColors = ["#10b981", "#f59e0b", "#ef4444", "#6b7280"];

  const now = new Date();
  const overdueChecks = myEquipment.filter((e) => new Date(e.nextCheckDate) < now);
  const upcomingChecks = myEquipment.filter((e) => {
    const d = new Date(e.nextCheckDate);
    return d >= now && d <= new Date(now.getTime() + 30 * 86400000);
  });
  const upcomingCamps = myCamps.filter((c) => new Date(c.startDate) >= now);

  // Prepare calendar data
  const campDates = upcomingCamps.map((camp) => ({
    start: new Date(camp.startDate),
    end: new Date(camp.endDate),
    camp,
  }));

  // Get all dates that have camps
  const highlightedDates = campDates.flatMap(({ start, end }) => {
    const dates = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  });

  // Get camps for selected date
  const campsOnSelectedDate = selectedDate
    ? campDates.filter(
        ({ start, end }) => selectedDate >= start && selectedDate <= end
      )
    : [];

  const barData = groups.filter((g) => userGroupIds.includes(g.id)).map((g) => ({
    name: g.name,
    count: equipment.filter((e) => e.groupId === g.id).length,
  }));

  const cards = [
    { label: "Total Equipment", value: myEquipment.length, icon: Package, color: "text-primary" },
    { label: "Locations", value: myLocations.length, icon: MapPin, color: "text-chart-2" },
    { label: "Upcoming Camps", value: upcomingCamps.length, icon: CalendarDays, color: "text-chart-4" },
    { label: "Overdue Checks", value: overdueChecks.length, icon: AlertTriangle, color: "text-chart-5" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome back, {currentUser?.name}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-2xl mt-1 text-foreground">{c.value}</p>
              </div>
              <c.icon className={`w-8 h-8 ${c.color} opacity-70`} />
            </div>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-foreground mb-4">Upcoming Camps Calendar</h3>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 flex justify-center">
            <style>{`
              .rdp {
                --rdp-cell-size: 45px;
                --rdp-accent-color: var(--primary);
                --rdp-background-color: var(--primary);
                margin: 0;
              }
              .rdp-months {
                justify-content: center;
              }
              .rdp-caption {
                color: var(--foreground);
                margin-bottom: 1rem;
              }
              .rdp-head_cell {
                color: var(--muted-foreground);
                font-weight: 500;
                font-size: 0.875rem;
              }
              .rdp-cell {
                color: var(--foreground);
              }
              .rdp-day {
                border-radius: 0.5rem;
                color: var(--foreground);
              }
              .rdp-day:hover:not(.rdp-day_selected) {
                background-color: var(--accent);
              }
              .rdp-day_selected {
                background-color: var(--primary) !important;
                color: var(--primary-foreground) !important;
              }
              .rdp-day.highlighted {
                background-color: rgb(147 51 234) !important;
                color: white !important;
                font-weight: 600;
              }
              .rdp-day.highlighted:hover {
                background-color: rgb(126 34 206) !important;
              }
              .rdp-day_outside {
                color: var(--muted-foreground);
                opacity: 0.5;
              }
              .rdp-nav_button {
                color: var(--foreground);
              }
              .rdp-nav_button:hover {
                background-color: var(--accent);
              }
            `}</style>
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={{
                highlighted: highlightedDates,
              }}
              modifiersClassNames={{
                highlighted: "highlighted",
              }}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </div>
          <div className="flex-1">
            {selectedDate && campsOnSelectedDate.length > 0 ? (
              <div>
                <h4 className="text-foreground font-semibold mb-3">
                  Camps on {format(selectedDate, "PPP")}
                </h4>
                <div className="space-y-3">
                  {campsOnSelectedDate.map(({ camp }) => (
                    <div
                      key={camp.id}
                      className="p-4 bg-accent/50 rounded-lg border border-border"
                    >
                      <p className="text-foreground font-medium">{camp.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {camp.startDate} - {camp.endDate}
                      </p>
                      {camp.location && (
                        <p className="text-sm text-muted-foreground mt-1">
                          📍 {camp.location}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : upcomingCamps.length > 0 ? (
              <div>
                <h4 className="text-foreground font-semibold mb-3">
                  All Upcoming Camps
                </h4>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {upcomingCamps.map((camp) => (
                    <div
                      key={camp.id}
                      className="p-4 bg-accent/50 rounded-lg border border-border cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => setSelectedDate(new Date(camp.startDate))}
                    >
                      <p className="text-foreground font-medium">{camp.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {camp.startDate} - {camp.endDate}
                      </p>
                      {camp.location && (
                        <p className="text-sm text-muted-foreground mt-1">
                          📍 {camp.location}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No upcoming camps scheduled</p>
                </div>
              </div>
            )}
          </div>
        </div>
        {upcomingCamps.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-purple-600" />
                <span className="text-muted-foreground">Camp dates</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-primary" />
                <span className="text-muted-foreground">Selected date</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="text-foreground">Upcoming Checks</h3>
          </div>
          {upcomingChecks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming checks</p>
          ) : (
            <div className="space-y-3">
              {upcomingChecks.slice(0, 5).map((e) => (
                <div key={e.id} className="flex justify-between items-center text-sm">
                  <span className="text-foreground">{e.name}</span>
                  <span className="text-muted-foreground">{e.nextCheckDate}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-foreground">Documents (removed)</h3>
          </div>
          <p className="text-sm text-muted-foreground">Document management has been removed from this deployment.</p>
        </div>

        {isAdmin ? (
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="text-foreground">Pending Users</h3>
            </div>
            {pendingUsers.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-green-500" />
                No pending approvals
              </div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((u) => (
                  <div key={u.id} className="flex justify-between items-center text-sm">
                    <span className="text-foreground">{u.name}</span>
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded text-xs">Pending</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-4 h-4 text-primary" />
              <h3 className="text-foreground">Upcoming Camps</h3>
            </div>
            {upcomingCamps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming camps</p>
            ) : (
              <div className="space-y-3">
                {upcomingCamps.map((c) => (
                  <div key={c.id} className="text-sm">
                    <span className="text-foreground">{c.name}</span>
                    <p className="text-muted-foreground text-xs">{c.startDate} - {c.endDate}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}