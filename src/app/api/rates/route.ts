import { ANY_ROLE, OWNER_ONLY, requireUser } from "@/server/auth";
import { ok, readJson, route } from "@/server/http";
import { getRates, saveRates } from "@/server/rates";

export const GET = route(async (req) => {
  await requireUser(req, ANY_ROLE);
  return ok(await getRates());
});

/** RATE-06: saving writes today's rate_history (overwritten on re-save). */
export const PUT = route(async (req) => {
  const user = await requireUser(req, OWNER_ONLY);
  return ok(await saveRates(await readJson(req), user));
});
