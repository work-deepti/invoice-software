import { ANY_ROLE, CAN_BILL, OWNER_ONLY, requireUser } from "@/server/auth";
import { ok, readJson, route } from "@/server/http";
import { deleteInvoice, getInvoice, updateInvoice } from "@/server/invoices";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req, ANY_ROLE);
  return ok({ invoice: await getInvoice((await params).id, user) });
});

/** Update keeps the same number (INV-20). Staff: today's invoices only (D-03). */
export const PUT = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req, CAN_BILL);
  return ok({ invoice: await updateInvoice((await params).id, await readJson(req), user) });
});

/** Hard delete — owner only. Normal removal is /cancel (D-01). */
export const DELETE = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req, OWNER_ONLY);
  return ok(await deleteInvoice((await params).id, user));
});
