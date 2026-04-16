import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`).replace(/\/$/, "");

if (__DEV__) {
  console.log("[api] Base URL:", API_BASE);
}

let sessionCookie: string | null = null;

/** Extract only the name=value pair from a Set-Cookie header (strip attributes). */
function extractCookieValue(setCookieHeader: string): string {
  return setCookieHeader.split(";")[0].trim();
}

export async function loadSession(): Promise<string | null> {
  if (Platform.OS === "web") {
    sessionCookie = localStorage.getItem("prfmr_session");
  } else {
    sessionCookie = await SecureStore.getItemAsync("prfmr_session");
  }
  if (__DEV__ && sessionCookie) {
    console.log("[api] Loaded session cookie (name only):", sessionCookie.split("=")[0]);
  }
  return sessionCookie;
}

export async function saveSession(cookie: string): Promise<void> {
  const cleaned = extractCookieValue(cookie);
  sessionCookie = cleaned;
  if (__DEV__) {
    console.log("[api] Saved session cookie:", cleaned.split("=")[0]);
  }
  if (Platform.OS === "web") {
    localStorage.setItem("prfmr_session", cleaned);
  } else {
    await SecureStore.setItemAsync("prfmr_session", cleaned);
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

  const url = `${API_BASE}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      credentials: "include",
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (networkErr) {
    console.error("[api] Network error:", path, networkErr);
    throw new Error(`Cannot reach the server. Check your internet connection.`);
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
    if (__DEV__) {
      console.error("[api] Error response:", path, response.status, errorMessage);
    }
    throw new Error(errorMessage);
  }

  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.slice(0, 300);
    console.error("[api] Non-JSON response from", path, "status:", response.status, "body:", preview);
    throw new Error(`Unexpected server response from ${path} (status ${response.status})`);
  }
}
