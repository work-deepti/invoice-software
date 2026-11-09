import { describe, expect, it } from "vitest";
import {
  DEFAULT_PURITIES,
  DEFAULT_SETTINGS,
  amountInWords,
  applyRateMaster,
  autoFillFromFineRate,
  computeExchangeRow,
  computeInvoice,
  computeLine,
  detectInterState,
  financialYear,
  fineRateFor,
  formatCompactINR,
  formatINR,
  formatInvoiceNumber,
  formatWeight,
  grandTotalLabel,
  invoiceHeading,
  isBlockedNumberKey,
  maxPrefixLength,
  newLineFrom,
  pdfFileName,
  placeOfSupply,
  rateEquivalent,
  roundOnBlur,
  sanitizeDecimalText,
  sanitizeGstin,
  sanitizePan,
  sanitizePhone,
  sanitizeStateCode,
  seriesKey,
  seriesPrefixFor,
  taxRows,
  validateInvoice,
  validateRates,
  validateSettings,
  type ExchangeInput,
  type InvoiceInput,
  type InvoiceValidationContext,
  type LineInput,
  type PurityRateRow,
  type ShopSettings,
} from "../calc-engine";

/* ───────────────────────────── fixtures ───────────────────────────── */

const TODAY = "2026-11-09";

const SHOP: ShopSettings = {
  ...DEFAULT_SETTINGS,
  name: "Shree Jewellers",
  phone: "9876543210",
  gstin: "27ABCDE1234F1Z5",
  state: "Maharashtra",
  stateCode: "27",
};

const line = (p: Partial<LineInput>): LineInput => ({
  description: "Item",
  metal: "Gold",
  purityLabel: "Gold 22K (916)",
  hsn: "7113",
  pcs: "1",
  gross: "",
  less: "",
  wastagePct: "",
  rate: "",
  makingType: "per_g",
  makingValue: "",
  stone: "",
  ...p,
});

const xch = (p: Partial<ExchangeInput>): ExchangeInput => ({
  description: "Old gold",
  metal: "Gold",
  weight: "",
  touchPct: "",
  fineRate: "",
  ...p,
});

const invoice = (p: Partial<InvoiceInput>): InvoiceInput => ({
  date: TODAY,
  payMode: "UPI",
  gstOn: true,
  interState: false,
  gstRate: "3",
  customer: { name: "Asha Patil", phone: "9123456780", state: "Maharashtra" },
  lines: [],
  exchange: [],
  discount: "",
  received: "",
  ...p,
});

const ctx = (p: Partial<InvoiceValidationContext> = {}): InvoiceValidationContext => ({
  today: TODAY,
  isNew: true,
  ...p,
});

const ids = (issues: { id: string }[]) => issues.map((i) => i.id);

/** §7.2 worked example */
const WORKED_EXAMPLE = invoice({
  payMode: "Mixed",
  received: "150000",
  discount: "1500",
  lines: [
    line({ description: "Necklace", gross: "25.450", less: "1.200", wastagePct: "8", rate: "7150", makingType: "per_g", makingValue: "600", stone: "4500" }),
    line({ description: "Diamond ring", purityLabel: "Gold 18K (750)", gross: "4.120", less: "0.180", rate: "5860", makingType: "pct", makingValue: "15", stone: "18500" }),
    line({ description: "Anklets", metal: "Silver", purityLabel: "Silver 925", pcs: "2", gross: "62.300", rate: "91", makingType: "flat", makingValue: "1200" }),
  ],
  exchange: [xch({ weight: "8.500", touchPct: "91.6", fineRate: "7800" })],
});

/* ─────────────────────────── 16.1 calculation ─────────────────────────── */

describe("§16.1 calculation test vectors", () => {
  it("T-01 worked example (§7.2) to the paisa", () => {
    const t = computeInvoice(WORKED_EXAMPLE);

    // Per-line table
    expect(t.lines[0]).toMatchObject({ net: "24.250", chargeable: "26.190", metalValue: "187258.50", making: "14550.00", stone: "4500.00", amount: "206308.50" });
    expect(t.lines[1]).toMatchObject({ net: "3.940", chargeable: "3.940", metalValue: "23088.40", making: "3463.26", stone: "18500.00", amount: "45051.66" });
    expect(t.lines[2]).toMatchObject({ net: "62.300", chargeable: "62.300", metalValue: "5669.30", making: "1200.00", stone: "0.00", amount: "6869.30" });

    // Summary table
    expect(t.itemsTotal).toBe("258229.46");
    expect(t.discount).toBe("1500.00");
    expect(t.taxable).toBe("256729.46");
    expect(t.cgst).toBe("3850.94");
    expect(t.sgst).toBe("3850.94");
    expect(t.igst).toBe("0.00");
    expect(t.exchange[0]).toMatchObject({ fine: "7.786", value: "60730.80" });
    expect(t.exchangeTotal).toBe("60730.80");
    expect(t.beforeRounding).toBe("203700.54");
    expect(t.roundOff).toBe("0.46");
    expect(t.grandTotal).toBe("203701.00");
    expect(t.received).toBe("150000.00");
    expect(t.paid).toBe("150000.00");
    expect(t.balance).toBe("53701.00");
    expect(t.amountInWords).toBe("Rupees Two Lakh Three Thousand Seven Hundred One Only");

    // Formula 17 + §10.1 (7): weight by metal, never mixed
    expect(t.goldNetG).toBe("28.190");
    expect(t.silverNetG).toBe("62.300");
    expect(t.weightsByMetal.Gold).toEqual({ gross: "29.570", net: "28.190" });
    expect(t.weightsByMetal.Silver).toEqual({ gross: "62.300", net: "62.300" });
    expect(t.totalPcs).toBe(4);

    // Printed figures
    expect(formatINR(t.grandTotal)).toBe("₹2,03,701.00");
    expect(formatINR(t.itemsTotal)).toBe("₹2,58,229.46");
    expect(formatINR(t.lines[0].metalValue)).toBe("₹1,87,258.50");
    expect(formatWeight(t.lines[0].gross)).toBe("25.450 g");
    expect(taxRows(true, false, t)).toEqual([
      { key: "cgst", label: "CGST 1.5%", amount: "3850.94" },
      { key: "sgst", label: "SGST 1.5%", amount: "3850.94" },
    ]);

    // Validation: balance due with name+phone → no errors; ₹2L+ without PAN → W-01
    const v = validateInvoice(WORKED_EXAMPLE, ctx(), t);
    expect(v.errors).toEqual([]);
    expect(ids(v.warnings)).toEqual(["W-01"]);
  });

  const T02 = invoice({ lines: [line({ gross: "10", rate: "7150", makingType: "per_g", makingValue: "450" })] });

  it("T-02 Gold 22K 10 g @ 7,150, making ₹450/g, intra-state", () => {
    const t = computeInvoice(T02);
    expect(t.lines[0].metalValue).toBe("71500.00");
    expect(t.lines[0].making).toBe("4500.00");
    expect(t.taxable).toBe("76000.00");
    expect(t.gstTotal).toBe("2280.00");
    expect(t.cgst).toBe("1140.00");
    expect(t.sgst).toBe("1140.00");
    expect(t.grandTotal).toBe("78280.00");
    expect(t.roundOff).toBe("0.00");
  });

  it("T-03 T-02 with GST off → 76,000, BILL series, heading INVOICE, no tax rows", () => {
    const inp = { ...T02, gstOn: false };
    const t = computeInvoice(inp);
    expect(t.grandTotal).toBe("76000.00");
    expect(t.gstTotal).toBe("0.00");
    expect(taxRows(inp.gstOn, inp.interState, t)).toEqual([]);
    const prefix = seriesPrefixFor(inp.gstOn, SHOP);
    expect(prefix).toBe("BILL");
    expect(formatInvoiceNumber(prefix, inp.date, 1, SHOP.fyNumbering)).toBe("BILL/2026-27/001");
    expect(invoiceHeading(false, SHOP)).toEqual({ title: "INVOICE", subtitle: null });
    expect(invoiceHeading(true, SHOP)).toEqual({ title: "TAX INVOICE", subtitle: "ORIGINAL FOR RECIPIENT" });
    // NUM-07: GST on → GST series
    expect(seriesPrefixFor(true, SHOP)).toBe("INV");
  });

  it("T-04 Karnataka customer, Maharashtra shop → IGST auto, 94,554, POS 'Karnataka (29)'", () => {
    const customer = { name: "Ravi", phone: "9988776655", state: "Karnataka", gstin: "29ABCDE1234F1Z5" };
    const interState = detectInterState(customer.state, SHOP.state);
    expect(interState).toBe(true);
    const inp = invoice({ customer, interState, lines: [line({ gross: "12", rate: "7150", makingType: "per_g", makingValue: "500" })] });
    const t = computeInvoice(inp);
    expect(t.taxable).toBe("91800.00");
    expect(t.igst).toBe("2754.00");
    expect(t.cgst).toBe("0.00");
    expect(t.sgst).toBe("0.00");
    expect(t.grandTotal).toBe("94554.00");
    expect(taxRows(true, true, t)).toEqual([{ key: "igst", label: "IGST 3%", amount: "2754.00" }]);
    expect(placeOfSupply(customer, SHOP).label).toBe("Karnataka (29)");
  });

  it("T-05 wastage: 10 g − 0.5 g, 8%, 7,150 → net 9.500, chargeable 10.260, metal 73,359.00, ₹/g on net", () => {
    const r = computeLine(line({ gross: "10", less: "0.5", wastagePct: "8", rate: "7150", makingType: "per_g", makingValue: "100" }));
    expect(r.net).toBe("9.500");
    expect(r.chargeable).toBe("10.260");
    expect(r.metalValue).toBe("73359.00");
    expect(r.making).toBe("950.00"); // 100 × 9.500 (net), not 10.260
  });

  it("T-06 making 15% on metal value 23,088.40 → 3,463.26", () => {
    const r = computeLine(line({ gross: "3.940", rate: "5860", makingType: "pct", makingValue: "15" }));
    expect(r.metalValue).toBe("23088.40");
    expect(r.making).toBe("3463.26");
  });

  it("T-07 exchange 3 g, touch 90, fine rate 7,800 → fine 2.700 g, 21,060.00, deducted after GST", () => {
    const x = computeExchangeRow(xch({ weight: "3", touchPct: "90", fineRate: "7800" }));
    expect(x.fine).toBe("2.700");
    expect(x.value).toBe("21060.00");

    const t = computeInvoice({ ...T02, exchange: [xch({ weight: "3", touchPct: "90", fineRate: "7800" })] });
    expect(t.gstTotal).toBe("2280.00"); // GST never reduced by exchange (INV-13)
    expect(t.taxable).toBe("76000.00");
    expect(t.beforeRounding).toBe("57220.00");
    expect(t.grandTotal).toBe("57220.00");
  });

  it("T-08 exchange larger than bill → negative total, 'Payable to customer', W-03 for cash > 10,000", () => {
    const inp = invoice({
      payMode: "Cash",
      lines: [line({ gross: "1", rate: "7150" })],
      exchange: [xch({ weight: "10", touchPct: "91.6", fineRate: "7800" })],
    });
    const t = computeInvoice(inp);
    expect(t.beforeRounding).toBe("-64083.50");
    expect(t.grandTotal).toBe("-64084.00"); // half away from zero
    expect(t.roundOff).toBe("-0.50");
    expect(t.payableToCustomer).toBe(true);
    expect(grandTotalLabel(t)).toBe("Payable to customer");
    expect(t.balance).toBe("0.00");
    expect(t.changeReturned).toBe("0.00");
    expect(t.amountInWords).toBe("Rupees Sixty Four Thousand Eighty Four Only");

    expect(ids(validateInvoice(inp, ctx()).warnings)).toContain("W-03");
    expect(ids(validateInvoice({ ...inp, payMode: "UPI" }, ctx()).warnings)).not.toContain("W-03");
    // small payout below the limit → no W-03
    const small = invoice({ payMode: "Cash", lines: [line({ gross: "1", rate: "7150" })], exchange: [xch({ weight: "1.5", touchPct: "91.6", fineRate: "7800" })] });
    expect(computeInvoice(small).grandTotal).toBe("-3353.00");
    expect(ids(validateInvoice(small, ctx()).warnings)).not.toContain("W-03");
    expect(grandTotalLabel(computeInvoice(T02))).toBe("Grand total");
  });

  it("T-09 received 70,000 on total 61,427 → change 8,573, balance 0, paid 61,427", () => {
    const inp = invoice({ gstOn: false, received: "70000", lines: [line({ description: "Coin", stone: "61427" })] });
    const t = computeInvoice(inp);
    expect(t.grandTotal).toBe("61427.00");
    expect(t.changeReturned).toBe("8573.00");
    expect(t.balance).toBe("0.00");
    expect(t.paid).toBe("61427.00");
    expect(t.received).toBe("70000.00");
  });

  it("T-10 16-item bill — totals compute across all lines", () => {
    const lines = Array.from({ length: 16 }, (_, i) => line({ description: `Ring ${i + 1}`, gross: "2.000", rate: "7150", makingType: "per_g", makingValue: "500" }));
    const t = computeInvoice(invoice({ lines }));
    expect(t.lines).toHaveLength(16);
    expect(t.itemsTotal).toBe("244800.00"); // 16 × (2 × 7,150 + 2 × 500)
    expect(t.goldNetG).toBe("32.000");
    expect(t.totalPcs).toBe(16);
  });
  it.todo("T-10 print: spans 2 A4 pages, no split rows, header repeats, footer 'INV/… · Page 1 of 2' (Step 3 print e2e)");

  it("T-11 ₹5,28,639.26 before rounding → round off −0.26, words", () => {
    const t = computeInvoice(invoice({ gstOn: false, lines: [line({ description: "Set", stone: "528639.26" })] }));
    expect(t.beforeRounding).toBe("528639.26");
    expect(t.roundOff).toBe("-0.26");
    expect(t.grandTotal).toBe("528639.00");
    expect(t.amountInWords).toBe("Rupees Five Lakh Twenty Eight Thousand Six Hundred Thirty Nine Only");
  });

  it("§7.2 extra vector: no-GST bill 20 g silver 999 × 98 = 1,960", () => {
    const t = computeInvoice(invoice({ gstOn: false, lines: [line({ metal: "Silver", purityLabel: "Silver 999", gross: "20", rate: "98" })] }));
    expect(t.grandTotal).toBe("1960.00");
    expect(t.silverNetG).toBe("20.000");
    expect(t.goldNetG).toBe("0.000");
  });

  it("T-29 math: fully paid 4 g bill → 29,458, balance 0", () => {
    const t = computeInvoice(invoice({ lines: [line({ gross: "4", rate: "7150" })] }));
    expect(t.grandTotal).toBe("29458.00");
    expect(t.balance).toBe("0.00");
    expect(t.receivedIsFull).toBe(true);
  });
});

/* ───────────────────────────── formula edge cases ───────────────────────────── */

describe("§7.1 formula edge cases", () => {
  it("net weight never goes below zero", () => {
    expect(computeLine(line({ gross: "1", less: "2" })).net).toBe("0.000");
  });
  it("discount is capped at the items total (formula 8)", () => {
    const t = computeInvoice(invoice({ gstOn: false, discount: "999999", lines: [line({ gross: "1", rate: "1000" })] }));
    expect(t.discount).toBe("1000.00");
    expect(t.taxable).toBe("0.00");
    expect(t.grandTotal).toBe("0.00");
  });
  it("rounds half away from zero at the rupee (formula 13)", () => {
    const t = computeInvoice(invoice({ gstOn: false, lines: [line({ description: "x", stone: "100.50" })] }));
    expect(t.grandTotal).toBe("101.00");
    expect(t.roundOff).toBe("0.50");
    const t2 = computeInvoice(invoice({ gstOn: false, lines: [line({ description: "x", stone: "100.49" })] }));
    expect(t2.grandTotal).toBe("100.00");
    expect(t2.roundOff).toBe("-0.49");
  });
  it("part payment leaves the balance due (formulas 14–16)", () => {
    const t = computeInvoice(invoice({ gstOn: false, received: "1000", lines: [line({ description: "x", stone: "1500" })] }));
    expect(t.paid).toBe("1000.00");
    expect(t.balance).toBe("500.00");
    expect(t.changeReturned).toBe("0.00");
  });
  it("received 0 is not 'Full'", () => {
    const t = computeInvoice(invoice({ gstOn: false, received: "0", lines: [line({ description: "x", stone: "1500" })] }));
    expect(t.receivedIsFull).toBe(false);
    expect(t.balance).toBe("1500.00");
  });
  it("inter-state flag is ignored when GST is off", () => {
    const t = computeInvoice(invoice({ gstOn: false, interState: true, lines: [line({ gross: "1", rate: "7150" })] }));
    expect(t.igst).toBe("0.00");
  });
  it("inputs are normalised to 3 dp weights and 2 dp money (server cannot be fed extra precision)", () => {
    const r = computeLine(line({ gross: "10.0004", rate: "7150.004", makingType: "flat", makingValue: "-100" }));
    expect(r.gross).toBe("10.000");
    expect(r.rate).toBe("7150.00");
    expect(r.making).toBe("100.00"); // VAL-01: negative becomes positive
  });
  it("no floating point drift (0.1 + 0.2 style)", () => {
    const t = computeInvoice(invoice({ gstOn: false, lines: [line({ description: "a", stone: "0.10" }), line({ description: "b", stone: "0.20" })] }));
    expect(t.itemsTotal).toBe("0.30");
  });
  it("IGST rounding at 2 dp and CGST/SGST at half rate each", () => {
    const t = computeInvoice(invoice({ lines: [line({ description: "x", stone: "333.33" })] }));
    expect(t.cgst).toBe("5.00"); // 333.33 × 3/200 = 4.99995 → 5.00
    expect(t.sgst).toBe("5.00");
    const ti = computeInvoice(invoice({ interState: true, lines: [line({ description: "x", stone: "333.33" })] }));
    expect(ti.igst).toBe("10.00"); // 9.9999 → 10.00
  });
});

/* ───────────────────────────── amount in words ───────────────────────────── */

describe("amount in words (Indian system)", () => {
  it.each([
    [0, "Rupees Zero Only"],
    [1, "Rupees One Only"],
    [19, "Rupees Nineteen Only"],
    [100, "Rupees One Hundred Only"],
    [101, "Rupees One Hundred One Only"],
    [1000, "Rupees One Thousand Only"],
    [100000, "Rupees One Lakh Only"],
    [1960, "Rupees One Thousand Nine Hundred Sixty Only"],
    [94554, "Rupees Ninety Four Thousand Five Hundred Fifty Four Only"],
    [10000000, "Rupees One Crore Only"],
    [123456789, "Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine Only"],
    ["1000000000000", "Rupees One Lakh Crore Only"],
    ["10.50", "Rupees Ten and Fifty Paise Only"],
  ])("%s → %s", (n, words) => {
    expect(amountInWords(n)).toBe(words);
  });
});

/* ───────────────────────────── formatting ───────────────────────────── */

describe("Indian formatting (PRT-02, DSH-04)", () => {
  it("formats currency in lakh/crore groups", () => {
    expect(formatINR("203701")).toBe("₹2,03,701.00");
    expect(formatINR("1138323.42")).toBe("₹11,38,323.42");
    expect(formatINR("999")).toBe("₹999.00");
    expect(formatINR("123456789.5")).toBe("₹12,34,56,789.50");
    expect(formatINR("-60730.8")).toBe("-₹60,730.80");
    expect(formatINR("0")).toBe("₹0.00");
  });
  it("formats weights to 3 decimals", () => {
    expect(formatWeight("25.45")).toBe("25.450 g");
    expect(formatWeight("100000")).toBe("1,00,000.000 g");
  });
  it("compact values for dashboards", () => {
    expect(formatCompactINR("1240000")).toBe("₹12.4 L");
    expect(formatCompactINR("12000000")).toBe("₹1.2 Cr");
    expect(formatCompactINR("45200")).toBe("₹45,200");
  });
});

/* ───────────────────────────── §7.3 GST ───────────────────────────── */

describe("§7.3 GST rules", () => {
  it("GST-02 inter-state only when both states filled and differ (case-insensitive)", () => {
    expect(detectInterState("Karnataka", "Maharashtra")).toBe(true);
    expect(detectInterState(" maharashtra ", "Maharashtra")).toBe(false);
    expect(detectInterState("", "Maharashtra")).toBe(false);
    expect(detectInterState("Karnataka", "")).toBe(false);
  });
  it("GST-03 place of supply", () => {
    expect(placeOfSupply({ state: "", gstin: "" }, SHOP).label).toBe("Maharashtra (27)");
    expect(placeOfSupply({ state: "maharashtra", gstin: "" }, SHOP).label).toBe("maharashtra (27)");
    expect(placeOfSupply({ state: "Karnataka", gstin: "" }, SHOP).label).toBe("Karnataka");
    expect(placeOfSupply({ state: "Karnataka", gstin: "29abcde1234f1z5" }, SHOP).label).toBe("Karnataka (29)");
    expect(placeOfSupply({ state: "Karnataka", gstin: "29BAD" }, SHOP).code).toBeNull();
  });
});

/* ───────────────────────────── §7.4 numbering ───────────────────────────── */

describe("§7.4 invoice numbering", () => {
  it("NUM-03 FY from date (April–March)", () => {
    expect(financialYear("2027-03-15")).toBe("2026-27");
    expect(financialYear("2026-04-01")).toBe("2026-27");
    expect(financialYear("2026-03-31")).toBe("2025-26");
    expect(financialYear("2099-12-01")).toBe("2099-00");
  });
  it("NUM-02 formats", () => {
    expect(formatInvoiceNumber("INV", "2026-11-09", 1, true)).toBe("INV/2026-27/001");
    expect(formatInvoiceNumber("INV", "2026-11-09", 1000, true)).toBe("INV/2026-27/1000");
    expect(formatInvoiceNumber("INV", "2026-11-09", 1, false)).toBe("INV-0001");
    expect(formatInvoiceNumber("INV", "2026-11-09", 12345, false)).toBe("INV-12345");
    expect(() => formatInvoiceNumber("INV", "2026-11-09", 0, true)).toThrow();
  });
  it("series keys are per prefix and FY", () => {
    expect(seriesKey("INV", "2027-03-15", true)).toBe("INV|2026-27");
    expect(seriesKey("INV", "2027-04-01", true)).toBe("INV|2027-28");
    expect(seriesKey("INV", "2027-04-01", false)).toBe("INV");
  });
  it("NUM-06 prefix length limit", () => {
    expect(maxPrefixLength(true)).toBe(4);
    expect(formatInvoiceNumber("ABCD", "2026-11-09", 999, true)).toHaveLength(16);
    expect(maxPrefixLength(false)).toBe(11);
  });
  it("PRT-05 PDF file name", () => {
    expect(pdfFileName("INV/2026-27/001")).toBe("INV-2026-27-001.pdf");
  });
});

/* ───────────────────────────── §8.1 input rules + 16.2 ───────────────────────────── */

describe("§8.1 input rules", () => {
  it("T-20 phone '98-765 abc 43210999' → 9876543210", () => {
    expect(sanitizePhone("98-765 abc 43210999")).toBe("9876543210");
  });
  it("T-21 gross '−12.34567': minus blocked, blur → 12.346", () => {
    expect(isBlockedNumberKey("-")).toBe(true);
    expect(isBlockedNumberKey("+")).toBe(true);
    expect(isBlockedNumberKey("e")).toBe(true);
    expect(isBlockedNumberKey("E")).toBe(true);
    expect(isBlockedNumberKey("5")).toBe(false);
    const typed = sanitizeDecimalText("-12.34567");
    expect(typed).toBe("12.34567");
    expect(roundOnBlur(typed, "weight")).toBe("12.346");
  });
  it("VAL-03 GSTIN / PAN upper-case alphanumerics with max length", () => {
    expect(sanitizeGstin("27abcde-1234 f1z5XYZ")).toBe("27ABCDE1234F1Z5");
    expect(sanitizePan("abcde 1234 fz")).toBe("ABCDE1234F");
  });
  it("VAL-04 state code and pieces", () => {
    expect(sanitizeStateCode("2a7b9")).toBe("27");
    expect(roundOnBlur("2.6", "pcs")).toBe("3");
    expect(sanitizeDecimalText("1.5", true)).toBe("15");
  });
  it("VAL-05 rounding on blur", () => {
    expect(roundOnBlur("7150.555", "rate")).toBe("7150.56");
    expect(roundOnBlur("8.125", "pct")).toBe("8.13");
    expect(roundOnBlur("1,500", "money")).toBe("1500.00");
    expect(roundOnBlur("", "money")).toBe("");
    expect(roundOnBlur("1.2.3", "weight")).toBe("1.230");
  });
});

/* ───────────────────────────── §8.2 errors ───────────────────────────── */

const ok = () => invoice({ lines: [line({ gross: "10", rate: "7150" })] });

describe("§8.2 invoice errors", () => {
  it("a clean bill has no errors or warnings", () => {
    expect(validateInvoice(ok(), ctx())).toEqual({ errors: [], warnings: [] });
  });

  it("T-22 less 20 g, gross 10 g → E-08 (live) on the less field", () => {
    const v = validateInvoice(invoice({ lines: [line({ gross: "10", less: "20", rate: "7150" })] }), ctx());
    const e = v.errors.find((x) => x.id === "E-08");
    expect(e).toMatchObject({ field: "lines.0.less", live: true, message: "Item 1: less (stone) weight cannot be more than gross weight." });
  });

  it("T-23 phone 98765 → E-01 on customer.phone", () => {
    const v = validateInvoice({ ...ok(), customer: { name: "A", phone: "98765" } }, ctx());
    expect(v.errors).toContainEqual({ id: "E-01", field: "customer.phone", message: "Phone number must be exactly 10 digits.", live: false });
  });

  it("T-24 cash ≥ ₹2,00,000 → E-19 blocks; switching to UPI allows save", () => {
    const big = invoice({ payMode: "Cash", customer: { name: "A", phone: "9123456780", pan: "ABCDE1234F" }, lines: [line({ gross: "30", rate: "7150" })] });
    expect(computeInvoice(big).grandTotal).toBe("220935.00");
    const v = validateInvoice(big, ctx());
    expect(ids(v.errors)).toEqual(["E-19"]);
    expect(v.errors[0].live).toBe(true);
    expect(validateInvoice({ ...big, payMode: "UPI" }, ctx()).errors).toEqual([]);
    // Cash part payment below the limit is fine
    expect(ids(validateInvoice({ ...big, received: "199999" }, ctx()).errors)).not.toContain("E-19");
  });

  it("E-02 / E-03 customer GSTIN and PAN format", () => {
    const v = validateInvoice({ ...ok(), customer: { gstin: "27ABCDE1234F1X5", pan: "ABCD1234F" } }, ctx());
    expect(ids(v.errors)).toEqual(["E-02", "E-03"]);
    expect(validateInvoice({ ...ok(), customer: { gstin: "27abcde1234f1z5", pan: "abcde1234f" } }, ctx()).errors).toEqual([]);
  });

  it("E-04 missing date / E-05 future date (live)", () => {
    expect(ids(validateInvoice({ ...ok(), date: "" }, ctx()).errors)).toEqual(["E-04"]);
    expect(ids(validateInvoice({ ...ok(), date: "2026-02-30" }, ctx()).errors)).toEqual(["E-04"]);
    const v = validateInvoice({ ...ok(), date: "2026-11-10" }, ctx());
    expect(v.errors).toEqual([{ id: "E-05", field: "date", message: "Invoice date cannot be in the future.", live: true }]);
  });

  it("E-06 no usable line (blank INV-09 line with copied rate/making is ignored)", () => {
    const v = validateInvoice(invoice({ lines: [line({ description: "", rate: "7150", makingValue: "600" })] }), ctx());
    expect(ids(v.errors)).toEqual(["E-06"]);
    expect(v.errors[0].message).toBe("Add at least one item with its weight.");
  });

  it("E-07 gross weight missing unless stone-only or flat-making-only", () => {
    const v = validateInvoice(invoice({ lines: [line({ description: "Ring", rate: "7150" })] }), ctx());
    expect(v.errors).toContainEqual({ id: "E-07", field: "lines.0.gross", message: "Item 1: enter the gross weight.", live: false });
    expect(validateInvoice(invoice({ lines: [line({ description: "Certification", stone: "500" })] }), ctx()).errors).toEqual([]);
    expect(validateInvoice(invoice({ lines: [line({ description: "Polish", makingType: "flat", makingValue: "300" })] }), ctx()).errors).toEqual([]);
  });

  it("E-09 pieces whole number (live) / E-10 pieces ≥ 1 with weight", () => {
    const v9 = validateInvoice(invoice({ lines: [line({ gross: "10", rate: "7150", pcs: "1.5" })] }), ctx());
    expect(v9.errors).toContainEqual({ id: "E-09", field: "lines.0.pcs", message: "Item 1: pieces must be a whole number.", live: true });
    expect(ids(validateInvoice(invoice({ lines: [line({ gross: "10", rate: "7150", pcs: "0" })] }), ctx()).errors)).toEqual(["E-10"]);
    expect(ids(validateInvoice(invoice({ lines: [line({ gross: "10", rate: "7150", pcs: "" })] }), ctx()).errors)).toEqual(["E-10"]);
  });

  it("E-11 wastage > 100 / E-12 making % > 100 (live)", () => {
    const v = validateInvoice(invoice({ lines: [line({ gross: "10", rate: "7150", wastagePct: "101", makingType: "pct", makingValue: "100.01" })] }), ctx());
    expect(ids(v.errors)).toEqual(["E-11", "E-12"]);
    expect(v.errors.every((e) => e.live)).toBe(true);
    // 100 itself is allowed; ₹/g making above 100 is not a percentage
    expect(validateInvoice(invoice({ lines: [line({ gross: "10", rate: "7150", wastagePct: "100", makingType: "per_g", makingValue: "600" })] }), ctx()).errors).toEqual([]);
  });

  it("E-13 weight entered but no rate", () => {
    const v = validateInvoice(invoice({ lines: [line({ gross: "10", rate: "" })] }), ctx());
    expect(v.errors).toContainEqual({ id: "E-13", field: "lines.0.rate", message: "Item 1: enter the rate per gram.", live: false });
  });

  it("E-14 touch > 100 (live) / E-15 touch missing / E-16 fine rate missing", () => {
    const v = validateInvoice({ ...ok(), exchange: [xch({ weight: "2", touchPct: "101", fineRate: "7800" }), xch({ weight: "2", touchPct: "", fineRate: "" })] }, ctx());
    expect(v.errors.map((e) => `${e.id}@${e.field}`)).toEqual(["E-14@exchange.0.touchPct", "E-15@exchange.1.touchPct", "E-16@exchange.1.fineRate"]);
    expect(v.errors[0].message).toBe("Exchange item 1: touch cannot be more than 100%.");
    expect(v.errors[1].message).toBe("Exchange item 2: enter the touch %.");
    expect(v.errors[2].message).toBe("Exchange item 2: enter the fine rate.");
  });

  it("E-17 discount > items total (live)", () => {
    const v = validateInvoice({ ...ok(), discount: "100000" }, ctx());
    expect(v.errors).toEqual([{ id: "E-17", field: "discount", message: "Discount cannot be more than the items total.", live: true }]);
  });

  it("E-18 balance due needs name and phone", () => {
    const v = validateInvoice({ ...ok(), received: "1000", customer: { name: "", phone: "" } }, ctx());
    expect(ids(v.errors)).toEqual(["E-18"]);
    expect(v.errors[0].field).toBe("customer.name");
    const v2 = validateInvoice({ ...ok(), received: "1000", customer: { name: "Asha", phone: "" } }, ctx());
    expect(v2.errors[0].field).toBe("customer.phone");
    expect(validateInvoice({ ...ok(), received: "1000" }, ctx()).errors).toEqual([]);
  });
});

/* ───────────────────────────── §8.3 warnings ───────────────────────────── */

describe("§8.3 invoice warnings", () => {
  const big = () => invoice({ customer: { name: "A", phone: "9123456780" }, lines: [line({ gross: "30", rate: "7150" })] });

  it("T-25 UPI bill ≥ ₹2,00,000 without PAN → W-01 (warning only, no errors)", () => {
    const v = validateInvoice(big(), ctx());
    expect(v.errors).toEqual([]);
    expect(ids(v.warnings)).toEqual(["W-01"]);
    expect(v.warnings[0].field).toBe("customer.pan");
    expect(validateInvoice({ ...big(), customer: { ...big().customer, pan: "ABCDE1234F" } }, ctx()).warnings).toEqual([]);
  });

  it("W-02 Mixed with received ≥ ₹2,00,000", () => {
    const v = validateInvoice({ ...big(), payMode: "Mixed", customer: { ...big().customer, pan: "ABCDE1234F" } }, ctx());
    expect(ids(v.warnings)).toEqual(["W-02"]);
  });

  it("W-04 PAN differs from the PAN inside the GSTIN", () => {
    const v = validateInvoice({ ...ok(), customer: { gstin: "27ABCDE1234F1Z5", pan: "ZZZZZ9999Z" } }, ctx());
    expect(ids(v.warnings)).toEqual(["W-04"]);
    expect(validateInvoice({ ...ok(), customer: { gstin: "27ABCDE1234F1Z5", pan: "ABCDE1234F" } }, ctx()).warnings).toEqual([]);
  });

  it("W-05 new bill more than 30 days old (not on edit)", () => {
    const v = validateInvoice({ ...ok(), date: "2026-10-09" }, ctx());
    expect(v.warnings).toEqual([{ id: "W-05", field: "date", message: "The invoice date (09-10-2026) is more than 30 days old." }]);
    expect(validateInvoice({ ...ok(), date: "2026-10-10" }, ctx()).warnings).toEqual([]);
    expect(validateInvoice({ ...ok(), date: "2026-10-09" }, ctx({ isNew: false })).warnings).toEqual([]);
  });

  it("W-06 rate more than 10% away from today's rate", () => {
    const todaysRates = [{ label: "Gold 22K (916)", rate: "7150" }];
    const v = validateInvoice(invoice({ lines: [line({ gross: "10", rate: "6400" })] }), ctx({ todaysRates }));
    expect(v.warnings).toEqual([
      { id: "W-06", field: "lines.0.rate", message: "Item 1: rate ₹6,400.00/g is more than 10% away from today's Gold 22K (916) rate (₹7,150.00/g)." },
    ]);
    expect(validateInvoice(invoice({ lines: [line({ gross: "10", rate: "6500" })] }), ctx({ todaysRates })).warnings).toEqual([]);
  });

  it("W-07 unusually heavy gross weight", () => {
    const v = validateInvoice(invoice({ customer: { pan: "ABCDE1234F" }, lines: [line({ gross: "5000.001", rate: "1" })] }), ctx());
    expect(v.warnings).toEqual([{ id: "W-07", field: "lines.0.gross", message: "Item 1: 5,000.001 g looks unusually heavy — please check the weight." }]);
    const silver = validateInvoice(invoice({ lines: [line({ metal: "Silver", gross: "50000", rate: "1" })] }), ctx());
    expect(silver.warnings).toEqual([]);
  });

  it("T-26 same customer, same total, same day → W-08 naming the first number", () => {
    const inp = ok();
    const t = computeInvoice(inp);
    const savedBills = [
      { number: "INV/2026-27/001", date: TODAY, customerName: "asha patil", customerPhone: "9123456780", grandTotal: t.grandTotal },
    ];
    const v = validateInvoice(inp, ctx({ savedBills }));
    expect(v.warnings).toEqual([
      { id: "W-08", field: "customer.name", message: "A bill for the same customer and amount was already saved today (INV/2026-27/001). Is this a duplicate?" },
    ]);
    expect(validateInvoice(inp, ctx({ savedBills, isNew: false })).warnings).toEqual([]);
    expect(validateInvoice(inp, ctx({ savedBills: [{ ...savedBills[0], grandTotal: "1" }] })).warnings).toEqual([]);
  });

  it("limits are configuration (§13)", () => {
    const v = validateInvoice(big(), ctx({ limits: { panLimit: "300000" } }));
    expect(v.warnings).toEqual([]);
  });
});

/* ───────────────────────────── §8.4 settings ───────────────────────────── */

describe("§8.4 settings validation", () => {
  it("valid settings pass", () => {
    expect(validateSettings(SHOP)).toEqual({ errors: [], warnings: [] });
  });

  it("T-27 prefix 'SHREELAXMI' with FY numbering → S-09 shorten to 4", () => {
    const v = validateSettings({ ...SHOP, prefixGst: "SHREELAXMI" });
    expect(v.errors).toEqual([
      {
        id: "S-09",
        field: "prefixGst",
        message: "Invoice numbers can be at most 16 characters under GST rules — shorten this prefix to 4 characters or less.",
      },
    ]);
    // Without FY reset the same prefix fits (SHREELAXMI-0001 = 15 chars)
    expect(validateSettings({ ...SHOP, prefixGst: "SHREELAXMI", fyNumbering: false }).errors).toEqual([]);
  });

  it("S-01..S-08, S-10", () => {
    const v = validateSettings({
      ...SHOP,
      name: " ",
      phone: "12345",
      email: "a@b",
      gstin: "27ABCDE1234F1Z",
      stateCode: "39",
      gstRate: "29",
      prefixNoGst: "BILL/X",
      hsnGold: "711",
    });
    expect(ids(v.errors)).toEqual(["S-01", "S-02", "S-03", "S-04", "S-05", "S-07", "S-08", "S-10"]);
  });

  it("S-06 state code must equal GSTIN digits", () => {
    const v = validateSettings({ ...SHOP, stateCode: "29" });
    expect(v.errors).toEqual([{ id: "S-06", field: "stateCode", message: "State code should be 27 — the first 2 digits of your GSTIN." }]);
  });

  it("S-07 GST % bounds are inclusive 0–28", () => {
    expect(validateSettings({ ...SHOP, gstRate: "0" }).errors).toEqual([]);
    expect(validateSettings({ ...SHOP, gstRate: "28" }).errors).toEqual([]);
    expect(ids(validateSettings({ ...SHOP, gstRate: "" }).errors)).toEqual(["S-07"]);
  });
});

/* ───────────────────────────── §5.2 rate master ───────────────────────────── */

describe("§5.2 rate master", () => {
  const rows = (): PurityRateRow[] => DEFAULT_PURITIES.map((r) => ({ ...r }));

  it("RATE-05 auto-fill from fine rate", () => {
    const r = rows();
    r[0].rate = "7800";
    r[3].rate = "98";
    const filled = autoFillFromFineRate(r);
    expect(filled.map((x) => x.rate)).toEqual(["7800", "7151.95", "5855.86", "98", "90.74"]);
    expect(fineRateFor("Gold", filled)).toBe("7800.00");
    expect(fineRateFor("Silver", filled)).toBe("98.00");
    expect(fineRateFor("Platinum", filled)).toBe("");
  });

  it("RATE-05 base is the highest purity that HAS a rate", () => {
    const r = rows();
    r[1].rate = "7150"; // only 22K priced
    const filled = autoFillFromFineRate(r);
    expect(filled[0].rate).toBe("7797.87"); // 7150 × 99.9 / 91.6
    expect(filled[2].rate).toBe("5854.26"); // 7150 × 75 / 91.6
  });

  it("RATE-03 equivalents", () => {
    expect(rateEquivalent("Gold", "7150")).toEqual({ amount: "71500.00", unit: "10 g" });
    expect(rateEquivalent("Silver", "91")).toEqual({ amount: "91000.00", unit: "kg" });
    expect(rateEquivalent("Gold", "")).toBeNull();
  });

  it("R-01..R-05", () => {
    const v = validateRates([
      { metal: "Gold", label: "Gold 24K", purityPct: "99.9", rate: "7800" },
      { metal: "Gold", label: "", purityPct: "91.6", rate: "7150" }, // R-01
      { metal: "Gold", label: "gold 24k", purityPct: "99.9", rate: "7800" }, // R-02
      { metal: "Gold", label: "Gold 18K", purityPct: "0", rate: "" }, // R-03 + R-04
      { metal: "Silver", label: "Silver 999", purityPct: "99.9", rate: "90" },
      { metal: "Silver", label: "Silver 925", purityPct: "92.5", rate: "95" }, // R-05
      { metal: "Gold", label: "", purityPct: "", rate: "" }, // blank row ignored
    ]);
    expect(v.errors.map((e) => e.id)).toEqual(["R-01", "R-02", "R-03"]);
    expect(v.errors[0].message).toBe("Row 2: enter a purity name.");
    expect(v.errors[1].message).toBe('"gold 24k" is listed twice.');
    expect(v.errors[2].message).toBe("Gold 18K: purity % must be more than 0 and at most 100.");
    expect(v.warnings.map((w) => w.message)).toEqual(["Gold 18K has no rate.", "Silver 925 rate is higher than Silver 999 — please check."]);
  });

  it("RATE-09 / T-32 manual lines keep their rate, others follow", () => {
    const master: PurityRateRow[] = [{ id: "p22", metal: "Gold", label: "Gold 22K (916)", purityPct: "91.6", rate: "7200" }];
    const out = applyRateMaster(
      [line({ purityId: "p22", rate: "7150.00" }), line({ purityId: "p22", rate: "7000.00", rateManual: true })],
      master,
    );
    expect(out[0].rate).toBe("7200.00");
    expect(out[1].rate).toBe("7000.00");
  });

  it("INV-09 new line copies purity, rate, HSN and making", () => {
    const prev = line({ description: "Necklace", purityId: "p22", gross: "10", rate: "7150", hsn: "7113", makingType: "pct", makingValue: "12" });
    const n = newLineFrom(prev);
    expect(n).toMatchObject({ description: "", gross: "", purityId: "p22", purityLabel: "Gold 22K (916)", rate: "7150", hsn: "7113", makingType: "pct", makingValue: "12", pcs: "1" });
  });
});
