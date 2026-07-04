import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch, clearSession, loadSession, loginWithXhr, setAuthErrorCallback } from "@/lib/api";

export interface User {
  id: number;
  email: string;
  username: string;
  displayName?: string;
  currentWeight?: number;
  height?: number;
  age?: number;
  gender?: "male" | "female";
  goal?: "fat_loss" | "maintenance" | "weight_gain";
  activityLevel?: string;
  experienceLevel?: string;
  mainSport?: string;
  sport?: string;
  weightClass?: string;
  bodyFatPct?: number;
  fightCampActive?: boolean;
  fightDate?: string;
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  createdAt?: string;
}

// The server never returns an `onboardingComplete` field on the User object.
// Per spec, onboarding completion is a client-computed check based on
// whether the core profile fields were persisted by the onboarding wizard.
export function isOnboardingComplete(profile: User | null | undefined): boolean {
  if (!profile) return false;
  return (
    profile.targetCalories != null &&
    profile.age != null &&
    profile.gender != null &&
    profile.height != null &&
    profile.currentWeight != null &&
    profile.activityLevel != null
  );
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, inviteCode: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const data = await apiFetch<User>("/user/me");
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  // On app start: restore saved cookies from secure storage, then check auth
  useEffect(() => {
    (async () => {
      await loadSession();
      await fetchUser();
      setIsLoading(false);
    })();
  }, [fetchUser]);

  // Register a 401 callback so apiFetch can clear stale sessions automatically
  useEffect(() => {
    setAuthErrorCallback(() => {
      clearSession();
      setUser(null);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // XHR is used here because React Native's Fetch API hides Set-Cookie
    // headers from JavaScript (mimics browser security). XHR exposes them.
    await loginWithXhr(email, password);

    // Always fetch the full profile after login rather than trusting the
    // login response body — it only returns a minimal user object
    // (id, email, username, emailVerified) and is missing onboardingComplete
    // and other profile fields. Using it directly made already-onboarded
    // users get bounced back into the onboarding wizard on every login.
    await fetchUser();
  }, [fetchUser]);

  const register = useCallback(async (email: string, username: string, password: string, inviteCode: string) => {
    await apiFetch<{ user: User }>("/auth/register", {
      method: "POST",
      body: { email, username, password, inviteCode },
    });
    await fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore server errors on logout
    }
    await clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refetchUser: fetchUser,
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
