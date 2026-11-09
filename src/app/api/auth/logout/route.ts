import { clearSessionCookie } from "@/server/auth";
import { ok, route } from "@/server/http";

export const POST = route(async () => ok({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } }));
