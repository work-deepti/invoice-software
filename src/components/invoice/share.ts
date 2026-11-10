import { formatDateDMY, formatINR, pdfFileName, toDec } from "@/lib/calc-engine";
import { snapshotOf, type SavedInvoice } from "./types";

/** The short message that goes with a shared invoice. Plain text: WhatsApp shows it as typed. */
export function shareText(inv: SavedInvoice): string {
  const shop = snapshotOf(inv);
  const grand = toDec(inv.grandTotal);
  const balance = toDec(inv.balance);
  const lines = [
    `${shop.name || "Invoice"}`,
    `Invoice ${inv.number} · ${formatDateDMY(inv.invoiceDate)}`,
    `${grand.isNeg() ? "Payable to you" : "Amount"}: ${formatINR(grand.abs())}`,
  ];
  if (balance.gt(0)) lines.push(`Balance due: ${formatINR(balance)}`);
  if (inv.status === "cancelled") lines.push("This invoice has been cancelled.");
  lines.push("", "Thank you for shopping with us.");
  return lines.join("\n");
}

/** wa.me wants the number with country code and digits only; Indian 10-digit mobiles get 91. */
export function whatsappUrl(inv: SavedInvoice): string {
  const digits = (inv.customerPhone ?? "").replace(/\D/g, "");
  const to = digits.length === 10 ? `91${digits}` : digits.length === 12 && digits.startsWith("91") ? digits : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(shareText(inv))}`;
}

export type ShareResult = "shared" | "opened-whatsapp" | "cancelled";

/**
 * Phones (Web Share with files): the system share sheet opens with the PDF attached — pick WhatsApp, then the chat.
 * Computers: the PDF downloads and WhatsApp opens with the message ready (and the customer's chat when we have
 * their mobile number), so the PDF can be dropped in.
 */
export async function shareInvoice(inv: SavedInvoice, opts: { duplicate?: boolean } = {}): Promise<ShareResult> {
  const pdfUrl = `/api/invoices/${inv.id}/pdf${opts.duplicate ? "?copy=duplicate" : ""}`;
  const name = pdfFileName(inv.number);
  const text = shareText(inv);
  const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

  if (touch && typeof navigator.canShare === "function") {
    const res = await fetch(pdfUrl, { credentials: "same-origin" });
    if (res.ok) {
      const file = new File([await res.blob()], name, { type: "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text, title: `Invoice ${inv.number}` });
          return "shared";
        } catch (e) {
          if ((e as DOMException)?.name === "AbortError") return "cancelled";
          // fall through to WhatsApp link
        }
      }
    }
  }

  if (!touch) {
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = name;
    a.click();
  }
  window.open(whatsappUrl(inv), "_blank", "noopener");
  return "opened-whatsapp";
}
