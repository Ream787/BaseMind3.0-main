import { useState } from "react";
import { Link } from "react-router";
import { useData } from "../context/DataContext";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../../../utils/supabase/client";
import { Compass, Sun, Moon, CheckCircle } from "lucide-react";
import logoDark from "figma:asset/e972e34c0ee69793ee19ed90070e9fb5189579f7.png";
import logoLight from "figma:asset/a1d437bdae94a3564f190af7dea31a8623126f40.png";

export function RegisterPage() {
  const { groups, users, setUsers, settings } = useData();
  const { theme, toggleTheme } = useTheme();
  const [form, setForm] = useState({ name: "", email: "", phone: "", groupIds: [] as string[], role: "Member" as "Member" | "Viewer" });
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!settings?.registrationEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-xl border border-border p-8 text-center max-w-md">
          <h2 className="text-foreground mb-2">Registration Disabled</h2>
          <p className="text-muted-foreground text-sm">User registration is currently closed. Please contact your administrator.</p>
          <Link to="/login" className="mt-4 inline-block text-primary hover:underline text-sm">Back to login</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      // Validate access code if required
      if (settings.accessCode && accessCode !== settings.accessCode) {
        setError("Invalid access code");
        return;
      }

      // Check if email already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', form.email)
        .single();

      if (existingUser) {
        setError("Email already registered");
        return;
      }

      // Create auth user with temporary password
      const tempPassword = Math.random().toString(36).slice(-12) + "!Aa1";
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: tempPassword,
        options: {
          data: {
            name: form.name,
            phone: form.phone,
          },
        },
      });

      if (authError) {
        setError(authError.message || "Failed to create account");
        return;
      }

      if (!authData.user) {
        setError("Failed to create account");
        return;
      }

      // Create user profile (with Pending status for admin approval)
      const { error: profileError } = await supabase.from('users').insert({
        id: authData.user.id,
        email: form.email,
        name: form.name,
        phone: form.phone,
        role: form.role,
        status: 'Pending', // Will be approved by admin
      });

      if (profileError) {
        setError(profileError.message || "Failed to create user profile");
        // Attempt to delete the auth user since profile creation failed
        await supabase.auth.admin.deleteUser(authData.user.id);
        return;
      }

      // Create group associations if selected
      if (form.groupIds.length > 0) {
        const userGroupsData = form.groupIds.map((groupId) => ({
          user_id: authData.user.id,
          group_id: groupId,
        }));
        const { error: groupError } = await supabase.from('user_groups').insert(userGroupsData);
        if (groupError) {
          console.error("Error saving user groups:", groupError.message);
        }
      }

      setSuccess(true);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Registration failed";
      setError(errMsg);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-xl border border-border p-8 text-center max-w-md">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-foreground mb-2">Registration Submitted</h2>
          <p className="text-muted-foreground text-sm">Your account request has been submitted. An administrator will review and approve your access.</p>
          <Link to="/login" className="mt-4 inline-block text-primary hover:underline text-sm">Back to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <button onClick={toggleTheme} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-accent text-muted-foreground">
        {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </button>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4">
            <img src={theme === "light" ? logoLight : logoDark} alt="BaseMind Logo" className="w-32 h-auto object-contain" />
          </div>
          <h1 className="text-foreground">Request Access</h1>
          <p className="text-muted-foreground text-sm mt-1">Submit your details for admin approval</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          {error && <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            {settings.accessCode && (
              <div>
                <label htmlFor="access-code" className="block text-sm mb-1">Access Code</label>
                <input id="access-code" name="accessCode" type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary" />
              </div>
            )}
            <div>
              <label htmlFor="reg-name" className="block text-sm mb-1">Full Name</label>
              <input id="reg-name" name="name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary" />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-sm mb-1">Email</label>
              <input id="reg-email" name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary" />
            </div>
            <div>
              <label htmlFor="reg-phone" className="block text-sm mb-1">Phone Number</label>
              <input id="reg-phone" name="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary" />
            </div>
            <div>
              <label htmlFor="reg-groups" className="block text-sm mb-1">Group(s)</label>
              <div className="max-h-32 overflow-y-auto border border-border rounded-lg p-2 space-y-1">
                {groups.length === 0 && <p className="text-xs text-muted-foreground py-1 px-2">No groups available</p>}
                {groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer py-1 px-2 rounded hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={form.groupIds.includes(g.id)}
                      onChange={() => setForm((f) => ({
                        ...f,
                        groupIds: f.groupIds.includes(g.id)
                          ? f.groupIds.filter((id) => id !== g.id)
                          : [...f.groupIds, g.id],
                      }))}
                      className="accent-primary"
                    />
                    <span className="text-foreground">{g.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1">Requested Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "Member" | "Viewer" })} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary">
                <option value="Member">Member</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>
            <button type="submit" className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90">Submit Request</button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}