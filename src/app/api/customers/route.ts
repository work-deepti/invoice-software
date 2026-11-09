import { ANY_ROLE, requireUser } from "@/server/auth";
import { ok, route } from "@/server/http";
import { findCustomers } from "@/server/invoices";

/**
 * INV-07 customer recall.
 *   ?phone=9876543210  → exact match (fills empty fields)
 *   ?q=98 / ?q=asha    → up to 8 suggestions for the autocomplete
 */
export const GET = route(async (req) => {
  await requireUser(req, ANY_ROLE);
  const p = new URL(req.url).searchParams;
  return ok(await findCustomers({ phone: p.get("phone") ?? undefined, q: p.get("q") ?? undefined }));
});
