import { sessionCookie } from "@/server/auth";
import { ok, readJson, route } from "@/server/http";
import { hasAnyUser, setupOwner } from "@/server/users";

/** GET: does the app still need its first owner account? */
export const GET = route(async () => ok({ needsSetup: !(await hasAnyUser()) }));

/** POST: create the first owner (only while no user exists). */
export const POST = route(async (req) => {
  const { user, token } = await setupOwner(await readJson(req));
  return ok({ user }, { status: 201, headers: { "Set-Cookie": sessionCookie(token) } });
});
