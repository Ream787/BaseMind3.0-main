import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";
import { idbGet, idbSet, idbDelete } from "@/lib/offline/db";
import { signInEmailFor } from "@/lib/usernames";
import type { Role, UserProfile } from "@/types/database";

const profileKey = (userId: string) => `profile:${userId}`;

interface AuthContextType {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  /** True when the profile came from cache because the server was unreachable. */
  usingCachedProfile: boolean;
  /** Takes a username or an email; either signs the same account in. */
  login: (identifier: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  hasRole: (roles: Role[]) => boolean;
  /**
   * Fold an already-saved change into the profile held here, so the rest of
   * the app sees it without a round trip. Saving is the caller's job; this
   * only keeps the copy in memory (and the offline cache) in step.
   */
  patchProfile: (patch: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingCachedProfile, setUsingCachedProfile] = useState(false);

  /**
   * Loads the signed-in user's profile, falling back to the last known copy
   * when the server can't be reached.
   *
   * Without this, an already-signed-in leader at a camp with no signal would
   * be bounced to the login screen — exactly when the safety plan is needed.
   * Supabase keeps the session itself in local storage, so only the profile
   * row needs caching.
   *
   * The cached role decides what the UI offers, not what the database allows:
   * RLS still runs server-side, so a stale role can't be used to actually do
   * anything once the connection returns.
   */
  async function fetchProfile(userId: string) {
    const { data, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (!fetchError && data) {
      setError(null);
      setProfile(data);
      setUsingCachedProfile(false);
      void idbSet(profileKey(userId), data);
      return;
    }

    const cached = await idbGet<UserProfile>(profileKey(userId));
    if (cached) {
      setError(null);
      setProfile(cached);
      setUsingCachedProfile(true);
      return;
    }

    setError(fetchError?.message ?? "Couldn't load your profile.");
    setProfile(null);
    setUsingCachedProfile(false);
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await fetchProfile(data.session.user.id);
      if (active) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!active) return;
      setSession(newSession);
      if (newSession) {
        await fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function login(identifier: string, password: string) {
    setError(null);
    // A username maps to a fixed derived address, so this works without ever
    // asking the server who owns a username — which would be a way to read
    // people's email addresses out of the app.
    const email = signInEmailFor(identifier);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      // Signing in genuinely needs the server; say so plainly rather than
      // reporting it as a rejected password.
      const message = /fetch|network|timeout/i.test(signInError.message)
        ? "Can't reach the server. Check your connection and try again."
        : /invalid login credentials/i.test(signInError.message)
          ? "That username or password isn't right."
          : signInError.message;
      setError(message);
      return message;
    }
    return null;
  }

  async function logout() {
    const userId = session?.user.id;
    await supabase.auth.signOut();
    setProfile(null);
    setUsingCachedProfile(false);
    // Don't leave a signed-out user's details on a shared phone.
    if (userId) void idbDelete(profileKey(userId));
  }

  function patchProfile(patch: Partial<UserProfile>) {
    setProfile((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      void idbSet(profileKey(next.id), next);
      return next;
    });
  }

  function hasRole(roles: Role[]) {
    return !!profile && profile.status === "Active" && roles.includes(profile.role);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        error,
        usingCachedProfile,
        login,
        logout,
        hasRole,
        patchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
