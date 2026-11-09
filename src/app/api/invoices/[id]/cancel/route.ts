import { OWNER_ONLY, requireUser } from "@/server/auth";
import { ok, readJson, route } from "@/server/http";
import { cancelInvoice } from "@/server/invoices";
import { cancelBodySchema } from "@/server/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** D-01: cancel with a reason; the bill stays, stamped CANCELLED, excluded from totals. */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req, OWNER_ONLY);
  const { reason } = cancelBodySchema.parse(await readJson(req));
  return ok({ invoice: await cancelInvoice((await params).id, reason, user) });
});
