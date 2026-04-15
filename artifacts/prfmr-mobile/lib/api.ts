import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`).replace(/\/$/, "");

if (__DEV__) {
  console.log("[api] Base URL:", API_BASE);
}

let sessionCookie: string | null = null;

export async function loadSession(): Promise<string | null> {
  if (Platform.OS === "web") {
    sessionCookie = localStorage.getItem("prfmr_session");
  } else {
    sessionCookie = await SecureStore.getItemAsync("prfmr_session");
  }
  return sessionCookie;
}

export async function saveSession(cookie: string): Promise<void> {
  sessionCookie = cookie;
  if (Platform.OS === "web") {
    localStorage.setItem("prfmr_session", cookie);
  } else {
    await SecureStore.setItemAsync("prfmr_session", cookie);
  }
}

export async function clearSession(): Promise<void> {
  sessionCookie = null;
  if (Platform.OS === "web") {
    localStorage.removeItem("prfmr_session");
  } else {
    await SecureStore.deleteItemAsync("prfmr_session");
  }
}

export function getSession(): string | null {
  return sessionCookie;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (sessionCookie) {
    headers["Cookie"] = sessionCookie;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      credentials: sessionCookie ? "omit" : "include",
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (networkErr) {
    console.error("[api] Network error hitting:", `${API_BASE}${path}`, networkErr);
    throw new Error(`Cannot reach the server. Check your internet connection or contact support.`);
  }

  const setCookieHeader = response.headers.get("set-cookie");
  if (setCookieHeader) {
    await saveSession(setCookieHeader);
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message ?? errorData.error ?? errorMessage;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.slice(0, 300);
    console.error("[api] Non-JSON response from", `${API_BASE}${path}`, "status:", response.status, "body:", preview);
    throw new Error(`Server returned HTML (status ${response.status}) from ${API_BASE}${path} — is your API URL correct?`);
  }
}
