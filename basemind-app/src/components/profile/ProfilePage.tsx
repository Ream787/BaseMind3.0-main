import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Moon, ShieldCheck, Sun } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useOffline } from "@/context/OfflineContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { IconPicker } from "@/components/profile/IconPicker";
import { isValidUsername, normaliseUsername, USERNAME_RULE } from "@/lib/usernames";

export function ProfilePage() {
  const { profile, session, patchProfile } = useAuth();
  const { online } = useOffline();
  const { theme, toggleTheme } = useTheme();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setName(profile?.name ?? "");
    setUsername(profile?.username ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile]);

  if (!profile) return null;

  const detailsChanged =
    name.trim() !== (profile.name ?? "") ||
    normaliseUsername(username) !== (profile.username ?? "") ||
    phone.trim() !== (profile.phone ?? "");

  async function saveDetails(e: FormEvent) {
    e.preventDefault();

    const handle = normaliseUsername(username);
    if (!isValidUsername(handle)) {
      setDetailsError(`That username won't work. ${USERNAME_RULE}`);
      return;
    }

    setDetailsError(null);
    setSavingDetails(true);
    // role and status are deliberately absent: the database trigger reverts
    // them for anyone who isn't an admin, so sending them would silently
    // achieve nothing.
    const { error } = await supabase
      .from("users")
      .update({ name: name.trim(), username: handle, phone: phone.trim() || null })
      .eq("id", profile!.id);
    setSavingDetails(false);

    if (error) {
      // 23505 is the unique index on lower(username). Say what it means
      // rather than showing the constraint name.
      setDetailsError(
        error.code === "23505"
          ? `Somebody already goes by "${handle}". Pick another.`
          : error.message,
      );
      return;
    }

    const changedUsername = handle !== (profile!.username ?? "");
    toast.success(
      changedUsername
        ? `Saved — you now sign in as "${handle}"`
        : "Your details were saved",
    );
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setPasswordError("Use at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("The two passwords don't match.");
      return;
    }
    setPasswordError(null);
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    toast.success("Password changed");
  }

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <div>
        <h1>Your profile</h1>
        <p className="text-sm text-muted-foreground">
          Your own details. Ask an admin to change your role or approve access.
        </p>
      </div>

      {!online && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          You&apos;re offline, so changes here can&apos;t be saved yet.
        </p>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="font-medium">Details</h2>
        <form onSubmit={saveDetails} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              required
              disabled={!online}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-username">Username</Label>
            <Input
              id="profile-username"
              required
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              disabled={!online}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {USERNAME_RULE} You sign in with this or your email
              {profile.email ? ` (${profile.email})` : ""}, so changing it changes how you
              sign in.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-phone">Phone</Label>
            <Input
              id="profile-phone"
              type="tel"
              disabled={!online}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          {detailsError && <p className="text-sm text-destructive">{detailsError}</p>}
          <Button
            type="submit"
            className="self-start"
            disabled={!online || savingDetails || !detailsChanged}
          >
            {savingDetails ? "Saving…" : "Save details"}
          </Button>
        </form>
      </section>

      <IconPicker profile={profile} online={online} onChange={patchProfile} />

      <section className="flex flex-col gap-3 border-t pt-6">
        <h2 className="font-medium">Appearance</h2>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">Dark mode</span>
            <span className="text-sm text-muted-foreground">
              Kept on this device — it doesn&apos;t change anything for anyone else.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={toggleTheme}
            // The button says what pressing it does, so it is not a toggle
            // that is on: "Light, pressed" is what aria-pressed made a
            // screen reader announce while the app was in dark mode.
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <>
                <Sun className="size-4" />
                Light
              </>
            ) : (
              <>
                <Moon className="size-4" />
                Dark
              </>
            )}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t pt-6">
        <h2 className="font-medium">Account</h2>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{profile.email}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Role</dt>
            <dd>
              <Badge variant="secondary">{profile.role}</Badge>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-muted-foreground" />
              {profile.status}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">
          Your email address is how you sign in and can&apos;t be changed here.
        </p>
      </section>

      <section className="flex flex-col gap-4 border-t pt-6">
        <div>
          <h2 className="flex items-center gap-2 font-medium">
            <KeyRound className="size-4" />
            Change password
          </h2>
          <p className="text-sm text-muted-foreground">
            You&apos;ll stay signed in on this device.
          </p>
        </div>
        <form onSubmit={changePassword} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-password">New password</Label>
            <Input
              id="profile-password"
              type="password"
              autoComplete="new-password"
              disabled={!online}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-password-confirm">Confirm new password</Label>
            <Input
              id="profile-password-confirm"
              type="password"
              autoComplete="new-password"
              disabled={!online}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          <Button
            type="submit"
            variant="outline"
            className="self-start"
            disabled={!online || savingPassword || !password}
          >
            {savingPassword ? "Changing…" : "Change password"}
          </Button>
        </form>
        {session?.user.email && (
          <p className="text-xs text-muted-foreground">
            Signed in as {session.user.email}.
          </p>
        )}
      </section>
    </div>
  );
}
