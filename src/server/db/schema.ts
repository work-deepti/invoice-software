/**
 * Database schema — PRD §12.1.
 *
 * Money NUMERIC(14,2), weights NUMERIC(12,3), percentages NUMERIC(6,2).
 * node-postgres returns NUMERIC as strings, which feed decimal.js directly,
 * so no value ever passes through a JS float.
 *
 * Every table carries created_at / updated_at / created_by / updated_by.
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ── column helpers ─────────────────────────────────────────────────────── */

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const grams = (name: string) => numeric(name, { precision: 12, scale: 3 });
const pct = (name: string) => numeric(name, { precision: 6, scale: 2 });

const auditColumns = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});

/* ── enums ──────────────────────────────────────────────────────────────── */

export const roleEnum = pgEnum("user_role", ["owner", "staff", "viewer"]);
export const metalEnum = pgEnum("metal", ["Gold", "Silver", "Platinum", "Other"]);
export const makingTypeEnum = pgEnum("making_type", ["per_g", "pct", "flat"]);
export const payModeEnum = pgEnum("pay_mode", ["Cash", "UPI", "Card", "Bank transfer", "Cheque", "Mixed", "Credit"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["active", "cancelled"]);
export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "cancel",
  "restore",
  "settings",
  "rates",
  "users",
]);

/* ── users ──────────────────────────────────────────────────────────────── */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  login: text("login").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  active: boolean("active").notNull().default(true),
  /** Bumped on password change / deactivation to invalidate sessions. */
  sessionVersion: integer("session_version").notNull().default(1),
  ...auditColumns(),
});

/* ── shop_settings (single row) ─────────────────────────────────────────── */

export const shopSettings = pgTable(
  "shop_settings",
  {
    id: smallint("id").primaryKey().default(1),
    name: text("name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    gstin: text("gstin").notNull().default(""),
    state: text("state").notNull().default(""),
    stateCode: text("state_code").notNull().default(""),
    address: text("address").notNull().default(""),
    gstRate: pct("gst_rate").notNull().default("3"),
    gstDefault: boolean("gst_default").notNull().default(true),
    prefixGst: text("prefix_gst").notNull().default("INV"),
    prefixNoGst: text("prefix_nogst").notNull().default("BILL"),
    noGstTitle: text("nogst_title").notNull().default("INVOICE"),
    hsnGold: text("hsn_gold").notNull().default("7113"),
    hsnSilver: text("hsn_silver").notNull().default("7113"),
    fyNumbering: boolean("fy_numbering").notNull().default(true),
    terms: text("terms").notNull().default("Goods once sold will not be taken back.\nSubject to local jurisdiction."),
    bankDetails: text("bank_details").notNull().default(""),
    signatoryLabel: text("signatory_label").notNull().default("Authorised Signatory"),
    staffCanSeeDashboard: boolean("staff_can_see_dashboard").notNull().default(false),
    // §13 compliance limits — configuration, reviewed yearly with the CA
    cashLimit: money("cash_limit").notNull().default("200000"),
    panLimit: money("pan_limit").notNull().default("200000"),
    cashPayoutLimit: money("cash_payout_limit").notNull().default("10000"),
    panMissingPolicy: text("pan_missing_policy").notNull().default("block"),
    ...auditColumns(),
  },
  (t) => [check("shop_settings_singleton", sql`${t.id} = 1`)],
);

/* ── purities & rates ───────────────────────────────────────────────────── */

export const purities = pgTable(
  "purities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    metal: metalEnum("metal").notNull(),
    label: text("label").notNull(),
    purityPct: pct("purity_pct").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...auditColumns(),
  },
  (t) => [
    // R-02: names unique case-insensitively among active rows
    uniqueIndex("purities_label_active_uq").on(sql`lower(${t.label})`).where(sql`${t.active}`),
  ],
);

export const ratesCurrent = pgTable("rates_current", {
  purityId: uuid("purity_id")
    .primaryKey()
    .references(() => purities.id, { onDelete: "cascade" }),
  ratePerG: money("rate_per_g"),
  effectiveDate: date("effective_date", { mode: "string" }).notNull(),
  ...auditColumns(),
});

export const rateHistory = pgTable(
  "rate_history",
  {
    date: date("date", { mode: "string" }).notNull(),
    purityId: uuid("purity_id").notNull(),
    label: text("label").notNull(),
    metal: metalEnum("metal").notNull(),
    purityPct: pct("purity_pct").notNull(),
    ratePerG: money("rate_per_g"),
    ...auditColumns(),
  },
  (t) => [primaryKey({ columns: [t.date, t.purityId] })],
);

/* ── customers ──────────────────────────────────────────────────────────── */

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").unique(),
  name: text("name").notNull().default(""),
  address: text("address").notNull().default(""),
  gstin: text("gstin").notNull().default(""),
  pan: text("pan").notNull().default(""),
  state: text("state").notNull().default(""),
  firstInvoiceAt: date("first_invoice_at", { mode: "string" }),
  lastInvoiceAt: date("last_invoice_at", { mode: "string" }),
  ...auditColumns(),
});

/* ── numbering ──────────────────────────────────────────────────────────── */

export const invoiceSeries = pgTable("invoice_series", {
  /** e.g. "INV|2026-27" (FY reset on) or "INV" (off). */
  seriesKey: text("series_key").primaryKey(),
  prefix: text("prefix").notNull(),
  fy: text("fy"),
  /** Highest number ever issued — never decremented (NUM-05). */
  lastSeq: integer("last_seq").notNull().default(0),
  ...auditColumns(),
});

/* ── invoices ───────────────────────────────────────────────────────────── */

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull(),
    seriesKey: text("series_key").notNull(),
    seq: integer("seq").notNull(),
    fy: text("fy"),
    invoiceDate: date("invoice_date", { mode: "string" }).notNull(),
    gstOn: boolean("gst_on").notNull(),
    interState: boolean("inter_state").notNull(),
    gstRate: pct("gst_rate").notNull(),
    // customer + snapshot
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull().default(""),
    customerPhone: text("customer_phone").notNull().default(""),
    customerAddress: text("customer_address").notNull().default(""),
    customerGstin: text("customer_gstin").notNull().default(""),
    customerPan: text("customer_pan").notNull().default(""),
    customerState: text("customer_state").notNull().default(""),
    panDeclaration: boolean("pan_declaration").notNull().default(false),
    placeOfSupply: text("place_of_supply").notNull().default(""),
    placeCode: text("place_code"),
    payMode: payModeEnum("pay_mode").notNull(),
    /** Free text beside the payment mode, e.g. "HDFC Bank", "SBI cheque 004512", a UPI reference. */
    payDetails: text("pay_details").notNull().default(""),
    // inputs + computed totals (DATA-01)
    discountInput: money("discount_input").notNull().default("0"),
    discount: money("discount").notNull(),
    itemsTotal: money("items_total").notNull(),
    taxable: money("taxable").notNull(),
    cgst: money("cgst").notNull(),
    sgst: money("sgst").notNull(),
    igst: money("igst").notNull(),
    exchangeTotal: money("exchange_total").notNull(),
    roundOff: money("round_off").notNull(),
    grandTotal: money("grand_total").notNull(),
    /** INV-21: true when "Amount received" was left blank (= Full). */
    receivedFull: boolean("received_full").notNull(),
    received: money("received").notNull(),
    paid: money("paid").notNull(),
    changeReturned: money("change_returned").notNull(),
    balance: money("balance").notNull(),
    goldNetG: grams("gold_net_g").notNull(),
    silverNetG: grams("silver_net_g").notNull(),
    notes: text("notes").notNull().default(""),
    shopSnapshot: jsonb("shop_snapshot").notNull(),
    // D-01 cancel instead of delete
    status: invoiceStatusEnum("status").notNull().default("active"),
    cancelledReason: text("cancelled_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by"),
    /** Lower-cased number, customer, GSTIN, PAN, notes and item descriptions (TXN-01). */
    searchText: text("search_text").notNull().default(""),
    ...auditColumns(),
  },
  (t) => [
    uniqueIndex("invoices_number_uq").on(t.number),
    uniqueIndex("invoices_series_seq_uq").on(t.seriesKey, t.seq),
    index("invoices_date_idx").on(t.invoiceDate, t.createdAt),
    index("invoices_phone_idx").on(t.customerPhone),
    index("invoices_status_idx").on(t.status),
    // DATA-03 full-text: trigram index serves substring search on number / phone / names
    index("invoices_search_trgm_idx").using("gin", sql`${t.searchText} gin_trgm_ops`),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    description: text("description").notNull().default(""),
    purityId: uuid("purity_id").references(() => purities.id, { onDelete: "set null" }),
    metal: metalEnum("metal").notNull(),
    purityLabel: text("purity_label").notNull().default(""),
    hsn: text("hsn").notNull().default(""),
    pcs: integer("pcs").notNull().default(0),
    grossG: grams("gross_g").notNull(),
    lessG: grams("less_g").notNull(),
    netG: grams("net_g").notNull(),
    wastagePct: pct("wastage_pct").notNull(),
    chargeableG: grams("chargeable_g").notNull(),
    ratePerG: money("rate_per_g").notNull(),
    rateManual: boolean("rate_manual").notNull().default(false),
    makingType: makingTypeEnum("making_type").notNull(),
    makingInput: money("making_input").notNull(),
    makingAmt: money("making_amt").notNull(),
    stoneAmt: money("stone_amt").notNull(),
    metalValue: money("metal_value").notNull(),
    amount: money("amount").notNull(),
    ...auditColumns(),
  },
  (t) => [index("invoice_lines_invoice_idx").on(t.invoiceId), index("invoice_lines_purity_idx").on(t.purityLabel)],
);

export const invoiceExchange = pgTable(
  "invoice_exchange",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    rowNo: integer("row_no").notNull(),
    description: text("description").notNull().default(""),
    metal: metalEnum("metal").notNull(),
    weightG: grams("weight_g").notNull(),
    touchPct: pct("touch_pct").notNull(),
    fineG: grams("fine_g").notNull(),
    fineRate: money("fine_rate").notNull(),
    value: money("value").notNull(),
    ...auditColumns(),
  },
  (t) => [index("invoice_exchange_invoice_idx").on(t.invoiceId)],
);

/* ── audit_log ──────────────────────────────────────────────────────────── */

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id"),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    action: auditActionEnum("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    ...auditColumns(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entity, t.entityId), index("audit_log_at_idx").on(t.at)],
);

/* ── daily_summary (DSH-08) ─────────────────────────────────────────────── */

/**
 * Pre-aggregated per day, rebuilt for the affected date(s) inside the same
 * transaction as every invoice save / edit / cancel / delete.
 *
 * Grain: (date, metal, purity_key, gst_on, pay_mode).
 *  - metal = 'ALL', purity_key = ''   → invoice-level row (sales, tax, discount, exchange, paid)
 *  - metal = Gold…, purity_key = label → line-level row for that purity (grams, metal value, making, stone)
 *  - metal = Gold…, purity_key = '~exchange' → old metal taken in for that metal
 * Cancelled invoices are excluded.
 */
export const dailySummary = pgTable(
  "daily_summary",
  {
    date: date("date", { mode: "string" }).notNull(),
    metal: text("metal").notNull(),
    purityKey: text("purity_key").notNull(),
    gstOn: boolean("gst_on").notNull(),
    payMode: text("pay_mode").notNull(),
    invoices: integer("invoices").notNull().default(0),
    sales: money("sales").notNull().default("0"),
    taxable: money("taxable").notNull().default("0"),
    cgst: money("cgst").notNull().default("0"),
    sgst: money("sgst").notNull().default("0"),
    igst: money("igst").notNull().default("0"),
    netG: grams("net_g").notNull().default("0"),
    metalValue: money("metal_value").notNull().default("0"),
    making: money("making").notNull().default("0"),
    stone: money("stone").notNull().default("0"),
    discount: money("discount").notNull().default("0"),
    exchangeValue: money("exchange_value").notNull().default("0"),
    exchangeG: grams("exchange_g").notNull().default("0"),
    exchangeFineG: grams("exchange_fine_g").notNull().default("0"),
    paid: money("paid").notNull().default("0"),
    ...auditColumns(),
  },
  (t) => [primaryKey({ columns: [t.date, t.metal, t.purityKey, t.gstOn, t.payMode] })],
);

export type User = typeof users.$inferSelect;
export type Role = User["role"];
export type InvoiceRow = typeof invoices.$inferSelect;
export type InvoiceLineRow = typeof invoiceLines.$inferSelect;
export type InvoiceExchangeRow = typeof invoiceExchange.$inferSelect;
export type ShopSettingsRow = typeof shopSettings.$inferSelect;
