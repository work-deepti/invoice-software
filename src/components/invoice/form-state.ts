import {
  defaultHsnFor,
  type ExchangeInput,
  type InvoiceInput,
  type LineInput,
  type MakingType,
  type Metal,
  type PayMode,
} from "@/lib/calc-engine";
import type { RatesDTO } from "@/server/rates";
import type { SettingsDTO } from "@/server/settings";
import type { SavedInvoice } from "./types";

export interface LineForm {
  key: string;
  description: string;
  purityId: string | null;
  metal: Metal;
  purityLabel: string;
  hsn: string;
  pcs: string;
  gross: string;
  less: string;
  wastagePct: string;
  rate: string;
  rateManual: boolean;
  makingType: MakingType;
  makingValue: string;
  stone: string;
}

export interface ExchangeForm {
  key: string;
  description: string;
  metal: Metal;
  weight: string;
  touchPct: string;
  fineRate: string;
  fineRateManual: boolean;
}

export interface CustomerForm {
  phone: string;
  name: string;
  gstin: string;
  pan: string;
  state: string;
  address: string;
  panDeclaration: boolean;
}

export interface FormState {
  date: string;
  payMode: PayMode;
  gstOn: boolean;
  interState: boolean;
  /** The user ticked/unticked IGST by hand — auto-detect stops overriding it (GST-02). */
  interStateManual: boolean;
  customer: CustomerForm;
  lines: LineForm[];
  exchange: ExchangeForm[];
  discount: string;
  /** Blank = "Full" (INV-15, INV-21). */
  received: string;
  notes: string;
}

let seq = 0;
export const newKey = () => `k${Date.now().toString(36)}${(++seq).toString(36)}`;

const stripZeros = (v: string) => (v.includes(".") ? v.replace(/\.?0+$/, "") : v);

/** The purity a brand-new bill starts with: 22K if the shop has it, else the first gold row, else the first row. */
function defaultPurity(rates: RatesDTO) {
  return (
    rates.rows.find((r) => /22\s*k/i.test(r.label)) ??
    rates.rows.find((r) => r.metal === "Gold") ??
    rates.rows[0] ??
    null
  );
}

export function blankLine(rates: RatesDTO, settings: SettingsDTO, prev?: LineForm): LineForm {
  if (prev) {
    // INV-09: copy purity, rate, HSN and making type/value
    return {
      key: newKey(),
      description: "",
      purityId: prev.purityId,
      metal: prev.metal,
      purityLabel: prev.purityLabel,
      hsn: prev.hsn,
      pcs: "1",
      gross: "",
      less: "",
      wastagePct: "",
      rate: prev.rate,
      rateManual: prev.rateManual,
      makingType: prev.makingType,
      makingValue: prev.makingValue,
      stone: "",
    };
  }
  const p = defaultPurity(rates);
  const metal: Metal = p?.metal ?? "Gold";
  return {
    key: newKey(),
    description: "",
    purityId: p?.id ?? null,
    metal,
    purityLabel: p?.label ?? "",
    hsn: defaultHsnFor(metal, settings),
    pcs: "1",
    gross: "",
    less: "",
    wastagePct: "",
    rate: p?.rate ?? "",
    rateManual: false,
    makingType: "per_g",
    makingValue: "",
    stone: "",
  };
}

export function blankExchange(rates: RatesDTO, metal: Metal = "Gold"): ExchangeForm {
  return {
    key: newKey(),
    description: metal === "Silver" ? "Old silver" : "Old gold",
    metal,
    weight: "",
    touchPct: "",
    fineRate: rates.fineRates[metal] ?? "",
    fineRateManual: false,
  };
}

export function blankForm(rates: RatesDTO, settings: SettingsDTO, today: string): FormState {
  return {
    date: today,
    payMode: "Cash",
    gstOn: settings.gstDefault,
    interState: false,
    interStateManual: false,
    customer: { phone: "", name: "", gstin: "", pan: "", state: "", address: "", panDeclaration: false },
    lines: [blankLine(rates, settings)],
    exchange: [],
    discount: "",
    received: "",
    notes: "",
  };
}

/** INV-19/21: load a saved bill exactly as it was typed. */
export function formFromSaved(inv: SavedInvoice): FormState {
  return {
    date: inv.invoiceDate,
    payMode: inv.payMode,
    gstOn: inv.gstOn,
    interState: inv.interState,
    interStateManual: true,
    customer: {
      phone: inv.customerPhone,
      name: inv.customerName,
      gstin: inv.customerGstin,
      pan: inv.customerPan,
      state: inv.customerState,
      address: inv.customerAddress,
      panDeclaration: inv.panDeclaration,
    },
    lines: inv.lines.map((l) => ({
      key: newKey(),
      description: l.description,
      purityId: l.purityId,
      metal: l.metal,
      purityLabel: l.purityLabel,
      hsn: l.hsn,
      pcs: l.pcs ? String(l.pcs) : "",
      gross: l.grossG === "0.000" ? "" : l.grossG,
      less: l.lessG === "0.000" ? "" : l.lessG,
      wastagePct: l.wastagePct === "0.00" ? "" : stripZeros(l.wastagePct),
      rate: l.ratePerG === "0.00" ? "" : l.ratePerG,
      rateManual: l.rateManual,
      makingType: l.makingType,
      makingValue: l.makingInput === "0.00" ? "" : l.makingInput,
      stone: l.stoneAmt === "0.00" ? "" : l.stoneAmt,
    })),
    exchange: inv.exchange.map((x) => ({
      key: newKey(),
      description: x.description,
      metal: x.metal,
      weight: x.weightG,
      touchPct: stripZeros(x.touchPct),
      fineRate: x.fineRate,
      fineRateManual: true,
    })),
    discount: inv.discountInput === "0.00" ? "" : inv.discountInput,
    // INV-21: a fully paid bill stays "Full"; a part payment loads the exact amount
    received: inv.receivedFull ? "" : inv.received,
    notes: inv.notes,
  };
}

export function toEngineInput(f: FormState, gstRate: string): InvoiceInput {
  return {
    date: f.date,
    payMode: f.payMode,
    gstOn: f.gstOn,
    interState: f.gstOn && f.interState,
    gstRate,
    customer: { ...f.customer },
    lines: f.lines.map(({ key: _k, ...l }): LineInput => {
      void _k;
      return l;
    }),
    exchange: f.exchange.map(({ key: _k, fineRateManual: _m, ...x }): ExchangeInput => {
      void _k;
      void _m;
      return x;
    }),
    discount: f.discount,
    received: f.received,
    notes: f.notes,
  };
}

/** Request body for POST /api/invoices and PUT /api/invoices/{id}. */
export function toBody(f: FormState, acceptWarnings = false) {
  return {
    date: f.date,
    payMode: f.payMode,
    gstOn: f.gstOn,
    interState: f.gstOn && f.interState,
    customer: f.customer,
    lines: f.lines.map((l) => ({
      description: l.description,
      purityId: l.purityId,
      metal: l.metal,
      purityLabel: l.purityLabel,
      hsn: l.hsn,
      pcs: l.pcs,
      gross: l.gross,
      less: l.less,
      wastagePct: l.wastagePct,
      rate: l.rate,
      rateManual: l.rateManual,
      makingType: l.makingType,
      makingValue: l.makingValue,
      stone: l.stone,
    })),
    exchange: f.exchange.map((x) => ({
      description: x.description,
      metal: x.metal,
      weight: x.weight,
      touchPct: x.touchPct,
      fineRate: x.fineRate,
    })),
    discount: f.discount,
    received: f.received,
    notes: f.notes,
    acceptWarnings,
  };
}

/** Indian states & UTs with GST state codes (for the State suggestions). */
export const STATES: [string, string][] = [
  ["Jammu and Kashmir", "01"], ["Himachal Pradesh", "02"], ["Punjab", "03"], ["Chandigarh", "04"], ["Uttarakhand", "05"],
  ["Haryana", "06"], ["Delhi", "07"], ["Rajasthan", "08"], ["Uttar Pradesh", "09"], ["Bihar", "10"], ["Sikkim", "11"],
  ["Arunachal Pradesh", "12"], ["Nagaland", "13"], ["Manipur", "14"], ["Mizoram", "15"], ["Tripura", "16"],
  ["Meghalaya", "17"], ["Assam", "18"], ["West Bengal", "19"], ["Jharkhand", "20"], ["Odisha", "21"],
  ["Chhattisgarh", "22"], ["Madhya Pradesh", "23"], ["Gujarat", "24"], ["Dadra and Nagar Haveli and Daman and Diu", "26"],
  ["Maharashtra", "27"], ["Karnataka", "29"], ["Goa", "30"], ["Lakshadweep", "31"], ["Kerala", "32"], ["Tamil Nadu", "33"],
  ["Puducherry", "34"], ["Andaman and Nicobar Islands", "35"], ["Telangana", "36"], ["Andhra Pradesh", "37"], ["Ladakh", "38"],
];
