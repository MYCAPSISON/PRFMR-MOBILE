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
  goal?: "fat_loss" | "maintenance" | "weight_gain";
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

  // On app start: restore saved cookies from secure storage, then check auth
  useEffect(() => {
    (async () => {
      await loadSession();
      await fetchUser();
      setIsLoading(false);
    })();
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string) => {
    // XHR is used here because React Native's Fetch API hides Set-Cookie
    // headers from JavaScript (mimics browser security). XHR exposes them.
    const result = await loginWithXhr(email, password);

    // If login response body includes user data, use it directly
    if (result?.user) {
      setUser(result.user);
    } else {
      // Fallback: fetch user now that we have session cookies
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
