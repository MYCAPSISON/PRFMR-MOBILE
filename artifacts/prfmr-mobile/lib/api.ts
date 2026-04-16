import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`).replace(/\/$/, "");

if (__DEV__) {
  console.log("[api] Base URL:", API_BASE);
}

// In-memory session cookie (name=value only, no attributes)
let sessionCookie: string | null = null;

/** Extract only the name=value pair from a Set-Cookie header, stripping all attributes. */
function extractCookieValue(setCookieHeader: string): string {
  return setCookieHeader.split(";")[0].trim();
}

/** Try every available method to read Set-Cookie from a fetch Response on iOS RN. */
function extractSetCookieFromHeaders(headers: Headers): string | null {
  // Standard fetch headers API
  const direct = headers.get("set-cookie");
  if (direct) return direct;

  // Case variants (some RN versions are case-sensitive)
  for (const variant of ["Set-Cookie", "SET-COOKIE"]) {
    const val = headers.get(variant);
    if (val) return val;
  }

  // Iterate all headers (handles combined headers)
  let found: string | null = null;
  try {
    headers.forEach((value, key) => {
      if (!found && key.toLowerCase() === "set-cookie") found = value;
    });
  } catch { /* forEach not available in all RN versions */ }
  if (found) return found;

  // Internal _headers (older RN/Expo)
  const raw = headers as any;
  for (const prop of ["_headers", "map"]) {
    if (raw[prop]) {
      const k = Object.keys(raw[prop]).find(k => k.toLowerCase() === "set-cookie");
      if (k && Array.isArray(raw[prop][k]) && raw[prop][k].length) return raw[prop][k][0];
    }
  }

  return null;
}

/**
 * XHR-based POST that captures the Set-Cookie response header.
 * React Native's XHR implementation exposes Set-Cookie headers
 * more reliably than its Fetch implementation (which mimics the
 * browser's restriction on accessing HttpOnly cookies).
 */
function xhrLogin(url: string, body: object): Promise<{ data: any; cookie: string | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.withCredentials = true;
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const cookie = xhr.getResponseHeader("set-cookie");
        if (__DEV__) {
          console.log("[xhr] login set-cookie:", cookie ?? "NONE");
          // Try all header names
          const allHeaders = xhr.getAllResponseHeaders();
          console.log("[xhr] all response headers:", allHeaders);
        }
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({ data, cookie });
        } catch {
          resolve({ data: {}, cookie });
        }
      } else {
        let msg = `HTTP ${xhr.status}`;
        try {
          const e = JSON.parse(xhr.responseText);
          msg = e.message ?? e.error ?? msg;
        } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during login"));
    xhr.send(JSON.stringify(body));
  });
}

export async function loginWithXhr(identifier: string, password: string): Promise<any> {
  const url = `${API_BASE}/auth/login`;
  const { data, cookie } = await xhrLogin(url, { identifier, password });
  if (cookie) {
    await saveSession(cookie);
    if (__DEV__) console.log("[auth] Session captured via XHR set-cookie ✓");
  } else {
    if (__DEV__) console.warn("[auth] No set-cookie header from login — will try credentials:include fallback");
  }
  return data;
}

export async function loadSession(): Promise<string | null> {
  if (Platform.OS === "web") {
    sessionCookie = localStorage.getItem("prfmr_session");
  } else {
    sessionCookie = await SecureStore.getItemAsync("prfmr_session");
  }
  if (__DEV__) {
    console.log("[api] Session on load:", sessionCookie ? sessionCookie.split("=")[0] + "=..." : "none");
  }
  return sessionCookie;
}

export async function saveSession(cookie: string): Promise<void> {
  const cleaned = extractCookieValue(cookie);
  sessionCookie = cleaned;
  if (__DEV__) {
    console.log("[api] Session saved:", cleaned.split("=")[0] + "=...");
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
  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (sessionCookie) {
    reqHeaders["Cookie"] = sessionCookie;
  }

  if (__DEV__) {
    console.log(`[api] → ${path} | cookie: ${sessionCookie ? "YES (" + sessionCookie.split("=")[0] + ")" : "NO"}`);
  }

  const url = `${API_BASE}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: reqHeaders,
      credentials: "include",
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (networkErr) {
    console.error("[api] Network error:", path, networkErr);
    throw new Error("Cannot reach the server. Check your internet connection.");
  }

  // Try to capture any new Set-Cookie from the response
  const setCookieHeader = extractSetCookieFromHeaders(response.headers);
  if (setCookieHeader) {
    await saveSession(setCookieHeader);
  }

  if (__DEV__) {
    console.log(`[api] ← ${path} ${response.status} | set-cookie: ${setCookieHeader ? "YES" : "NO"}`);
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message ?? errorData.error ?? errorMessage;
    } catch { /* ignore */ }
    console.error("[api] Error:", path, response.status, errorMessage);
    throw new Error(errorMessage);
  }

  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error("[api] Non-JSON from", path, text.slice(0, 200));
    throw new Error(`Unexpected response from ${path}`);
  }
}
