import { describe, expect, it } from "vitest";
import { shareText, whatsappUrl } from "./share";
import type { SavedInvoice } from "./types";

const inv = (o: Partial<Record<string, unknown>> = {}) =>
  ({
    id: "x",
    number: "INV/2026-27/043",
    invoiceDate: "2026-11-09",
    grandTotal: "187314.00",
    balance: "0.00",
    status: "active",
    customerPhone: "9822001122",
    shopSnapshot: { name: "Shree Laxmi Jewellers" },
    ...o,
  }) as unknown as SavedInvoice;

describe("WhatsApp share", () => {
  it("writes a short message with shop, number, date and Indian-formatted amount", () => {
    expect(shareText(inv())).toBe(
      "Shree Laxmi Jewellers\nInvoice INV/2026-27/043 · 09-11-2026\nAmount: ₹1,87,314.00\n\nThank you for shopping with us.",
    );
  });
  it("mentions the balance due when there is one", () => {
    expect(shareText(inv({ balance: "50000.00" }))).toContain("Balance due: ₹50,000.00");
  });
  it("opens the customer's chat for an Indian mobile, else a blank chat", () => {
    expect(whatsappUrl(inv())).toMatch(/^https:\/\/wa\.me\/919822001122\?text=/);
    expect(whatsappUrl(inv({ customerPhone: "" }))).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(decodeURIComponent(whatsappUrl(inv()).split("text=")[1])).toContain("₹1,87,314.00");
  });
});
