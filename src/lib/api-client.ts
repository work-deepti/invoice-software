/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Issue } from "@/lib/calc-engine";

export interface ApiError {
  status: number;
  message: string;
  errors?: Issue[];
  warnings?: Issue[];
  totals?: any;
}

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: ApiError };

/** Thin JSON fetch wrapper. 401 sends the browser to /login. */
export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? "GET",
      headers: opts.body === undefined ? undefined : { "content-type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return { ok: false, status: 0, error: { status: 0, message: "Can't reach the server. Check the connection and try again." } };
  }
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (res.ok) return { ok: true, status: res.status, data: body as T };
  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/")) {
    // Session expired: a full reload to the sign-in page clears all in-memory state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }
  return {
    ok: false,
    status: res.status,
    error: { status: res.status, message: body?.message ?? `Request failed (${res.status}).`, ...body },
  };
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return { message: t.slice(0, 200) };
  }
}
