import { ANY_ROLE, OWNER_ONLY, requireUser } from "@/server/auth";
import { ok, readJson, route } from "@/server/http";
import { getSettings, saveSettings } from "@/server/settings";

export const GET = route(async (req) => {
  await requireUser(req, ANY_ROLE);
  return ok({ settings: await getSettings() });
});

export const PUT = route(async (req) => {
  const user = await requireUser(req, OWNER_ONLY);
  return ok({ settings: await saveSettings(await readJson(req), user) });
});
