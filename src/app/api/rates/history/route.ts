import { ANY_ROLE, requireUser } from "@/server/auth";
import { ok, route } from "@/server/http";
import { getRateHistory } from "@/server/rates";

export const GET = route(async (req) => {
  await requireUser(req, ANY_ROLE);
  const days = Number(new URL(req.url).searchParams.get("days") ?? 30);
  return ok(await getRateHistory(days));
});
