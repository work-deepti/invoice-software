import { todayIST } from "@/lib/calc-engine";
import { OWNER_ONLY, requireUser } from "@/server/auth";
import { buildBackup } from "@/server/backup";
import { route } from "@/server/http";

/** TXN-13: full JSON backup (owner). */
export const GET = route(async (req) => {
  await requireUser(req, OWNER_ONLY);
  const backup = await buildBackup();
  return new Response(JSON.stringify(backup), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gold-silver-billing-backup-${todayIST()}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
});
