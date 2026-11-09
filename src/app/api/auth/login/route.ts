import { sessionCookie } from "@/server/auth";
import { ok, readJson, route } from "@/server/http";
import { login } from "@/server/users";

export const POST = route(async (req) => {
  const { user, token } = await login(await readJson(req));
  return ok({ user }, { headers: { "Set-Cookie": sessionCookie(token) } });
});
