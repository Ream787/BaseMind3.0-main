import { useState } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Save, Shield, Sun, Moon, Key, Globe, User, Mail, Phone, Lock, Camera, Eye, EyeOff } from "lucide-react";
import { supabaseUrl, publicAnonKey } from "../../../utils/supabase/info";
import { supabase } from "../../../utils/supabase/client";

const API_BASE = `${supabaseUrl}/functions/v1/server`;

export function SettingsPage() {
  const { settings, setSettings, users, setUsers } = useData();
  const { currentUser, updateCurrentUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Profile editing state
  const [profilePicture, setProfilePicture] = useState(currentUser?.profilePicture || "");
  const [name, setName] = useState(currentUser?.name || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaveError("");
    
    try {
      // Update local state
      setSettings(localSettings);
      
      // Save individual settings to the app_settings table
      const settingsToSave = [
        { key: 'registrationEnabled', value: String(localSettings.registrationEnabled) },
        { key: 'accessCode', value: localSettings.accessCode }
      ];

      const { error } = await supabase.from('app_settings').upsert(settingsToSave, { onConflict: 'key' });
      if (error) {
        throw new Error(error.message);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error: any) {
      console.error("Settings save error:", error);
      setSaveError(error?.message || "Failed to save settings. Please try again.");
      setTimeout(() => setSaveError(""), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfile = async () => {
    if (!currentUser) return;

    setProfileError("");
    setProfileSaved(false);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setProfileError("Please enter a valid email address");
      return;
    }

    // Check if email is already taken by another user
    const emailTaken = users.some(u => u.email === email && u.id !== currentUser.id);
    if (emailTaken) {
      setProfileError("Email is already taken");
      return;
    }

    try {
      // Update user in the database
      const updatedUser = {
        ...currentUser,
        name,
        email,
        phone,
        profilePicture,
      };

      // Update in the users array
      const updatedUsers = users.map(u => u.id === currentUser.id ? updatedUser : u);
      setUsers(updatedUsers);

      // Update current user in context and localStorage
      updateCurrentUser(updatedUser);

      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (error) {
      console.error("Profile update error:", error);
      setProfileError("Failed to update profile. Please try again.");
    }
  };

  const changePassword = async () => {
    if (!currentUser) return;

    setPasswordError("");
    setPasswordSuccess(false);

    // Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All password fields are required");
      return;
    }

    // Verify current password
    if (currentUser.password !== currentPassword) {
      setPasswordError("Current password is incorrect");
      return;
    }

    // Validate new password
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    // Check if new password is different from current
    if (newPassword === currentPassword) {
      setPasswordError("New password must be different from current password");
      return;
    }

    try {
      // Update user password
      const updatedUser = {
        ...currentUser,
        password: newPassword,
        mustChangePassword: false,
      };

      // Update in the users array
      const updatedUsers = users.map(u => u.id === currentUser.id ? updatedUser : u);
      setUsers(updatedUsers);

      // Update current user in context and localStorage
      updateCurrentUser(updatedUser);

      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error) {
      console.error("Password change error:", error);
      setPasswordError("Failed to change password. Please try again.");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">System configuration</p>
      </div>

      {saved && (
        <div className="p-3 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 rounded-lg text-sm">✓ Settings saved successfully! Changes will apply across all devices.</div>
      )}

      {saveError && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">{saveError}</div>
      )}

      {/* Theme */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          {theme === "light" ? <Sun className="w-5 h-5 text-primary" /> : <Moon className="w-5 h-5 text-primary" />}
          <h3 className="text-foreground">Appearance</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">Dark Mode</p>
            <p className="text-xs text-muted-foreground">Toggle between light and dark theme</p>
          </div>
          <button onClick={toggleTheme} className={`relative w-12 h-6 rounded-full transition-colors ${theme === "dark" ? "bg-primary" : "bg-switch-background"}`}>
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${theme === "dark" ? "left-6.5" : "left-0.5"}`} />
          </button>
        </div>
      </div>

      {/* Registration */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-primary" />
          <h3 className="text-foreground">User Registration</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Enable Registration Page</p>
              <p className="text-xs text-muted-foreground">Allow public user registration</p>
            </div>
            <button
              onClick={() => setLocalSettings((s) => ({ ...s, registrationEnabled: !s.registrationEnabled }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${localSettings.registrationEnabled ? "bg-primary" : "bg-switch-background"}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${localSettings.registrationEnabled ? "left-6.5" : "left-0.5"}`} />
            </button>
          </div>
          <div>
            <label htmlFor="settings-access-code" className="text-sm flex items-center gap-2"><Key className="w-4 h-4" /> Access Code (optional)</label>
            <input
              id="settings-access-code"
              name="accessCode"
              value={localSettings.accessCode}
              onChange={(e) => setLocalSettings((s) => ({ ...s, accessCode: e.target.value }))}
              placeholder="Leave blank for no code"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-input-background text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">Users must enter this code to access the registration page</p>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="text-foreground">Security</h3>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex justify-between"><span>Authentication</span><span className="text-foreground">Email + Password</span></div>
          <div className="flex justify-between"><span>Session Management</span><span className="text-foreground">Local Storage</span></div>
          <div className="flex justify-between"><span>AI API Key</span><span className="text-foreground">GOOGLE_AI_API_KEY (env)</span></div>
          <div className="flex justify-between"><span>Social Login</span><span className="text-muted-foreground">Disabled</span></div>
        </div>
      </div>

      {/* Feature Toggles - Admin Only */}
      {currentUser?.role === "Admin" && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="text-foreground">Feature Management</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Enable or disable features for your organization</p>
          <div className="space-y-3">
            {/* Chatbot feature removed */}

            {/* Equipment Tracking Toggle */}
            <div className="flex items-center justify-between p-3 bg-input-background rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Equipment Tracking</p>
                <p className="text-xs text-muted-foreground">Enable/disable equipment management</p>
              </div>
              <button
                onClick={() => setLocalSettings((s) => ({
                  ...s,
                  features: { ...s.features, equipmentTrackingEnabled: !s.features.equipmentTrackingEnabled }
                }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${localSettings.features?.equipmentTrackingEnabled ? "bg-primary" : "bg-switch-background"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${localSettings.features?.equipmentTrackingEnabled ? "left-6.5" : "left-0.5"}`} />
              </button>
            </div>

            {/* Camp Planning Toggle */}
            <div className="flex items-center justify-between p-3 bg-input-background rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Camp Planning</p>
                <p className="text-xs text-muted-foreground">Enable/disable camp planning features</p>
              </div>
              <button
                onClick={() => setLocalSettings((s) => ({
                  ...s,
                  features: { ...s.features, campPlanningEnabled: !s.features.campPlanningEnabled }
                }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${localSettings.features?.campPlanningEnabled ? "bg-primary" : "bg-switch-background"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${localSettings.features?.campPlanningEnabled ? "left-6.5" : "left-0.5"}`} />
              </button>
            </div>

            {/* Document Management Toggle */}
            <div className="flex items-center justify-between p-3 bg-input-background rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Document Management</p>
                <p className="text-xs text-muted-foreground">Enable/disable document storage</p>
              </div>
              <button
                onClick={() => setLocalSettings((s) => ({
                  ...s,
                  features: { ...s.features, documentManagementEnabled: !s.features.documentManagementEnabled }
                }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${localSettings.features?.documentManagementEnabled ? "bg-primary" : "bg-switch-background"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${localSettings.features?.documentManagementEnabled ? "left-6.5" : "left-0.5"}`} />
              </button>
            </div>

            {/* Group Management Toggle */}
            <div className="flex items-center justify-between p-3 bg-input-background rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Group Management</p>
                <p className="text-xs text-muted-foreground">Enable/disable group management</p>
              </div>
              <button
                onClick={() => setLocalSettings((s) => ({
                  ...s,
                  features: { ...s.features, groupManagementEnabled: !s.features.groupManagementEnabled }
                }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${localSettings.features?.groupManagementEnabled ? "bg-primary" : "bg-switch-background"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${localSettings.features?.groupManagementEnabled ? "left-6.5" : "left-0.5"}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      <button onClick={save} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
        {saving ? (
          <>
            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-4 h-4" /> Save Settings
          </>
        )}
      </button>

      {/* Profile Section */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-primary" />
          <h3 className="text-foreground">Profile</h3>
        </div>
        
        {profileSaved && (
          <div className="p-3 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 rounded-lg text-sm mb-4">
            Profile saved successfully!
          </div>
        )}
        
        {profileError && (
          <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 rounded-lg text-sm mb-4">
            {profileError}
          </div>
        )}

        <div className="space-y-4">
          {/* Profile Picture */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-border">
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-primary" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1.5 cursor-pointer hover:opacity-90">
                <Camera className="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className="hidden"
                />
              </label>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Profile Picture</p>
              <p className="text-xs text-muted-foreground">Click the camera icon to upload</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="profile-name" className="text-sm font-medium text-foreground flex items-center gap-2 mb-1">
              <User className="w-4 h-4" /> Name
            </label>
            <input
              id="profile-name"
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-1">
              <Mail className="w-4 h-4" /> Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-1">
              <Phone className="w-4 h-4" /> Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your phone number"
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <button
            onClick={saveProfile}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 w-full justify-center"
          >
            <Save className="w-4 h-4" /> Save Profile
          </button>
        </div>
      </div>

      {/* Password Section */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-5 h-5 text-primary" />
          <h3 className="text-foreground">Change Password</h3>
        </div>

        {passwordSuccess && (
          <div className="p-3 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 rounded-lg text-sm mb-4">
            Password changed successfully!
          </div>
        )}
        
        {passwordError && (
          <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 rounded-lg text-sm mb-4">
            {passwordError}
          </div>
        )}

        <div className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4" /> Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-1">
              <Key className="w-4 h-4" /> New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter your new password"
                className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Must be at least 6 characters</p>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-1">
              <Key className="w-4 h-4" /> Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={changePassword}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 w-full justify-center"
          >
            <Lock className="w-4 h-4" /> Change Password
          </button>
        </div>
      </div>
    </div>
  );
}