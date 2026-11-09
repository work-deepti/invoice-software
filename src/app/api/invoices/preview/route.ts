import { CAN_BILL, requireUser } from "@/server/auth";
import { ok, readJson, route } from "@/server/http";
import { previewInvoice } from "@/server/invoices";

/**
 * Runs the engine and every validation without saving. Returns totals,
 * errors, warnings and the next number. Pass ?editing=<id> in edit mode.
 */
export const POST = route(async (req) => {
  const user = await requireUser(req, CAN_BILL);
  const editing = new URL(req.url).searchParams.get("editing") ?? undefined;
  return ok(await previewInvoice(await readJson(req), user, editing));
});
