import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import type { Issue } from "@/lib/calc-engine";

/** An error that maps directly onto an HTTP response. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(typeof body.message === "string" ? body.message : `HTTP ${status}`);
  }
}

export const unauthorized = () => new HttpError(401, { message: "Please sign in." });
export const forbidden = (message = "You don't have permission to do that.") => new HttpError(403, { message });
export const notFound = (what = "Not found.") => new HttpError(404, { message: what });
export const badRequest = (message: string, extra: Record<string, unknown> = {}) =>
  new HttpError(400, { message, ...extra });
export const conflict = (message: string, extra: Record<string, unknown> = {}) =>
  new HttpError(409, { message, ...extra });

function stripLive({ id, field, message }: Issue) {
  return { id, field, message };
}

/** API-02: blocking errors → 422 with a list of {id, field, message}. */
export const validationFailed = (errors: Issue[], extra: Record<string, unknown> = {}) =>
  new HttpError(422, { message: "Please fix the highlighted fields.", errors: errors.map(stripLive), ...extra });

/** API-02: unconfirmed warnings → 409 until acceptWarnings is sent. */
export const warningsNeedConfirmation = (warnings: Issue[], extra: Record<string, unknown> = {}) =>
  new HttpError(409, { message: "Please confirm the warnings.", warnings: warnings.map(stripLive), ...extra });

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: maps HttpError / ZodError / bad JSON to JSON responses. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      // Let Next.js internals (e.g. the prerender bail-out for request-bound GETs) pass through.
      unstable_rethrow(e);
      if (e instanceof HttpError) return Response.json(e.body, { status: e.status });
      if (e instanceof ZodError)
        return Response.json(
          {
            message: "The request is not valid.",
            issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          },
          { status: 400 },
        );
      if (e instanceof SyntaxError) return Response.json({ message: "Malformed JSON body." }, { status: 400 });
      console.error(e);
      return Response.json({ message: "Something went wrong on the server." }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}

export const ok = (body: unknown, init?: ResponseInit) => Response.json(body, init);
