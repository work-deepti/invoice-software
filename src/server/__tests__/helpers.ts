/* eslint-disable @typescript-eslint/no-explicit-any */
type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export interface ApiResult<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

/** Calls a Next.js route handler exactly as the runtime would. */
export async function call<T = any>(
  handler: unknown,
  opts: { method?: string; path?: string; body?: unknown; token?: string; params?: Record<string, string> } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const req = new Request(`http://test.local${opts.path ?? "/"}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await (handler as Handler)(req, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

export function tokenFrom(res: ApiResult): string {
  const cookie = res.headers.get("set-cookie") ?? "";
  const m = /gsb_session=([^;]+)/.exec(cookie);
  if (!m) throw new Error("no session cookie");
  return m[1];
}
