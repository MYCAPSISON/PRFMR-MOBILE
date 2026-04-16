import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch, clearSession, loadSession, loginWithXhr } from "@/lib/api";

export interface User {
  id: number;
  email: string;
  username: string;
  displayName?: string;
  weight?: number;
  height?: number;
  age?: number;
  sport?: string;
  weightClass?: string;
  createdAt?: string;
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

  useEffect(() => {
    (async () => {
      await loadSession();
      await fetchUser();
      setIsLoading(false);
    })();
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string) => {
    // Use XHR for login — React Native's XHR exposes the Set-Cookie response
    // header more reliably than the Fetch API (which mimics browser HttpOnly
    // restrictions that hide cookies from JS).
    const result = await loginWithXhr(email, password);

    // Use user from login response body if available (skips a round-trip)
    if (result?.user) {
      setUser(result.user);
    } else {
      // Fallback: fetch user with the newly captured session cookie
      await fetchUser();
    }
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
      // ignore
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
