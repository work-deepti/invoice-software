/**
 * Gold & Silver Billing — calculation & validation engine.
 *
 * Pure, framework-free TypeScript shared by the browser (live totals) and the
 * server (authoritative recompute, API-01). Every money / weight operation
 * uses decimal.js — never binary floating point (NFR-02).
 *
 * PRD traceability:
 *   §7.1  formulas 1–18          → computeLine, computeExchangeRow, computeInvoice, amountInWords
 *   §7.3  GST-01..04             → detectInterState, placeOfSupply, invoiceHeading, taxRows
 *   §7.4  NUM-01..07             → financialYear, seriesKey, formatInvoiceNumber, maxPrefixLength
 *   §8.1  VAL-01..07             → sanitize* / roundOnBlur / isBlockedNumberKey
 *   §8.2  E-01..E-19, E-20 (D-02) → validateInvoice (errors)
 *   §8.3  W-01..W-08             → validateInvoice (warnings)
 *   §8.4  S-01..S-10, R-01..R-05 → validateSettings, validateRates
 *   §5.2  RATE-03/05/09          → rateEquivalent, autoFillFromFineRate, fineRateFor, applyRateMaster
 *   §13   compliance limits      → DEFAULT_LIMITS (configuration, not hard-coded)
 */
import Decimal from "decimal.js";

/* ────────────────────────────────────────────────────────────────────────── */
/* Decimal setup & primitives                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/** Isolated Decimal constructor: 40 significant digits, half away from zero. */
export const D = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP, // decimal.js ROUND_HALF_UP = half away from zero
  toExpNeg: -30,
  toExpPos: 40,
});
export type Dec = Decimal;

/** Anything a form field or JSON body might hold for a number. */
export type NumLike = string | number | Decimal | null | undefined;

const NUM_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/** True when the user left the field empty. */
export function isBlank(v: NumLike): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.replace(/[,\s₹]/g, "") === "";
  return false;
}

/**
 * Parse a field value into a non-negative Decimal.
 * Blank / non-numeric → 0. Negative → positive (VAL-01: "a pasted negative
 * becomes positive"), so an API call cannot smuggle negatives in either.
 */
export function toDec(v: NumLike): Decimal {
  if (v === null || v === undefined) return new D(0);
  if (Decimal.isDecimal(v)) return new D(v as Decimal).abs();
  if (typeof v === "number") return Number.isFinite(v) ? new D(v).abs() : new D(0);
  const s = String(v).replace(/[,\s₹]/g, "");
  if (s === "" || !NUM_RE.test(s)) return new D(0);
  return new D(s).abs();
}

/** Signed parse (used only for already-computed values such as round off). */
function toSignedDec(v: NumLike): Decimal {
  if (v === null || v === undefined) return new D(0);
  if (Decimal.isDecimal(v)) return new D(v as Decimal);
  if (typeof v === "number") return Number.isFinite(v) ? new D(v) : new D(0);
  const s = String(v).replace(/[,\s₹]/g, "");
  if (s === "" || !NUM_RE.test(s)) return new D(0);
  return new D(s);
}

const noNegZero = (d: Decimal): Decimal => (d.isZero() ? new D(0) : d);
export const round0 = (d: Decimal) => noNegZero(d.toDecimalPlaces(0, Decimal.ROUND_HALF_UP));
export const round2 = (d: Decimal) => noNegZero(d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
export const round3 = (d: Decimal) => noNegZero(d.toDecimalPlaces(3, Decimal.ROUND_HALF_UP));
const fix2 = (d: Decimal) => round2(d).toFixed(2);
const fix3 = (d: Decimal) => round3(d).toFixed(3);

/** Decimal-string money value, always 2 dp (e.g. "206308.50"). */
export type Money = string;
/** Decimal-string weight value, always 3 dp (e.g. "24.250"). */
export type Grams = string;

/* ────────────────────────────────────────────────────────────────────────── */
/* Domain types                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export const METALS = ["Gold", "Silver", "Platinum", "Other"] as const;
export type Metal = (typeof METALS)[number];

export const MAKING_TYPES = ["per_g", "pct", "flat"] as const;
export type MakingType = (typeof MAKING_TYPES)[number];

export const PAY_MODES = ["Cash", "UPI", "Card", "Bank transfer", "Cheque", "Mixed", "Credit"] as const;
export type PayMode = (typeof PAY_MODES)[number];

export interface LineInput {
  description?: string;
  purityId?: string | null;
  metal: Metal;
  purityLabel?: string;
  hsn?: string;
  pcs?: NumLike;
  gross?: NumLike;
  less?: NumLike;
  wastagePct?: NumLike;
  rate?: NumLike;
  /** INV-10: true once the user typed this line's rate by hand. */
  rateManual?: boolean;
  makingType: MakingType;
  makingValue?: NumLike;
  stone?: NumLike;
}

export interface ExchangeInput {
  description?: string;
  metal: Metal;
  weight?: NumLike;
  touchPct?: NumLike;
  fineRate?: NumLike;
}

export interface CustomerInput {
  phone?: string;
  name?: string;
  gstin?: string;
  pan?: string;
  state?: string;
  address?: string;
  /** D-02: "No-PAN declaration (Form 60) received" tick box. */
  panDeclaration?: boolean;
}

export interface InvoiceInput {
  /** ISO date YYYY-MM-DD (Asia/Kolkata calendar day). */
  date: string;
  payMode: PayMode;
  /** Free-text payment details (bank name, cheque or UPI reference). Not used in any calculation. */
  payDetails?: string;
  gstOn: boolean;
  interState: boolean;
  gstRate: NumLike;
  customer: CustomerInput;
  lines: LineInput[];
  exchange: ExchangeInput[];
  discount?: NumLike;
  /** Blank = "Full" (received equals grand total). */
  received?: NumLike;
  notes?: string;
}

/** Section 13 — compliance limits as configuration. */
export interface ComplianceLimits {
  cashLimit: NumLike; // s.269ST
  panLimit: NumLike; // r.114B
  cashPayoutLimit: NumLike; // s.40A(3)
  maxInvoiceNoLength: number; // CGST Rule 46
  rateDeviationPct: NumLike; // W-06
  heavyGoldG: NumLike; // W-07
  heavyOtherG: NumLike; // W-07
  oldBillDays: number; // W-05
  /**
   * D-02 (owner decision 9 Nov 2026): a bill ≥ panLimit with no PAN is
   * "block" → error E-20 unless the Form 60 declaration is ticked;
   * "warn" → the original W-01 "Save anyway" warning.
   */
  panMissingPolicy: "block" | "warn";
}

export const DEFAULT_LIMITS: ComplianceLimits = {
  cashLimit: "200000",
  panLimit: "200000",
  cashPayoutLimit: "10000",
  maxInvoiceNoLength: 16,
  rateDeviationPct: "10",
  heavyGoldG: "5000",
  heavyOtherG: "100000",
  oldBillDays: 30,
  panMissingPolicy: "block",
};

/* ────────────────────────────────────────────────────────────────────────── */
/* §7.1 Per-line calculation (formulas 1–6)                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export interface LineResult {
  gross: Grams;
  less: Grams;
  net: Grams;
  wastagePct: Money;
  chargeable: Grams;
  rate: Money;
  metalValue: Money;
  makingInput: Money;
  making: Money;
  stone: Money;
  amount: Money;
  pcs: number;
  used: boolean;
}

/**
 * A line counts as "used" when it carries a description, a weight, a stone
 * amount or a flat making amount. A brand-new line pre-filled by INV-09
 * (rate + ₹/g making copied) is still blank.
 */
export function isLineUsed(l: LineInput): boolean {
  if ((l.description ?? "").trim() !== "") return true;
  if (toDec(l.gross).gt(0) || toDec(l.less).gt(0)) return true;
  if (toDec(l.stone).gt(0)) return true;
  if (l.makingType === "flat" && toDec(l.makingValue).gt(0)) return true;
  return false;
}

export function computeLine(l: LineInput): LineResult {
  const gross = round3(toDec(l.gross));
  const less = round3(toDec(l.less));
  // 1. Net = max(0, Gross − Less), 3 dp
  const net = round3(Decimal.max(0, gross.minus(less)));
  // 2. Chargeable = Net × (1 + Wastage%/100), 3 dp
  const wastage = round2(toDec(l.wastagePct));
  const chargeable = round3(net.times(wastage.div(100).plus(1)));
  // 3. Metal value = Chargeable × Rate, 2 dp
  const rate = round2(toDec(l.rate));
  const metalValue = round2(chargeable.times(rate));
  // 4. Making
  const makingInput = round2(toDec(l.makingValue));
  let making: Decimal;
  switch (l.makingType) {
    case "per_g": // ₹/g × NET weight (not chargeable)
      making = makingInput.times(net);
      break;
    case "pct":
      making = metalValue.times(makingInput).div(100);
      break;
    case "flat":
    default:
      making = makingInput;
  }
  making = round2(making);
  // 5. Stone / other, 2 dp
  const stone = round2(toDec(l.stone));
  // 6. Line amount
  const amount = metalValue.plus(making).plus(stone);

  const pcsRaw = isBlank(l.pcs) ? new D(0) : toDec(l.pcs);
  return {
    gross: fix3(gross),
    less: fix3(less),
    net: fix3(net),
    wastagePct: fix2(wastage),
    chargeable: fix3(chargeable),
    rate: fix2(rate),
    metalValue: fix2(metalValue),
    makingInput: fix2(makingInput),
    making: fix2(making),
    stone: fix2(stone),
    amount: fix2(amount),
    pcs: pcsRaw.toNumber(),
    used: isLineUsed(l),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* §7.1 Exchange (formula 11)                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ExchangeResult {
  weight: Grams;
  touchPct: Money;
  fine: Grams;
  fineRate: Money;
  value: Money;
  used: boolean;
}

export function isExchangeUsed(x: ExchangeInput): boolean {
  return toDec(x.weight).gt(0);
}

export function computeExchangeRow(x: ExchangeInput): ExchangeResult {
  const weight = round3(toDec(x.weight));
  const touch = round2(toDec(x.touchPct));
  const fine = round3(weight.times(touch).div(100));
  const fineRate = round2(toDec(x.fineRate));
  const value = round2(fine.times(fineRate));
  return {
    weight: fix3(weight),
    touchPct: fix2(touch),
    fine: fix3(fine),
    fineRate: fix2(fineRate),
    value: fix2(value),
    used: isExchangeUsed(x),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* §7.1 Per-invoice calculation (formulas 7–18)                               */
/* ────────────────────────────────────────────────────────────────────────── */

export interface MetalWeights {
  gross: Grams;
  net: Grams;
}

export interface InvoiceTotals {
  lines: LineResult[];
  exchange: ExchangeResult[];
  itemsTotal: Money;
  discountEntered: Money;
  discount: Money;
  taxable: Money;
  gstRate: Money;
  cgst: Money;
  sgst: Money;
  igst: Money;
  gstTotal: Money;
  exchangeTotal: Money;
  beforeRounding: Money;
  roundOff: Money;
  grandTotal: Money;
  receivedIsFull: boolean;
  received: Money;
  changeReturned: Money;
  paid: Money;
  balance: Money;
  goldNetG: Grams;
  silverNetG: Grams;
  weightsByMetal: Partial<Record<Metal, MetalWeights>>;
  totalPcs: number;
  /** INV-16: exchange exceeds the bill. */
  payableToCustomer: boolean;
  amountInWords: string;
}

export function computeInvoice(input: InvoiceInput): InvoiceTotals {
  const lines = input.lines.map(computeLine);
  const exchange = input.exchange.map(computeExchangeRow);

  // 7. Items total
  const itemsTotal = lines.reduce((s, l) => s.plus(l.amount), new D(0));
  // 8. Discount = min(entered, items total)
  const discountEntered = round2(toDec(input.discount));
  const discount = Decimal.min(discountEntered, itemsTotal);
  // 9. Taxable value
  const taxable = itemsTotal.minus(discount);
  // 10. GST
  const gstRate = round2(toDec(input.gstRate));
  let cgst = new D(0);
  let sgst = new D(0);
  let igst = new D(0);
  if (input.gstOn) {
    if (input.interState) {
      igst = round2(taxable.times(gstRate).div(100));
    } else {
      cgst = round2(taxable.times(gstRate).div(200));
      sgst = cgst;
    }
  }
  const gstTotal = cgst.plus(sgst).plus(igst);
  // 11. Exchange total
  const exchangeTotal = exchange.reduce((s, x) => s.plus(x.value), new D(0));
  // 12. Before rounding
  const beforeRounding = taxable.plus(gstTotal).minus(exchangeTotal);
  // 13. Grand total (nearest rupee, half away from zero) & round off
  const grandTotal = round0(beforeRounding);
  const roundOff = grandTotal.minus(beforeRounding);
  // 14. Received
  const receivedIsFull = isBlank(input.received);
  const received = receivedIsFull ? grandTotal : round2(toDec(input.received));
  // 15. Change & paid
  const changeReturned = grandTotal.gte(0) ? Decimal.max(0, received.minus(grandTotal)) : new D(0);
  const paid = received.minus(changeReturned);
  // 16. Balance due
  const balance = grandTotal.minus(paid);

  // 17. Weight by metal (never add gold and silver grams together)
  const weightsByMetal: Partial<Record<Metal, { gross: Decimal; net: Decimal }>> = {};
  let totalPcs = 0;
  input.lines.forEach((li, i) => {
    const r = lines[i];
    if (!r.used) return;
    totalPcs += Number.isInteger(r.pcs) ? r.pcs : 0;
    const w = (weightsByMetal[li.metal] ??= { gross: new D(0), net: new D(0) });
    w.gross = w.gross.plus(r.gross);
    w.net = w.net.plus(r.net);
  });
  const wbm: Partial<Record<Metal, MetalWeights>> = {};
  for (const m of METALS) {
    const w = weightsByMetal[m];
    if (w) wbm[m] = { gross: fix3(w.gross), net: fix3(w.net) };
  }

  return {
    lines,
    exchange,
    itemsTotal: fix2(itemsTotal),
    discountEntered: fix2(discountEntered),
    discount: fix2(discount),
    taxable: fix2(taxable),
    gstRate: fix2(gstRate),
    cgst: fix2(cgst),
    sgst: fix2(sgst),
    igst: fix2(igst),
    gstTotal: fix2(gstTotal),
    exchangeTotal: fix2(exchangeTotal),
    beforeRounding: fix2(beforeRounding),
    roundOff: fix2(roundOff),
    grandTotal: fix2(grandTotal),
    receivedIsFull,
    received: fix2(received),
    changeReturned: fix2(changeReturned),
    paid: fix2(paid),
    balance: fix2(balance),
    goldNetG: fix3(weightsByMetal.Gold?.net ?? new D(0)),
    silverNetG: fix3(weightsByMetal.Silver?.net ?? new D(0)),
    weightsByMetal: wbm,
    totalPcs,
    payableToCustomer: grandTotal.lt(0),
    // 18. Amount in words
    amountInWords: amountInWords(grandTotal.abs()),
  };
}

/** INV-16 */
export function grandTotalLabel(t: Pick<InvoiceTotals, "payableToCustomer">): string {
  return t.payableToCustomer ? "Payable to customer" : "Grand total";
}

/* ────────────────────────────────────────────────────────────────────────── */
/* §7.1 (18) Amount in words — Indian system                                  */
/* ────────────────────────────────────────────────────────────────────────── */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(" ");
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? twoDigits(r) : ""].filter(Boolean).join(" ");
}

/** Integer → Indian words (crore, lakh, thousand, hundred). 0 → "Zero". */
export function integerToIndianWords(n: bigint): string {
  if (n < BigInt(0)) n = -n;
  if (n === BigInt(0)) return "Zero";
  const CRORE = BigInt(10_000_000);
  const parts: string[] = [];
  const crore = n / CRORE;
  let rest = Number(n % CRORE);
  if (crore > BigInt(0)) parts.push(`${integerToIndianWords(crore)} Crore`);
  const lakh = Math.floor(rest / 100_000);
  rest %= 100_000;
  const thousand = Math.floor(rest / 1000);
  rest %= 1000;
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ");
}

/**
 * "Rupees Two Lakh Three Thousand Seven Hundred One Only".
 * Paise are added when present: "Rupees Ten and Fifty Paise Only".
 */
export function amountInWords(amount: NumLike): string {
  const v = round2(toDec(amount));
  const rupees = BigInt(v.trunc().toFixed(0));
  const paise = Number(v.minus(v.trunc()).times(100).toFixed(0));
  const r = `Rupees ${integerToIndianWords(rupees)}`;
  return paise ? `${r} and ${twoDigits(paise)} Paise Only` : `${r} Only`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Formatting (PRT-02, DSH-04)                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/** Indian digit grouping: 1234567.8 → "12,34,567.80". */
export function formatIndianNumber(value: NumLike, decimals = 2): string {
  const d = toSignedDec(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  const neg = d.isNeg() && !d.isZero();
  const [int, frac] = d.abs().toFixed(decimals).split(".");
  let grouped = int;
  if (int.length > 3) {
    const last3 = int.slice(-3);
    const head = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    grouped = `${head},${last3}`;
  }
  return `${neg ? "-" : ""}${grouped}${frac !== undefined ? `.${frac}` : ""}`;
}

/** "₹2,03,701.00"; negatives as "-₹60,730.80". */
export function formatINR(value: NumLike, decimals = 2): string {
  const s = formatIndianNumber(value, decimals);
  return s.startsWith("-") ? `-₹${s.slice(1)}` : `₹${s}`;
}

/** "25.450 g" (always 3 dp, Indian grouping). */
export function formatWeight(value: NumLike, unit = "g"): string {
  return `${formatIndianNumber(value, 3)}${unit ? ` ${unit}` : ""}`;
}

/** DSH-04 compact form: ₹12.4 L, ₹1.2 Cr; below one lakh the full amount. */
export function formatCompactINR(value: NumLike): string {
  const d = toSignedDec(value);
  const sign = d.isNeg() && !d.isZero() ? "-" : "";
  const a = d.abs();
  if (a.gte(10_000_000)) return `${sign}₹${a.div(10_000_000).toDecimalPlaces(1).toString()} Cr`;
  if (a.gte(100_000)) return `${sign}₹${a.div(100_000).toDecimalPlaces(1).toString()} L`;
  return `${sign}₹${formatIndianNumber(a, 0)}`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Dates (Asia/Kolkata, FY Apr–Mar)                                           */
/* ────────────────────────────────────────────────────────────────────────── */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(s: string | undefined | null): s is string {
  if (!s) return false;
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return dt.getUTCFullYear() === +m[1] && dt.getUTCMonth() === +m[2] - 1 && dt.getUTCDate() === +m[3];
}

/** Today's calendar date in Asia/Kolkata, as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "2026-11-09" → "09-11-2026" */
export function formatDateDMY(iso: string): string {
  const m = ISO_DATE.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/** Whole days from a to b (b − a), both YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  const pa = ISO_DATE.exec(a);
  const pb = ISO_DATE.exec(b);
  if (!pa || !pb) return 0;
  const ta = Date.UTC(+pa[1], +pa[2] - 1, +pa[3]);
  const tb = Date.UTC(+pb[1], +pb[2] - 1, +pb[3]);
  return Math.round((tb - ta) / 86_400_000);
}

/** NUM-03: FY from invoice date. "2027-03-15" → "2026-27". */
export function financialYear(iso: string): string {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new Error(`Invalid date: ${iso}`);
  const y = +m[1];
  const start = +m[2] >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* §7.4 Invoice numbering                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/** NUM-01: GST bills use the GST prefix, bills without GST the other one. */
export function seriesPrefixFor(gstOn: boolean, s: Pick<ShopSettings, "prefixGst" | "prefixNoGst">): string {
  return gstOn ? s.prefixGst : s.prefixNoGst;
}

/** invoice_series.series_key — e.g. "INV|2026-27", or "INV" with FY reset off. */
export function seriesKey(prefix: string, invoiceDate: string, fyNumbering: boolean): string {
  return fyNumbering ? `${prefix}|${financialYear(invoiceDate)}` : prefix;
}

/** NUM-02: INV/2026-27/001 (FY reset on) or INV-0001 (off). Grows past 999 / 9999. */
export function formatInvoiceNumber(prefix: string, invoiceDate: string, seq: number, fyNumbering: boolean): string {
  if (!Number.isInteger(seq) || seq < 1) throw new Error(`Invalid sequence: ${seq}`);
  return fyNumbering
    ? `${prefix}/${financialYear(invoiceDate)}/${String(seq).padStart(3, "0")}`
    : `${prefix}-${String(seq).padStart(4, "0")}`;
}

/** Characters taken by everything except the prefix (at the minimum padded width). */
function numberOverhead(fyNumbering: boolean): number {
  return fyNumbering ? "/2026-27/001".length : "-0001".length; // 12 : 5
}

/** NUM-06: longest prefix that keeps the full number ≤ max length (FY format → 4). */
export function maxPrefixLength(fyNumbering: boolean, maxLen = DEFAULT_LIMITS.maxInvoiceNoLength): number {
  return Math.max(0, maxLen - numberOverhead(fyNumbering));
}

/** PRT-05: "INV/2026-27/001" → "INV-2026-27-001.pdf" */
export function pdfFileName(invoiceNumber: string): string {
  return `${invoiceNumber.replace(/\//g, "-")}.pdf`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* §7.3 GST rules                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

const norm = (s: string | undefined | null) => (s ?? "").trim().toLowerCase();

/** GST-02: both states filled and different (case-insensitive) → IGST. */
export function detectInterState(customerState: string | undefined, shopState: string | undefined): boolean {
  const c = norm(customerState);
  const s = norm(shopState);
  return c !== "" && s !== "" && c !== s;
}

export interface PlaceOfSupply {
  state: string;
  code: string | null;
  label: string;
}

/**
 * GST-03: state = customer's state, else shop's. Code from a valid customer
 * GSTIN, else the shop's code when the states match. Label "Karnataka (29)".
 */
export function placeOfSupply(
  customer: Pick<CustomerInput, "state" | "gstin">,
  shop: Pick<ShopSettings, "state" | "stateCode">,
): PlaceOfSupply {
  const state = (customer.state ?? "").trim() || (shop.state ?? "").trim();
  const gstin = (customer.gstin ?? "").trim().toUpperCase();
  let code: string | null = null;
  if (GSTIN_RE.test(gstin)) code = gstin.slice(0, 2);
  else if (state && norm(state) === norm(shop.state) && /^\d{2}$/.test(shop.stateCode ?? "")) code = shop.stateCode;
  const label = state ? (code ? `${state} (${code})` : state) : code ?? "";
  return { state, code, label };
}

/** GST-01 heading lines. */
export function invoiceHeading(gstOn: boolean, s: Pick<ShopSettings, "noGstTitle">): { title: string; subtitle: string | null } {
  return gstOn
    ? { title: "TAX INVOICE", subtitle: "ORIGINAL FOR RECIPIENT" }
    : { title: (s.noGstTitle || "INVOICE").trim(), subtitle: null };
}

/** Pretty-prints a percentage: "1.50" → "1.5", "3.00" → "3". */
export function formatPct(v: NumLike): string {
  return round2(toDec(v)).toString();
}

export interface TaxRow {
  key: "cgst" | "sgst" | "igst";
  label: string;
  amount: Money;
}

/** INV-15 tax rows; [] when GST is off (the UI then shows "GST: Not added"). */
export function taxRows(gstOn: boolean, interState: boolean, t: Pick<InvoiceTotals, "gstRate" | "cgst" | "sgst" | "igst">): TaxRow[] {
  if (!gstOn) return [];
  const rate = toDec(t.gstRate);
  if (interState) return [{ key: "igst", label: `IGST ${formatPct(rate)}%`, amount: t.igst }];
  const half = formatPct(rate.div(2));
  return [
    { key: "cgst", label: `CGST ${half}%`, amount: t.cgst },
    { key: "sgst", label: `SGST ${half}%`, amount: t.sgst },
  ];
}

/* ────────────────────────────────────────────────────────────────────────── */
/* §8.1 Input rules (as you type)                                             */
/* ────────────────────────────────────────────────────────────────────────── */

/** VAL-01: keys blocked in number fields. */
export function isBlockedNumberKey(key: string): boolean {
  return key === "-" || key === "+" || key === "e" || key === "E";
}

/** VAL-02: digits only, max 10 (pasted text stripped to digits). */
export function sanitizePhone(text: string): string {
  return (text ?? "").replace(/\D/g, "").slice(0, 10);
}

/** VAL-03: letters/digits only, upper case, max length. */
export function sanitizeAlnumUpper(text: string, max: number): string {
  return (text ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, max);
}
export const sanitizeGstin = (t: string) => sanitizeAlnumUpper(t, 15);
export const sanitizePan = (t: string) => sanitizeAlnumUpper(t, 10);

/** VAL-04: state code — digits only, max 2. */
export function sanitizeStateCode(text: string): string {
  return (text ?? "").replace(/\D/g, "").slice(0, 2);
}

/**
 * VAL-01 while typing: keep digits and the first ".", drop everything else
 * (so a pasted "-12.5" becomes "12.5"). With integerOnly no "." is kept.
 */
export function sanitizeDecimalText(text: string, integerOnly = false): string {
  const raw = (text ?? "").replace(/,/g, "");
  let out = "";
  let dot = false;
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === "." && !dot && !integerOnly) {
      out += ch;
      dot = true;
    }
  }
  return out;
}

export type FieldKind = "weight" | "money" | "rate" | "pct" | "pcs";

/** VAL-04/05 on leaving a field: weights 3 dp; rates, money, % 2 dp; pieces whole. */
export function roundOnBlur(text: string, kind: FieldKind): string {
  const clean = sanitizeDecimalText(text);
  if (clean === "" || clean === ".") return "";
  const d = toDec(clean);
  switch (kind) {
    case "weight":
      return fix3(d);
    case "pcs":
      return round0(d).toFixed(0);
    default:
      return fix2(d);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Validation primitives                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PREFIX_RE = /^[A-Za-z0-9-]{1,10}$/;
export const HSN_RE = /^\d{4,8}$/;

export interface Issue {
  /** Rule id, e.g. "E-08". */
  id: string;
  /** Dotted path of the field to highlight / focus, e.g. "lines.0.less". */
  field: string;
  message: string;
  /** "Live" errors turn red while typing (§8.2). */
  live?: boolean;
}

export interface ValidationResult {
  errors: Issue[];
  warnings: Issue[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/* §8.2 / §8.3 Invoice validation                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export interface RateRef {
  purityId?: string | null;
  label: string;
  rate: NumLike;
}

export interface SavedBillRef {
  number: string;
  date: string;
  customerName?: string | null;
  customerPhone?: string | null;
  grandTotal: NumLike;
}

export interface InvoiceValidationContext {
  /** Today's date (Asia/Kolkata), YYYY-MM-DD. */
  today: string;
  /** New bill (true) or editing a saved one (false) — W-05, W-08. */
  isNew: boolean;
  /** Today's rate master — W-06. */
  todaysRates?: RateRef[];
  /** Bills already saved (server supplies those with the same date) — W-08. */
  savedBills?: SavedBillRef[];
  limits?: Partial<ComplianceLimits>;
}

/** W-08: first saved bill with same date, customer name & phone and total. */
export function findDuplicate(input: InvoiceInput, totals: InvoiceTotals, saved: SavedBillRef[]): SavedBillRef | null {
  const name = norm(input.customer.name);
  const phone = (input.customer.phone ?? "").trim();
  const gt = toSignedDec(totals.grandTotal);
  return (
    saved.find(
      (b) =>
        b.date === input.date &&
        norm(b.customerName) === name &&
        (b.customerPhone ?? "").trim() === phone &&
        toSignedDec(b.grandTotal).eq(gt),
    ) ?? null
  );
}

function findTodaysRate(line: LineInput, rates: RateRef[]): RateRef | undefined {
  if (line.purityId) {
    const byId = rates.find((r) => r.purityId && r.purityId === line.purityId);
    if (byId) return byId;
  }
  const label = norm(line.purityLabel);
  return label ? rates.find((r) => norm(r.label) === label) : undefined;
}

export function validateInvoice(
  input: InvoiceInput,
  ctx: InvoiceValidationContext,
  totals: InvoiceTotals = computeInvoice(input),
): ValidationResult {
  const L = { ...DEFAULT_LIMITS, ...ctx.limits };
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const err = (id: string, field: string, message: string, live = false) => errors.push({ id, field, message, live });
  const warn = (id: string, field: string, message: string) => warnings.push({ id, field, message });

  const c = input.customer;
  const phone = (c.phone ?? "").trim();
  const name = (c.name ?? "").trim();
  const gstin = (c.gstin ?? "").trim().toUpperCase();
  const pan = (c.pan ?? "").trim().toUpperCase();

  // ── Customer ──────────────────────────────────────────────────────────────
  if (phone !== "" && !/^\d{10}$/.test(phone)) err("E-01", "customer.phone", "Phone number must be exactly 10 digits.");
  if (gstin !== "" && !GSTIN_RE.test(gstin))
    err("E-02", "customer.gstin", "Customer GSTIN is not valid — it must be 15 characters, e.g. 27ABCDE1234F1Z5.");
  if (pan !== "" && !PAN_RE.test(pan))
    err("E-03", "customer.pan", "PAN is not valid — 5 letters, 4 numbers, 1 letter (e.g. ABCDE1234F).");

  // ── Date ──────────────────────────────────────────────────────────────────
  const dateOk = isValidIsoDate(input.date);
  if (!dateOk) err("E-04", "date", "Enter the invoice date.");
  else if (input.date > ctx.today) err("E-05", "date", "Invoice date cannot be in the future.", true);

  // ── Lines ─────────────────────────────────────────────────────────────────
  const anyUsed = totals.lines.some((l) => l.used);
  if (!anyUsed) err("E-06", "lines.0.description", "Add at least one item with its weight.");

  input.lines.forEach((li, i) => {
    const r = totals.lines[i];
    const n = i + 1;
    const f = (k: string) => `lines.${i}.${k}`;
    const gross = toDec(r.gross);
    const less = toDec(r.less);
    const hasWeight = gross.gt(0);
    const makingIn = toDec(li.makingValue);

    // Live rules fire whenever the offending value is present.
    if (less.gt(gross)) err("E-08", f("less"), `Item ${n}: less (stone) weight cannot be more than gross weight.`, true);
    if (!isBlank(li.pcs) && !toDec(li.pcs).isInteger()) err("E-09", f("pcs"), `Item ${n}: pieces must be a whole number.`, true);
    if (toDec(li.wastagePct).gt(100)) err("E-11", f("wastagePct"), `Item ${n}: wastage cannot be more than 100%.`, true);
    if (li.makingType === "pct" && makingIn.gt(100))
      err("E-12", f("makingValue"), `Item ${n}: making charge cannot be more than 100%.`, true);

    if (!r.used) return;

    const stoneOnly = toDec(r.stone).gt(0);
    const flatOnly = li.makingType === "flat" && makingIn.gt(0);
    if (!hasWeight && !stoneOnly && !flatOnly)
      err("E-07", f("gross"), `Item ${n}: enter the gross weight.`);
    if (hasWeight && (isBlank(li.pcs) || toDec(li.pcs).lt(1)))
      err("E-10", f("pcs"), `Item ${n}: pieces must be at least 1.`);
    if (hasWeight && toDec(r.rate).lte(0)) err("E-13", f("rate"), `Item ${n}: enter the rate per gram.`);

    // W-06 rate deviation from today's master
    if (hasWeight && ctx.todaysRates?.length && toDec(r.rate).gt(0)) {
      const today = findTodaysRate(li, ctx.todaysRates);
      const tr = today ? toDec(today.rate) : new D(0);
      if (today && tr.gt(0)) {
        const dev = toDec(r.rate).minus(tr).abs().div(tr).times(100);
        if (dev.gt(toDec(L.rateDeviationPct)))
          warn(
            "W-06",
            f("rate"),
            `Item ${n}: rate ${formatINR(r.rate)}/g is more than ${formatPct(L.rateDeviationPct)}% away from today's ${today.label} rate (${formatINR(tr)}/g).`,
          );
      }
    }
    // W-07 unusually heavy
    const heavy = li.metal === "Gold" ? toDec(L.heavyGoldG) : toDec(L.heavyOtherG);
    if (gross.gt(heavy)) warn("W-07", f("gross"), `Item ${n}: ${formatWeight(gross)} looks unusually heavy — please check the weight.`);
  });

  // ── Exchange ──────────────────────────────────────────────────────────────
  input.exchange.forEach((x, i) => {
    const n = i + 1;
    const f = (k: string) => `exchange.${i}.${k}`;
    const touch = toDec(x.touchPct);
    if (touch.gt(100)) err("E-14", f("touchPct"), `Exchange item ${n}: touch cannot be more than 100%.`, true);
    if (!isExchangeUsed(x)) return;
    if (touch.lte(0)) err("E-15", f("touchPct"), `Exchange item ${n}: enter the touch %.`);
    if (toDec(x.fineRate).lte(0)) err("E-16", f("fineRate"), `Exchange item ${n}: enter the fine rate.`);
  });

  // ── Summary / payment ─────────────────────────────────────────────────────
  if (toDec(totals.discountEntered).gt(toDec(totals.itemsTotal)))
    err("E-17", "discount", "Discount cannot be more than the items total.", true);

  const balance = toSignedDec(totals.balance);
  if (balance.gt(0) && (name === "" || phone === ""))
    err(
      "E-18",
      name === "" ? "customer.name" : "customer.phone",
      "Some amount is still due — enter the customer's name and phone so you know who owes it.",
    );

  const received = toSignedDec(totals.received);
  const grand = toSignedDec(totals.grandTotal);
  if (input.payMode === "Cash" && received.gte(toDec(L.cashLimit)))
    err(
      "E-19",
      "payMode",
      'Cash of ₹2 lakh or more cannot be accepted against one bill under income-tax law. Take part of it by UPI / card / bank and set payment mode to "Mixed".',
      true,
    );

  // D-02: PAN on ₹2 lakh+ bills — block (E-20) or warn (W-01) per policy
  const panMissing = grand.gte(toDec(L.panLimit)) && pan === "" && !c.panDeclaration;
  if (panMissing && L.panMissingPolicy === "block")
    err(
      "E-20",
      "customer.pan",
      'This bill is ₹2 lakh or more: enter the customer\'s PAN, or tick "No-PAN declaration (Form 60) received".',
    );

  // ── Warnings ──────────────────────────────────────────────────────────────
  if (panMissing && L.panMissingPolicy === "warn")
    warn(
      "W-01",
      "customer.pan",
      "This bill is ₹2 lakh or more: the customer's PAN (or the no-PAN declaration form) must be collected. Enter the PAN if you have it.",
    );
  if (input.payMode === "Mixed" && received.gte(toDec(L.cashLimit)))
    warn("W-02", "payMode", "Make sure the cash part of this payment is below ₹2 lakh.");
  const payout = Decimal.max(0, toSignedDec(totals.paid).neg());
  if (grand.lt(0) && input.payMode === "Cash" && payout.gt(toDec(L.cashPayoutLimit)))
    warn(
      "W-03",
      "payMode",
      "Paying the customer more than ₹10,000 in cash (for old gold) is not allowed as a business expense — pay by bank / UPI.",
    );
  if (GSTIN_RE.test(gstin) && PAN_RE.test(pan) && gstin.slice(2, 12) !== pan)
    warn("W-04", "customer.pan", "The PAN does not match the PAN inside the customer's GSTIN.");
  if (ctx.isNew && dateOk && daysBetween(input.date, ctx.today) > L.oldBillDays)
    warn("W-05", "date", `The invoice date (${formatDateDMY(input.date)}) is more than ${L.oldBillDays} days old.`);
  if (ctx.isNew && ctx.savedBills?.length) {
    const dup = findDuplicate(input, totals, ctx.savedBills);
    if (dup)
      warn("W-08", "customer.name", `A bill for the same customer and amount was already saved today (${dup.number}). Is this a duplicate?`);
  }

  return { errors, warnings };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* §5.1 Shop settings + §8.4 validation (S-01..S-10)                          */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ShopSettings {
  name: string;
  phone: string;
  email: string;
  gstin: string;
  state: string;
  stateCode: string;
  address: string;
  gstRate: string;
  gstDefault: boolean;
  prefixGst: string;
  prefixNoGst: string;
  noGstTitle: string;
  hsnGold: string;
  hsnSilver: string;
  fyNumbering: boolean;
  terms: string;
  bankDetails: string;
  signatoryLabel: string;
  staffCanSeeDashboard: boolean;
}

export const DEFAULT_SETTINGS: ShopSettings = {
  name: "",
  phone: "",
  email: "",
  gstin: "",
  state: "",
  stateCode: "",
  address: "",
  gstRate: "3",
  gstDefault: true,
  prefixGst: "INV",
  prefixNoGst: "BILL",
  noGstTitle: "INVOICE",
  hsnGold: "7113",
  hsnSilver: "7113",
  fyNumbering: true,
  terms: "Goods once sold will not be taken back.\nSubject to local jurisdiction.",
  bankDetails: "",
  signatoryLabel: "Authorised Signatory",
  staffCanSeeDashboard: false,
};

/** SET-13: default HSN for a metal. */
export function defaultHsnFor(metal: Metal, s: Pick<ShopSettings, "hsnGold" | "hsnSilver">): string {
  return metal === "Silver" ? s.hsnSilver : s.hsnGold;
}

export function validateSettings(s: ShopSettings, limits: Partial<ComplianceLimits> = {}): ValidationResult {
  const L = { ...DEFAULT_LIMITS, ...limits };
  const errors: Issue[] = [];
  const err = (id: string, field: string, message: string) => errors.push({ id, field, message });

  const gstin = (s.gstin ?? "").trim().toUpperCase();
  const code = (s.stateCode ?? "").trim();
  const phone = (s.phone ?? "").trim();
  const email = (s.email ?? "").trim();

  if ((s.name ?? "").trim() === "") err("S-01", "name", "Enter the shop name.");
  if (phone !== "" && !/^\d{10}$/.test(phone)) err("S-02", "phone", "Shop phone must be exactly 10 digits.");
  if (email !== "" && !EMAIL_RE.test(email)) err("S-03", "email", "Email address is not valid.");
  if (gstin !== "" && !GSTIN_RE.test(gstin))
    err("S-04", "gstin", "Shop GSTIN is not valid — it must be 15 characters, e.g. 27ABCDE1234F1Z5.");
  if (code !== "") {
    const n = /^\d{2}$/.test(code) ? +code : NaN;
    if (!(n >= 1 && n <= 38)) err("S-05", "stateCode", "State code must be 2 digits between 01 and 38.");
    else if (GSTIN_RE.test(gstin) && gstin.slice(0, 2) !== code)
      err("S-06", "stateCode", `State code should be ${gstin.slice(0, 2)} — the first 2 digits of your GSTIN.`);
  }
  const gst = String(s.gstRate ?? "").trim();
  if (gst === "" || !NUM_RE.test(gst) || new D(gst).lt(0) || new D(gst).gt(28))
    err("S-07", "gstRate", "GST % must be between 0 and 28.");

  const maxP = maxPrefixLength(s.fyNumbering, L.maxInvoiceNoLength);
  for (const key of ["prefixGst", "prefixNoGst"] as const) {
    const p = (s[key] ?? "").trim();
    if (!PREFIX_RE.test(p)) err("S-08", key, 'Invoice prefix: use only letters, numbers or "-" (max 10).');
    else if (p.length > maxP)
      err(
        "S-09",
        key,
        `Invoice numbers can be at most ${L.maxInvoiceNoLength} characters under GST rules — shorten this prefix to ${maxP} characters or less.`,
      );
  }
  for (const key of ["hsnGold", "hsnSilver"] as const) {
    if (!HSN_RE.test((s[key] ?? "").trim())) err("S-10", key, "HSN code must be 4 to 8 digits.");
  }
  return { errors, warnings: [] };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* §5.2 Rate master                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

export interface PurityRateRow {
  id?: string | null;
  metal: Metal;
  label: string;
  purityPct: NumLike;
  rate: NumLike;
}

/** RATE-01: default rows; rates start blank. */
export const DEFAULT_PURITIES: PurityRateRow[] = [
  { metal: "Gold", label: "Gold 24K (999)", purityPct: "99.9", rate: "" },
  { metal: "Gold", label: "Gold 22K (916)", purityPct: "91.6", rate: "" },
  { metal: "Gold", label: "Gold 18K (750)", purityPct: "75", rate: "" },
  { metal: "Silver", label: "Silver 999", purityPct: "99.9", rate: "" },
  { metal: "Silver", label: "Silver 925", purityPct: "92.5", rate: "" },
];

const hasRate = (r: PurityRateRow) => !isBlank(r.rate) && toDec(r.rate).gt(0);
const isBlankRow = (r: PurityRateRow) => (r.label ?? "").trim() === "" && isBlank(r.rate) && isBlank(r.purityPct);

/** RATE-05 base: highest-purity row of that metal that has a rate. */
export function fineRateRow(metal: Metal, rows: PurityRateRow[]): PurityRateRow | null {
  let best: PurityRateRow | null = null;
  for (const r of rows) {
    if (r.metal !== metal || !hasRate(r) || toDec(r.purityPct).lte(0)) continue;
    if (!best || toDec(r.purityPct).gt(toDec(best.purityPct))) best = r;
  }
  return best;
}

/** INV-12: default exchange fine rate = the metal's RATE-05 base rate. */
export function fineRateFor(metal: Metal, rows: PurityRateRow[]): Money {
  const b = fineRateRow(metal, rows);
  return b ? fix2(toDec(b.rate)) : "";
}

/** RATE-05: every other row of a metal = base × purity% ÷ base purity%, 2 dp. */
export function autoFillFromFineRate(rows: PurityRateRow[]): PurityRateRow[] {
  const bases = new Map<Metal, PurityRateRow>();
  for (const m of METALS) {
    const b = fineRateRow(m, rows);
    if (b) bases.set(m, b);
  }
  return rows.map((r) => {
    const b = bases.get(r.metal);
    if (!b || r === b || toDec(r.purityPct).lte(0)) return r;
    const rate = round2(toDec(b.rate).times(toDec(r.purityPct)).div(toDec(b.purityPct)));
    return { ...r, rate: rate.toFixed(2) };
  });
}

/** RATE-03: gold & others per 10 g, silver per kg. */
export function rateEquivalent(metal: Metal, rate: NumLike): { amount: Money; unit: "10 g" | "kg" } | null {
  if (isBlank(rate) || toDec(rate).lte(0)) return null;
  return metal === "Silver"
    ? { amount: fix2(toDec(rate).times(1000)), unit: "kg" }
    : { amount: fix2(toDec(rate).times(10)), unit: "10 g" };
}

export function validateRates(rows: PurityRateRow[]): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const seen = new Map<string, number>();

  rows.forEach((r, i) => {
    if (isBlankRow(r)) return;
    const label = (r.label ?? "").trim();
    const f = (k: string) => `rates.${i}.${k}`;
    if (label === "") {
      if (hasRate(r)) errors.push({ id: "R-01", field: f("label"), message: `Row ${i + 1}: enter a purity name.` });
      return;
    }
    const key = label.toLowerCase();
    if (seen.has(key)) errors.push({ id: "R-02", field: f("label"), message: `"${label}" is listed twice.` });
    else seen.set(key, i);
    const pct = toDec(r.purityPct);
    const pctRaw = String(r.purityPct ?? "").trim();
    if (pctRaw === "" || pctRaw.startsWith("-") || pct.lte(0) || pct.gt(100))
      errors.push({ id: "R-03", field: f("purityPct"), message: `${label}: purity % must be more than 0 and at most 100.` });
    if (!hasRate(r)) warnings.push({ id: "R-04", field: f("rate"), message: `${label} has no rate.` });
  });

  // R-05: lower purity priced above a higher purity of the same metal
  rows.forEach((lo, i) => {
    if (!hasRate(lo) || (lo.label ?? "").trim() === "") return;
    for (const hi of rows) {
      if (hi === lo || hi.metal !== lo.metal || !hasRate(hi) || (hi.label ?? "").trim() === "") continue;
      if (toDec(lo.purityPct).lt(toDec(hi.purityPct)) && toDec(lo.rate).gt(toDec(hi.rate)))
        warnings.push({
          id: "R-05",
          field: `rates.${i}.rate`,
          message: `${lo.label.trim()} rate is higher than ${hi.label.trim()} — please check.`,
        });
    }
  });
  return { errors, warnings };
}

/**
 * RATE-09 / INV-10: lines not manually re-priced follow the rate master;
 * lines whose rate was typed keep it.
 */
export function applyRateMaster<T extends LineInput>(lines: T[], rows: PurityRateRow[]): T[] {
  return lines.map((l) => {
    if (l.rateManual) return l;
    const row =
      rows.find((r) => l.purityId && r.id === l.purityId) ??
      rows.find((r) => norm(r.label) !== "" && norm(r.label) === norm(l.purityLabel));
    if (!row) return l;
    const rate = hasRate(row) ? fix2(toDec(row.rate)) : "";
    return rate === l.rate ? l : { ...l, rate };
  });
}

/** INV-09: new line copies purity, rate, HSN and making type/value. */
export function newLineFrom(prev: LineInput | undefined, fallback: Partial<LineInput> = {}): LineInput {
  const base: LineInput = {
    description: "",
    metal: "Gold",
    purityId: null,
    purityLabel: "",
    hsn: "",
    pcs: "1",
    gross: "",
    less: "",
    wastagePct: "",
    rate: "",
    rateManual: false,
    makingType: "per_g",
    makingValue: "",
    stone: "",
    ...fallback,
  };
  if (!prev) return base;
  return {
    ...base,
    metal: prev.metal,
    purityId: prev.purityId ?? null,
    purityLabel: prev.purityLabel ?? "",
    hsn: prev.hsn ?? "",
    rate: prev.rate ?? "",
    rateManual: !!prev.rateManual,
    makingType: prev.makingType,
    makingValue: prev.makingValue ?? "",
  };
}
