import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`).replace(/\/$/, "");

if (__DEV__) {
  console.log("[api] Base URL:", API_BASE);
}

// ─────────────────────────────────────────────────────────────
// Cookie jar — stores all cookies keyed by name
// e.g. { "connect.sid": "connect.sid=s%3Axxx", "GAESA": "GAESA=yyy" }
// When making requests: send "connect.sid=xxx; GAESA=yyy"
// When server sends Set-Cookie: add/update the matching entry,
// never delete existing ones. This ensures a CSRF token from /user/me
// does NOT replace the session cookie from /auth/login.
// ─────────────────────────────────────────────────────────────
let cookieJar: Record<string, string> = {};

/** Parse "name=value; Path=/; HttpOnly" → { name: "connect.sid", pair: "connect.sid=xxx" } */
function parseSetCookie(header: string): { name: string; pair: string } | null {
  const pair = header.split(";")[0].trim();
  const eqIdx = pair.indexOf("=");
  if (eqIdx < 0) return null;
  return { name: pair.slice(0, eqIdx).trim(), pair };
}

/** Add or update a single cookie from a Set-Cookie header. */
function jarAdd(setCookieHeader: string): void {
  const parsed = parseSetCookie(setCookieHeader);
  if (!parsed) return;
  cookieJar[parsed.name] = parsed.pair;
  if (__DEV__) {
    console.log("[jar] +", parsed.name, "→ jar has:", Object.keys(cookieJar).join(", "));
  }
}

/** Build the Cookie request header from all stored cookies. */
function jarHeader(): string {
  return Object.values(cookieJar).join("; ");
}

/** Persist the jar to SecureStore / localStorage. */
async function jarSave(): Promise<void> {
  const serialised = JSON.stringify(cookieJar);
  if (Platform.OS === "web") {
    localStorage.setItem("prfmr_jar", serialised);
  } else {
    await SecureStore.setItemAsync("prfmr_jar", serialised);
  }
}

/** Load the jar from SecureStore / localStorage. */
async function jarLoad(): Promise<void> {
  let raw: string | null = null;
  if (Platform.OS === "web") {
    raw = localStorage.getItem("prfmr_jar");
  } else {
    raw = await SecureStore.getItemAsync("prfmr_jar");
  }
  if (raw) {
    try {
      cookieJar = JSON.parse(raw) as Record<string, string>;
      if (__DEV__) {
        console.log("[jar] Loaded cookies:", Object.keys(cookieJar).join(", "));
      }
    } catch {
      cookieJar = {};
    }
  }
}

/** Extract and handle all Set-Cookie headers from an XHR or fetch response. */
async function processSetCookies(raw: string): Promise<void> {
  // XHR getAllResponseHeaders / fetch headers may combine multiple Set-Cookie
  // values separated by commas. Split conservatively (cookie values can have
  // commas too, but attributes like "expires" dates are the only common case).
  // We split on ", " followed by a known cookie name pattern (word=).
  const parts = raw.split(/,\s*(?=[A-Za-z_][A-Za-z0-9_\-]+=)/);
  for (const part of parts) {
    jarAdd(part.trim());
  }
  await jarSave();
}

// ─────────────────────────────────────────────────────────────
// XHR-based login (XHR exposes Set-Cookie on React Native iOS;
// the Fetch API mimics browser security and hides it)
// ─────────────────────────────────────────────────────────────
function xhrPost(url: string, body: object): Promise<{ data: any; allHeaders: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.withCredentials = true;
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const allHeaders = xhr.getAllResponseHeaders();
        if (__DEV__) {
          console.log("[xhr] login status:", xhr.status);
          console.log("[xhr] all response headers:\n", allHeaders);
        }
        try {
          resolve({ data: JSON.parse(xhr.responseText), allHeaders });
        } catch {
          resolve({ data: {}, allHeaders });
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
  const { data, allHeaders } = await xhrPost(`${API_BASE}/auth/login`, { identifier, password });

  // Parse all Set-Cookie headers from the raw header block
  // getAllResponseHeaders() returns "header: value\r\n" lines
  const lines = allHeaders.split(/\r?\n/);
  let capturedAny = false;
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const headerName = line.slice(0, colonIdx).trim().toLowerCase();
    const headerValue = line.slice(colonIdx + 1).trim();
    if (headerName === "set-cookie" && headerValue) {
      jarAdd(headerValue);
      capturedAny = true;
    }
  }

  if (capturedAny) {
    await jarSave();
    if (__DEV__) console.log("[auth] Session captured via XHR ✓ — cookies:", Object.keys(cookieJar).join(", "));
  } else {
    if (__DEV__) console.warn("[auth] XHR login: no set-cookie found in response headers");
  }

  return data;
}

// ─────────────────────────────────────────────────────────────
// Public session helpers
// ─────────────────────────────────────────────────────────────
export async function loadSession(): Promise<void> {
  await jarLoad();
}

export async function clearSession(): Promise<void> {
  cookieJar = {};
  if (Platform.OS === "web") {
    localStorage.removeItem("prfmr_jar");
  } else {
    await SecureStore.deleteItemAsync("prfmr_jar");
  }
}

export function hasSession(): boolean {
  return Object.keys(cookieJar).length > 0;
}

// ─────────────────────────────────────────────────────────────
// Core fetch wrapper
// ─────────────────────────────────────────────────────────────
interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const cookieHeader = jarHeader();
  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (cookieHeader) {
    reqHeaders["Cookie"] = cookieHeader;
  }

  if (__DEV__) {
    console.log(`[api] → ${path} | cookies: [${Object.keys(cookieJar).join(", ")}]`);
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

  // Capture any new Set-Cookie headers from the response — ADD, not replace
  let setCookieFound = false;
  const tryHeader = (h: Headers, name: string) => {
    const v = h.get(name);
    if (v) { jarAdd(v); setCookieFound = true; }
  };
  tryHeader(response.headers, "set-cookie");
  tryHeader(response.headers, "Set-Cookie");
  // forEach fallback
  try {
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") { jarAdd(value); setCookieFound = true; }
    });
  } catch { /* not all RN versions support forEach */ }

  if (setCookieFound) {
    await jarSave();
  }

  if (__DEV__) {
    console.log(`[api] ← ${path} ${response.status} | new cookie: ${setCookieFound ? "YES" : "NO"}`);
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
