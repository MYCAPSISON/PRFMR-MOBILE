import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch, clearSession, loadSession, loginWithXhr, setAuthErrorCallback } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { resetRevenueCatForLogout } from "@/lib/revenuecat";

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
  /** Server-authoritative value sourced from users_auth.is_founding. */
  isFounding?: boolean;
  /** Supported until the API consistently uses camelCase. */
  is_founding?: boolean;
}

// The server never returns an `onboardingComplete` field on the User object.
// Server-side, onboarding status is inferred the same way: targetCalories
// only gets populated at the very end of POST /user/me/onboard, once macros
// have been calculated, so it doubles as the completion flag. Mirror that
// exact check here instead of a broader client-side guess.
export function isOnboardingComplete(profile: User | null | undefined): boolean {
  if (!profile) return false;
  return profile.targetCalories != null;
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
      // The backend is authoritative for founding eligibility. Accept either
      // server casing but keep one normalized value for app consumers.
      setUser({
        ...data,
        isFounding: data.isFounding ?? data.is_founding ?? false,
      });
    } catch {
      setUser(null);
    }
  }, []);

  // On app start: restore saved cookies from secure storage, then check auth
  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        await loadSession();
        await fetchUser();
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void restoreSession();
    return () => {
      active = false;
    };
  }, [fetchUser]);

  // Register a 401 callback so apiFetch can clear stale sessions automatically
  useEffect(() => {
    setAuthErrorCallback(() => {
      void resetRevenueCatForLogout();
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
      // API expects "inviteToken" (§34.4), not "inviteCode"
      body: { email, username, password, inviteToken: inviteCode },
    });
    await fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    // Clear local Pro/founding/offering state before the auth session changes.
    // This prevents a second account ever rendering with the prior account's
    // RevenueCat CustomerInfo during an account switch.
    await resetRevenueCatForLogout();
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore server errors on logout
    }
    await clearSession();
    queryClient.clear();   // wipe all cached query data so next user starts fresh
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
