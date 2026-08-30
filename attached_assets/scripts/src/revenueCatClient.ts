/**
 * scripts/src/revenueCatClient.ts
 * Authenticated RevenueCat v2 API client via the Replit connector proxy.
 * The connector handles OAuth token refresh automatically.
 */
import { ReplitConnectors } from "@replit/connectors-sdk";

export type RcResponse<T> =
  | { data: T; error: null }
  | { data: null; error: unknown };

/**
 * Minimal typed client compatible with @replit/revenuecat-sdk function signatures.
 * Uses the Replit connector proxy so no API key is needed in env vars.
 */
export interface RevenueCatClient {
  get<T>(opts: { url: string; path?: Record<string, string>; query?: Record<string, unknown> }): Promise<RcResponse<T>>;
  post<T>(opts: { url: string; path?: Record<string, string>; body?: unknown }): Promise<RcResponse<T>>;
  patch<T>(opts: { url: string; path?: Record<string, string>; body?: unknown }): Promise<RcResponse<T>>;
  delete<T>(opts: { url: string; path?: Record<string, string> }): Promise<RcResponse<T>>;
}

function interpolate(url: string, path?: Record<string, string>): string {
  if (!path) return url;
  return url.replace(/\{(\w+)\}/g, (_, key) => path[key] ?? `{${key}}`);
}

function buildQuery(base: string, query?: Record<string, unknown>): string {
  if (!query) return base;
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return params.length ? `${base}?${params.join("&")}` : base;
}

export async function getUncachableRevenueCatClient(): Promise<RevenueCatClient> {
  const connectors = new ReplitConnectors();

  async function request<T>(
    method: string,
    urlTemplate: string,
    path?: Record<string, string>,
    query?: Record<string, unknown>,
    body?: unknown
  ): Promise<RcResponse<T>> {
    const interpolated = interpolate(urlTemplate, path);
    const fullPath = buildQuery(interpolated, query);

    try {
      const opts: Record<string, unknown> = { method };
      if (body !== undefined) opts.body = body;
      const raw = await (connectors as any).proxy("revenuecat", fullPath, opts);
      const json = await raw.json();

      if (!raw.ok) {
        return { data: null, error: json };
      }
      return { data: json as T, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  return {
    get<T>(opts: { url: string; path?: Record<string, string>; query?: Record<string, unknown> }) {
      return request<T>("GET", opts.url, opts.path, opts.query);
    },
    post<T>(opts: { url: string; path?: Record<string, string>; body?: unknown }) {
      return request<T>("POST", opts.url, opts.path, undefined, opts.body);
    },
    patch<T>(opts: { url: string; path?: Record<string, string>; body?: unknown }) {
      return request<T>("PATCH", opts.url, opts.path, undefined, opts.body);
    },
    delete<T>(opts: { url: string; path?: Record<string, string> }) {
      return request<T>("DELETE", opts.url, opts.path);
    },
  };
}
