import { requireUser } from "@/server/auth";
import { ok, route } from "@/server/http";
import { getSettings } from "@/server/settings";

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const s = await getSettings();
  // ROLE-03 / DSH-11: staff see dashboards only when the owner allows it.
  const canSeeDashboard = user.role !== "staff" || s.staffCanSeeDashboard;
  return ok({ user, capabilities: { canBill: user.role !== "viewer", isOwner: user.role === "owner", canSeeDashboard } });
});
