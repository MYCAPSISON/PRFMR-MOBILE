import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`).replace(/\/$/, "");

if (__DEV__) {
  console.log("[api] Base URL:", API_BASE);
}

// ─────────────────────────────────────────────────────────────
// HOW AUTH WORKS IN THIS APP
//
// The PRFMR server uses two cookies:
//   connect.sid  — the session cookie (HttpOnly=true)
//   GAESA        — a CSRF / secondary token (NOT HttpOnly)
//
// Because connect.sid is HttpOnly, JavaScript code (both fetch and XHR)
// CANNOT read it. It is silently managed by the iOS native network layer
// (NSURLSession / NSHTTPCookieStorage).
//
// The solution: use credentials: "include" on EVERY fetch request.
// This tells the native iOS layer to automatically attach all cookies it has
// stored for the app.prfmr.link domain, including connect.sid.
//
// We do NOT set a manual Cookie header. Doing so was causing the native
// layer to use ONLY our manual header (GAESA alone) and ignore its own
// stored connect.sid, resulting in 401 Not Authenticated on every request.
//
// For CSRF mutations (POST/PUT/DELETE), we also include the GAESA cookie
// value in a custom X-CSRF-Token header if the server ever requires it.
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Auth error callback — called on 401 so AuthContext can clear state
// ─────────────────────────────────────────────────────────────
let _authErrorCallback: (() => void) | null = null;
export function setAuthErrorCallback(fn: () => void): void {
  _authErrorCallback = fn;
}

// JS-visible cookie jar: stores cookies that aren't HttpOnly.
// Used for debugging and for sending CSRF tokens on mutations.
// Does NOT store connect.sid (HttpOnly — invisible to JS).
let visibleCookies: Record<string, string> = {};

/** Parse "name=value; Path=/; ..." → the name=value part only. */
function parseSetCookie(header: string): { name: string; nameValue: string } | null {
  const nameValue = header.split(";")[0].trim();
  const eqIdx = nameValue.indexOf("=");
  if (eqIdx < 0) return null;
  return { name: nameValue.slice(0, eqIdx).trim(), nameValue };
}

/** Add or update one cookie from a Set-Cookie header. */
function addVisible(setCookieHeader: string): void {
  const parsed = parseSetCookie(setCookieHeader);
  if (!parsed) return;
  visibleCookies[parsed.name] = parsed.nameValue;
  if (__DEV__) {
    console.log("[jar] captured visible cookie:", parsed.name);
  }
}

/** Persist visible cookies to SecureStore for reuse across JS reloads. */
async function saveVisibleCookies(): Promise<void> {
  const json = JSON.stringify(visibleCookies);
  if (Platform.OS === "web") {
    localStorage.setItem("prfmr_jar", json);
  } else {
    await SecureStore.setItemAsync("prfmr_jar", json);
  }
}

// ─────────────────────────────────────────────────────────────
// XHR-based login
// XHR's getAllResponseHeaders() sees Set-Cookie lines that the
// Fetch API hides (Fetch mimics browser security, XHR does not).
// connect.sid (HttpOnly) is still invisible, but GAESA and any
// other non-HttpOnly cookies ARE captured here.
// ─────────────────────────────────────────────────────────────
function xhrPost(url: string, body: object): Promise<{ data: any; rawHeaders: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    // withCredentials lets the native layer also store HttpOnly cookies
    // (connect.sid) into NSHTTPCookieStorage during the login response.
    xhr.withCredentials = true;
    xhr.onload = () => {
      const rawHeaders = xhr.getAllResponseHeaders();
      if (__DEV__) {
        console.log("[xhr] login status:", xhr.status);
        console.log("[xhr] all headers:\n", rawHeaders);
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve({ data: JSON.parse(xhr.responseText), rawHeaders });
        } catch {
          resolve({ data: {}, rawHeaders });
        }
      } else {
        let msg = `HTTP ${xhr.status}`;
        try { const e = JSON.parse(xhr.responseText); msg = e.message ?? e.error ?? msg; } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during login"));
    xhr.send(JSON.stringify(body));
  });
}

export async function loginWithXhr(identifier: string, password: string): Promise<any> {
  const { data, rawHeaders } = await xhrPost(`${API_BASE}/auth/login`, { identifier, password });

  // Parse every Set-Cookie header line from the raw header block.
  // getAllResponseHeaders() returns lines separated by \r\n.
  // connect.sid (HttpOnly) won't appear here but gets stored in
  // NSHTTPCookieStorage by the native XHR layer automatically.
  const lines = rawHeaders.split(/\r?\n/);
  let capturedCount = 0;
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const name = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();
    if (name === "set-cookie" && value) {
      addVisible(value);
      capturedCount++;
    }
  }

  if (capturedCount > 0) {
    await saveVisibleCookies();
    if (__DEV__) {
      console.log("[auth] Login complete. Visible cookies captured:", Object.keys(visibleCookies).join(", "));
      console.log("[auth] connect.sid stored in native iOS cookie jar (not accessible from JS).");
    }
  } else {
    if (__DEV__) {
      console.warn("[auth] No visible Set-Cookie found. connect.sid is stored in native iOS jar only.");
    }
  }

  return data;
}

// ─────────────────────────────────────────────────────────────
// Session management
// ─────────────────────────────────────────────────────────────
export async function loadSession(): Promise<void> {
  let raw: string | null = null;
  if (Platform.OS === "web") {
    raw = localStorage.getItem("prfmr_jar");
  } else {
    raw = await SecureStore.getItemAsync("prfmr_jar");
  }
  if (raw) {
    try {
      visibleCookies = JSON.parse(raw) as Record<string, string>;
      if (__DEV__) console.log("[jar] Loaded visible cookies:", Object.keys(visibleCookies).join(", ") || "none");
    } catch {
      visibleCookies = {};
    }
  }
  // connect.sid is NOT here — it lives in NSHTTPCookieStorage and is
  // automatically included by the iOS layer when credentials: "include" is set.
}

export async function clearSession(): Promise<void> {
  visibleCookies = {};
  if (Platform.OS === "web") {
    localStorage.removeItem("prfmr_jar");
  } else {
    await SecureStore.deleteItemAsync("prfmr_jar");
  }
}

// ─────────────────────────────────────────────────────────────
// Core fetch wrapper
// ─────────────────────────────────────────────────────────────
interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  status: number;
  method: string;
  path: string;

  constructor(message: string, status: number, method: string, path: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.method = method;
    this.path = path;
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";

  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // ⚠️ IMPORTANT: We do NOT set a manual Cookie header here.
  //
  // The session cookie (connect.sid) is HttpOnly and cannot be read from JS.
  // It is stored in the iOS native cookie jar (NSHTTPCookieStorage).
  // Setting credentials: "include" tells the native layer to automatically
  // attach ALL stored cookies for this domain, including connect.sid.
  //
  // If we set a manual Cookie header, the native layer may ONLY send that
  // header (ignoring NSHTTPCookieStorage), causing connect.sid to be missing
  // and every authenticated request to return 401.

  if (__DEV__) {
    const visible = Object.keys(visibleCookies);
    console.log(`[api] → ${method} ${path} | visible jar: [${visible.join(", ")}] | native jar: handles connect.sid`);
  }

  const url = `${API_BASE}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: reqHeaders,
      credentials: "include",  // Causes iOS native layer to send ALL cookies including HttpOnly connect.sid
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (networkErr) {
    // Network drops are expected on mobile; console.error turns them into a
    // red Expo overlay in dev, which makes the app feel like it crashed.
    console.warn("[api] Network error:", path, networkErr);
    throw new ApiError("Cannot reach the server. Check your internet connection.", 0, method, path);
  }

  // Capture any new non-HttpOnly cookies sent in the response (e.g. GAESA refresh)
  let newCookies = false;
  const processCookieHeader = (value: string) => {
    if (value) { addVisible(value); newCookies = true; }
  };
  processCookieHeader(response.headers.get("set-cookie") ?? "");
  processCookieHeader(response.headers.get("Set-Cookie") ?? "");
  try {
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") processCookieHeader(value);
    });
  } catch { /* forEach not available in all RN versions */ }
  if (newCookies) await saveVisibleCookies();

  if (__DEV__) {
    console.log(`[api] ← ${method} ${path} ${response.status}${newCookies ? " | new visible cookie" : ""}`);
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const rawText = await response.text();
      if (__DEV__) {
        console.warn("[api] Raw error body:", method, path, response.status, rawText);
      }
      const errorData = rawText ? JSON.parse(rawText) : {};
      errorMessage = errorData.message ?? errorData.error ?? errorMessage;
      if (__DEV__ && errorData.issues) {
        console.warn("[api] Validation issues:", JSON.stringify(errorData.issues));
      }
    } catch { /* ignore */ }
    console.warn("[api] Error:", method, path, response.status, errorMessage);
    // On 401, notify AuthContext to clear the stale session — but skip auth
    // routes themselves to prevent infinite loops during login/logout checks.
    if (response.status === 401 && !path.startsWith("/auth/") && path !== "/user/me") {
      _authErrorCallback?.();
    }
    throw new ApiError(errorMessage, response.status, method, path);
  }

  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    console.warn("[api] Non-JSON from", path, text.slice(0, 200));
    throw new ApiError(`Unexpected response from ${path}`, response.status, method, path);
  }
}
