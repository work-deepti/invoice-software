import { ANY_ROLE, requireUser } from "@/server/auth";
import { csvFileName, exportCsv } from "@/server/export";
import { route } from "@/server/http";
import { parseLedgerFilters } from "@/server/invoices";

/** TXN-12: CSV of the filtered ledger (UTF-8 with BOM). Phone / PAN masked unless the owner sends full=1. */
export const GET = route(async (req) => {
  const user = await requireUser(req, ANY_ROLE);
  const url = new URL(req.url);
  const f = parseLedgerFilters(url);
  const csv = await exportCsv(f, user, url.searchParams.get("full") === "1");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFileName(f)}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
