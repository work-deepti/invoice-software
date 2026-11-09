import { pdfFileName } from "@/lib/calc-engine";
import { ANY_ROLE, requireUser } from "@/server/auth";
import { route } from "@/server/http";
import { getInvoice } from "@/server/invoices";
import { renderInvoicePdf } from "@/server/pdf/invoice-pdf";

type Ctx = { params: Promise<{ id: string }> };

/** PRT-05: server-rendered vector PDF named after the invoice, e.g. INV-2026-27-001.pdf */
export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req, ANY_ROLE);
  const inv = await getInvoice((await params).id, user);
  const duplicate = new URL(req.url).searchParams.get("copy") === "duplicate";
  const pdf = await renderInvoicePdf(inv, { duplicate });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFileName(inv.number)}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
