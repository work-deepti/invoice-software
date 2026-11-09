import { OWNER_ONLY, requireUser } from "@/server/auth";
import { ok, readJson, route } from "@/server/http";
import { updateUser } from "@/server/users";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const actor = await requireUser(req, OWNER_ONLY);
  const { id } = await params;
  return ok({ user: await updateUser(id, await readJson(req), actor) });
});
