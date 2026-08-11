import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "../../../utils/supabase/client";
import type { User, UserRole, UserStatus } from "./DataContext";

interface AuthContextType {
  currentUser: User | null;
  activeGroupId: string;
  mustChangePassword: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
  switchGroup: (groupId: string) => void;
  clearMustChangePassword: () => Promise<void>;
  updateCurrentUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  activeGroupId: "",
  mustChangePassword: false,
  loading: false,
  error: null,
  login: async () => null,
  logout: async () => {},
  hasPermission: () => false,
  switchGroup: () => {},
  clearMustChangePassword: async () => {},
  updateCurrentUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("scout-current-user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeGroupId, setActiveGroupId] = useState<string>(() => {
    try {
      return localStorage.getItem("scout-active-group") || "";
    } catch {
      return "";
    }
  });

  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state from Supabase on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        if (session?.user) {
          // Fetch user profile from users table
          const { data: userProfile, error: profileError } = await supabase
            .from("users")
            .select("id, email, name, phone, role, status, profile_picture")
            .eq("id", session.user.id)
            .single();

          if (profileError) throw profileError;

          if (userProfile) {
            // Get user's groups
            const { data: userGroups, error: groupsError } = await supabase
              .from("user_groups")
              .select("group_id")
              .eq("user_id", userProfile.id);

            if (groupsError) throw groupsError;

            const groupIds = userGroups?.map((ug) => ug.group_id) || [];

            const userData: User = {
              id: userProfile.id,
              email: userProfile.email,
              name: userProfile.name || "",
              phone: userProfile.phone || "",
              groupIds,
              role: userProfile.role as UserRole,
              status: userProfile.status as UserStatus,
              createdAt: session.user.created_at || new Date().toISOString(),
            };

            setCurrentUser(userData);
            localStorage.setItem("scout-current-user", JSON.stringify(userData));

            // Set default active group
            const initialGroup = userProfile.role === "Admin" ? "all" : (groupIds[0] || "");
            setActiveGroupId(initialGroup);
            localStorage.setItem("scout-active-group", initialGroup);
          }
        } else {
          // No session, clear localStorage
          localStorage.removeItem("scout-current-user");
          localStorage.removeItem("scout-active-group");
          setCurrentUser(null);
        }
      } catch (err) {
        console.error("Error initializing auth:", err);
        localStorage.removeItem("scout-current-user");
        setCurrentUser(null);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        // User just signed in - fetch their profile
        try {
          const { data: userProfile, error: profileError } = await supabase
            .from("users")
            .select("id, email, name, phone, role, status, profile_picture")
            .eq("id", session.user.id)
            .single();

          if (!profileError && userProfile) {
            const { data: userGroups } = await supabase
              .from("user_groups")
              .select("group_id")
              .eq("user_id", userProfile.id);

            const groupIds = userGroups?.map((ug) => ug.group_id) || [];

            const userData: User = {
              id: userProfile.id,
              email: userProfile.email,
              name: userProfile.name || "",
              phone: userProfile.phone || "",
              groupIds,
              role: userProfile.role as UserRole,
              status: userProfile.status as UserStatus,
              createdAt: session.user.created_at || new Date().toISOString(),
            };

            setCurrentUser(userData);
            localStorage.setItem("scout-current-user", JSON.stringify(userData));
          }
        } catch (err) {
          console.error("Error fetching user profile on sign in:", err);
        }
      } else if (event === "SIGNED_OUT") {
        setCurrentUser(null);
        setActiveGroupId("");
        setMustChangePassword(false);
        localStorage.removeItem("scout-current-user");
        localStorage.removeItem("scout-active-group");
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        const err = authError.message || "Invalid email or password";
        setError(err);
        return err;
      }

      if (!authData.user) {
        const err = "Authentication failed";
        setError(err);
        return err;
      }

      // Fetch user profile
      const { data: userProfile, error: profileError } = await supabase
        .from("users")
        .select("id, email, name, phone, role, status, profile_picture")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !userProfile) {
        const err = "Failed to load user profile";
        setError(err);
        return err;
      }

      // Check user status
      if (userProfile.status === "Pending") {
        const err = "Your account is pending approval";
        setError(err);
        return err;
      }

      if (userProfile.status === "Rejected") {
        const err = "Your account has been rejected";
        setError(err);
        return err;
      }

      // Get user's groups
      const { data: userGroups, error: groupsError } = await supabase
        .from("user_groups")
        .select("group_id")
        .eq("user_id", userProfile.id);

      if (groupsError) {
        const err = "Failed to fetch user groups";
        setError(err);
        return err;
      }

      const groupIds = userGroups?.map((ug) => ug.group_id) || [];

      const userData: User = {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name || "",
        phone: userProfile.phone || "",
        groupIds,
        role: userProfile.role as UserRole,
        status: userProfile.status as UserStatus,
        createdAt: authData.user.created_at || new Date().toISOString(),
      };

      setCurrentUser(userData);
      localStorage.setItem("scout-current-user", JSON.stringify(userData));

      // Set default active group
      const initialGroup = userProfile.role === "Admin" ? "all" : (groupIds[0] || "");
      setActiveGroupId(initialGroup);
      localStorage.setItem("scout-active-group", initialGroup);

      return null;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Login failed";
      setError(errMsg);
      return errMsg;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setActiveGroupId("");
      setMustChangePassword(false);
      localStorage.removeItem("scout-current-user");
      localStorage.removeItem("scout-active-group");
    } catch (err) {
      console.error("Error logging out:", err);
    } finally {
      setLoading(false);
    }
  };

  const clearMustChangePassword = async () => {
    if (!currentUser) return;

    try {
      const { error } = await supabase
        .from("users")
        .update({ must_change_password: false })
        .eq("id", currentUser.id);

      if (error) throw error;

      setMustChangePassword(false);
      const updated = { ...currentUser, mustChangePassword: false };
      setCurrentUser(updated);
      localStorage.setItem("scout-current-user", JSON.stringify(updated));
    } catch (err) {
      console.error("Error clearing password flag:", err);
    }
  };

  const hasPermission = (requiredRoles: UserRole[]): boolean => {
    if (!currentUser) return false;
    return requiredRoles.includes(currentUser.role);
  };

  const switchGroup = (groupId: string) => {
    setActiveGroupId(groupId);
    localStorage.setItem("scout-active-group", groupId);
  };

  const updateCurrentUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem("scout-current-user", JSON.stringify(user));
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeGroupId,
        mustChangePassword,
        loading,
        error,
        login,
        logout,
        hasPermission,
        switchGroup,
        clearMustChangePassword,
        updateCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}