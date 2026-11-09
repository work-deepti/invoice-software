import { OWNER_ONLY, requireUser } from "@/server/auth";
import { ok, readJson, route } from "@/server/http";
import { createUser, listUsers } from "@/server/users";

export const GET = route(async (req) => {
  await requireUser(req, OWNER_ONLY);
  return ok({ users: await listUsers() });
});

export const POST = route(async (req) => {
  const actor = await requireUser(req, OWNER_ONLY);
  return ok({ user: await createUser(await readJson(req), actor) }, { status: 201 });
});
