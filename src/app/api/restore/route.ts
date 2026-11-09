import { OWNER_ONLY, requireUser } from "@/server/auth";
import { restorePhase } from "@/server/backup";
import { ok, readJson, route } from "@/server/http";

/** TXN-14: restore a backup in phases (start → invoices × n → finish). Owner only. */
export const POST = route(async (req) => {
  const user = await requireUser(req, OWNER_ONLY);
  return ok(await restorePhase(await readJson(req), user));
});
