import { useState } from "react";
import { useData, type User } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { Search, UserPlus, UserMinus, X, Users as UsersIcon } from "lucide-react";

export function GroupMembersPage() {
  const { users, setUsers, groups } = useData();
  const { currentUser, activeGroupId } = useAuth();
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  if (!currentUser) return null;

  // Get the groups the current Group Manager manages
  const managerGroupIds = currentUser.groupIds || [];

  // Filter to show only the active group if one is selected
  const relevantGroupIds = activeGroupId && activeGroupId !== "all" 
    ? [activeGroupId]
    : managerGroupIds;

  const relevantGroups = groups.filter(g => relevantGroupIds.includes(g.id));

  // Get members in the manager's groups
  const groupMembers = users.filter(u => {
    const userGroupIds = u.groupIds || [];
    return relevantGroupIds.some(gId => userGroupIds.includes(gId));
  });

  // Get users not in any of the manager's groups (potential members to add)
  const availableUsers = users.filter(u => {
    const userGroupIds = u.groupIds || [];
    return !relevantGroupIds.some(gId => userGroupIds.includes(gId)) && u.status === "Active";
  });

  const filteredMembers = groupMembers.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAvailable = availableUsers.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const removeMemberFromGroup = (userId: string, groupId: string) => {
    if (confirm("Remove this member from the group?")) {
      setUsers(prev => prev.map(u => {
        if (u.id === userId) {
          const newGroupIds = u.groupIds.filter(gId => gId !== groupId);
          return { ...u, groupIds: newGroupIds };
        }
        return u;
      }));
    }
  };

  const addMemberToGroup = (userId: string, groupId: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const newGroupIds = [...(u.groupIds || []), groupId];
        return { ...u, groupIds: newGroupIds };
      }
      return u;
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground">Group Members</h1>
          <p className="text-sm text-muted-foreground">
            Manage members in your groups
            {relevantGroups.length > 0 && ` · ${relevantGroups.map(g => g.name).join(", ")}`}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
        >
          <UserPlus className="w-4 h-4" /> Add Members
        </button>
      </div>

      {relevantGroups.length === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-xl p-4">
          <p className="text-sm text-foreground">You are not assigned to any groups yet. Please contact an administrator.</p>
        </div>
      )}

      {relevantGroups.length > 0 && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-input-background text-foreground"
            />
          </div>

          {filteredMembers.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <UsersIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground mb-1">No members found</p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try adjusting your search" : "Add members to get started"}
              </p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3 hidden md:table-cell">Email</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Phone</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Groups</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((u) => {
                    const userRelevantGroups = groups.filter(g =>
                      relevantGroupIds.includes(g.id) && u.groupIds.includes(g.id)
                    );

                    return (
                      <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-3 text-foreground">{u.name}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{u.phone || "—"}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="flex flex-wrap gap-1">
                            {userRelevantGroups.map(g => (
                              <span key={g.id} className="px-2 py-0.5 bg-accent rounded text-xs">
                                {g.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {userRelevantGroups.map(g => (
                              <button
                                key={g.id}
                                onClick={() => removeMemberFromGroup(u.id, g.id)}
                                className="p-1.5 hover:bg-destructive/10 rounded flex items-center gap-1 text-xs"
                                title={`Remove from ${g.name}`}
                              >
                                <UserMinus className="w-3.5 h-3.5 text-destructive" />
                                <span className="text-muted-foreground hidden xl:inline">{g.name}</span>
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Add Members Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-foreground">Add Members to Group</h2>
              <button onClick={() => setShowAddModal(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Select users to add to your groups. You can add members to any group you manage.
              </p>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search available users..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-input-background text-foreground"
              />
            </div>

            {filteredAvailable.length === 0 ? (
              <div className="text-center py-8">
                <UsersIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground mb-1">No available users</p>
                <p className="text-sm text-muted-foreground">
                  {search
                    ? "Try adjusting your search"
                    : "All active users are already in your groups"}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredAvailable.map((u) => (
                  <div
                    key={u.id}
                    className="border border-border rounded-lg p-3 hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                          {u.role}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {relevantGroups.map(g => (
                          <button
                            key={g.id}
                            onClick={() => {
                              addMemberToGroup(u.id, g.id);
                              if (relevantGroups.length === 1) {
                                setShowAddModal(false);
                              }
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs hover:opacity-90 whitespace-nowrap"
                          >
                            <UserPlus className="w-3 h-3" />
                            Add to {g.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2 border border-border rounded-lg text-foreground hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
