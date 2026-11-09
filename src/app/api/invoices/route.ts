import { ANY_ROLE, CAN_BILL, requireUser } from "@/server/auth";
import { ok, readJson, route } from "@/server/http";
import { createInvoice, listInvoices, parseLedgerFilters } from "@/server/invoices";

/** Ledger list + summary tiles for the filter (TXN-01..06). */
export const GET = route(async (req) => {
  const user = await requireUser(req, ANY_ROLE);
  return ok(await listInvoices(parseLedgerFilters(new URL(req.url)), user));
});

/** Validate, allocate number, save — 422 on errors, 409 on unconfirmed warnings (API-02). */
export const POST = route(async (req) => {
  const user = await requireUser(req, CAN_BILL);
  return ok({ invoice: await createInvoice(await readJson(req), user) }, { status: 201 });
});
