import "server-only";
import { and, asc, desc, eq, gt, gte, ilike, inArray, lte, ne, or, sql, type SQL } from "drizzle-orm";
import {
  computeInvoice,
  defaultHsnFor,
  financialYear,
  formatInvoiceNumber,
  isValidIsoDate,
  placeOfSupply,
  sanitizeGstin,
  sanitizePan,
  sanitizePhone,
  seriesKey as makeSeriesKey,
  seriesPrefixFor,
  todayIST,
  validateInvoice,
  type InvoiceInput,
  type InvoiceTotals,
  type Issue,
  type ValidationResult,
} from "@/lib/calc-engine";
import { writeAudit } from "./audit";
import type { SessionUser } from "./auth";
import { getDb, type Tx } from "./db";
import {
  customers,
  invoiceExchange,
  invoiceLines,
  invoiceSeries,
  invoices,
  purities,
  users,
  type InvoiceExchangeRow,
  type InvoiceLineRow,
  type InvoiceRow,
  type ShopSettingsRow,
} from "./db/schema";
import { conflict, forbidden, notFound, validationFailed, warningsNeedConfirmation } from "./http";
import { todaysRateRefs } from "./rates";
import { invoiceBodySchema, type InvoiceBody } from "./schemas";
import { limitsFrom, loadSettingsRow, toSettingsDTO } from "./settings";

/* ────────────────────────────────────────────────────────────────────────── */
/* Input normalisation                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Builds the engine input from a request body. API-01: totals from the client
 * are never read; only typed inputs are. GST-04: the GST rate comes from
 * settings (new bill) or the invoice itself (edit), never from the client.
 */
async function toEngineInput(tx: Tx, body: InvoiceBody, s: ShopSettingsRow, gstRate: string): Promise<InvoiceInput> {
  const ids = [...new Set(body.lines.map((l) => l.purityId).filter((x): x is string => !!x))];
  const pmap = new Map(
    ids.length ? (await tx.select().from(purities).where(inArray(purities.id, ids))).map((p) => [p.id, p]) : [],
  );
  return {
    date: body.date,
    payMode: body.payMode,
    payDetails: body.payDetails.trim(),
    gstOn: body.gstOn,
    interState: body.gstOn && body.interState,
    gstRate,
    customer: {
      phone: sanitizePhone(body.customer.phone),
      name: body.customer.name.trim(),
      gstin: sanitizeGstin(body.customer.gstin),
      pan: sanitizePan(body.customer.pan),
      state: body.customer.state.trim(),
      address: body.customer.address.trim(),
      panDeclaration: body.customer.panDeclaration,
    },
    lines: body.lines.map((l) => {
      const p = l.purityId ? pmap.get(l.purityId) : undefined;
      const metal = p?.metal ?? l.metal;
      return {
        ...l,
        description: l.description.trim(),
        purityId: p?.id ?? null,
        metal,
        purityLabel: p?.label ?? l.purityLabel.trim(),
        hsn: l.hsn.trim() || defaultHsnFor(metal, s),
      };
    }),
    exchange: body.exchange.map((x) => ({ ...x, description: x.description.trim() || `Old ${x.metal.toLowerCase()}` })),
    discount: body.discount,
    received: body.received,
    notes: body.notes,
  };
}

async function checkInput(
  tx: Tx,
  input: InvoiceInput,
  s: ShopSettingsRow,
  opts: { isNew: boolean; excludeId?: string },
): Promise<{ totals: InvoiceTotals } & ValidationResult> {
  const totals = computeInvoice(input);
  const savedBills =
    opts.isNew && isValidIsoDate(input.date)
      ? await tx
          .select({
            number: invoices.number,
            date: invoices.invoiceDate,
            customerName: invoices.customerName,
            customerPhone: invoices.customerPhone,
            grandTotal: invoices.grandTotal,
          })
          .from(invoices)
          .where(
            and(
              eq(invoices.invoiceDate, input.date),
              eq(invoices.status, "active"),
              opts.excludeId ? ne(invoices.id, opts.excludeId) : undefined,
            ),
          )
          .orderBy(asc(invoices.createdAt))
      : [];
  const v = validateInvoice(
    input,
    { today: todayIST(), isNew: opts.isNew, todaysRates: await todaysRateRefs(tx), savedBills, limits: limitsFrom(s) },
    totals,
  );
  return { totals, ...v };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Numbering (NUM-01..07)                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

const MAX_NUMBER_LENGTH = 16;

function seriesFor(s: ShopSettingsRow, gstOn: boolean, date: string) {
  const prefix = seriesPrefixFor(gstOn, s);
  return {
    prefix,
    key: makeSeriesKey(prefix, date, s.fyNumbering),
    fy: s.fyNumbering ? financialYear(date) : null,
  };
}

/** Preview only — the real number is allocated at save time. */
export async function peekNextNumber(tx: Tx, s: ShopSettingsRow, gstOn: boolean, date: string): Promise<string | null> {
  if (!isValidIsoDate(date)) return null;
  const { prefix, key } = seriesFor(s, gstOn, date);
  const [row] = await tx.select({ lastSeq: invoiceSeries.lastSeq }).from(invoiceSeries).where(eq(invoiceSeries.seriesKey, key));
  return formatInvoiceNumber(prefix, date, (row?.lastSeq ?? 0) + 1, s.fyNumbering);
}

/**
 * NUM-04: atomic allocation. The upsert takes a row lock on the series row,
 * so concurrent transactions queue behind each other and each gets the next
 * value. If the surrounding transaction rolls back, so does the increment —
 * no number is skipped (NFR-05) and none is reused (NUM-05).
 */
async function allocateNumber(tx: Tx, s: ShopSettingsRow, gstOn: boolean, date: string, userId: string) {
  const { prefix, key, fy } = seriesFor(s, gstOn, date);
  const res = await tx.execute<{ last_seq: number }>(sql`
    insert into invoice_series (series_key, prefix, fy, last_seq, created_by, updated_by)
    values (${key}, ${prefix}, ${fy}, 1, ${userId}, ${userId})
    on conflict (series_key) do update
      set last_seq = invoice_series.last_seq + 1, updated_at = now(), updated_by = excluded.updated_by
    returning last_seq`);
  const seq = Number(res.rows[0].last_seq);
  const number = formatInvoiceNumber(prefix, date, seq, s.fyNumbering);
  if (number.length > MAX_NUMBER_LENGTH)
    throw validationFailed([
      {
        id: "NUM-06",
        field: "number",
        message: `The next number ${number} would be longer than ${MAX_NUMBER_LENGTH} characters. Shorten the invoice prefix in Shop settings.`,
      },
    ]);
  return { number, seriesKey: key, seq, fy };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* daily_summary (DSH-08)                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Rebuilds the summary rows for one date from the invoices themselves.
 * The advisory lock serialises rebuilds of the same date, so two counters
 * saving at once can't race each other into a duplicate-key error.
 */
export async function rebuildDailySummary(tx: Tx, date: string): Promise<void> {
  // Logic lives in the database function gsb_rebuild_daily_summary (drizzle/0003), shared
  // with restore; it takes a per-date advisory lock so concurrent saves can't collide.
  await tx.execute(sql`select gsb_rebuild_daily_summary(${date}::date)`);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Persistence helpers                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

/** INV-08: one customers row per phone, holding the latest non-blank details. */
export async function upsertCustomer(tx: Tx, input: InvoiceInput, userId: string): Promise<string | null> {
  const c = input.customer;
  if (!c.phone || !/^\d{10}$/.test(c.phone)) return null;
  const res = await tx.execute<{ id: string }>(sql`
    insert into customers (phone, name, address, gstin, pan, state, first_invoice_at, last_invoice_at, created_by, updated_by)
    values (${c.phone}, ${c.name ?? ""}, ${c.address ?? ""}, ${c.gstin ?? ""}, ${c.pan ?? ""}, ${c.state ?? ""},
            ${input.date}::date, ${input.date}::date, ${userId}, ${userId})
    on conflict (phone) do update set
      name    = case when excluded.last_invoice_at >= coalesce(customers.last_invoice_at, excluded.last_invoice_at) and excluded.name    <> '' then excluded.name    else customers.name end,
      address = case when excluded.last_invoice_at >= coalesce(customers.last_invoice_at, excluded.last_invoice_at) and excluded.address <> '' then excluded.address else customers.address end,
      gstin   = case when excluded.last_invoice_at >= coalesce(customers.last_invoice_at, excluded.last_invoice_at) and excluded.gstin   <> '' then excluded.gstin   else customers.gstin end,
      pan     = case when excluded.last_invoice_at >= coalesce(customers.last_invoice_at, excluded.last_invoice_at) and excluded.pan     <> '' then excluded.pan     else customers.pan end,
      state   = case when excluded.last_invoice_at >= coalesce(customers.last_invoice_at, excluded.last_invoice_at) and excluded.state   <> '' then excluded.state   else customers.state end,
      first_invoice_at = least(customers.first_invoice_at, excluded.first_invoice_at),
      last_invoice_at  = greatest(customers.last_invoice_at, excluded.last_invoice_at),
      updated_at = now(), updated_by = excluded.updated_by
    returning id`);
  return res.rows[0]?.id ?? null;
}

export function searchTextFor(number: string, input: InvoiceInput): string {
  const c = input.customer;
  return [number, c.name, c.phone, c.gstin, c.pan, input.payDetails, input.notes, ...input.lines.map((l) => l.description)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** The invoice header columns derived from engine input + totals. */
function headerValues(input: InvoiceInput, t: InvoiceTotals, s: ShopSettingsRow) {
  const pos = placeOfSupply(input.customer, s);
  const c = input.customer;
  return {
    invoiceDate: input.date,
    gstOn: input.gstOn,
    interState: input.interState,
    gstRate: t.gstRate,
    customerName: c.name ?? "",
    customerPhone: c.phone ?? "",
    customerAddress: c.address ?? "",
    customerGstin: c.gstin ?? "",
    customerPan: c.pan ?? "",
    customerState: c.state ?? "",
    panDeclaration: !!c.panDeclaration,
    placeOfSupply: pos.label,
    placeCode: pos.code,
    payMode: input.payMode,
    payDetails: input.payDetails ?? "",
    discountInput: t.discountEntered,
    discount: t.discount,
    itemsTotal: t.itemsTotal,
    taxable: t.taxable,
    cgst: t.cgst,
    sgst: t.sgst,
    igst: t.igst,
    exchangeTotal: t.exchangeTotal,
    roundOff: t.roundOff,
    grandTotal: t.grandTotal,
    receivedFull: t.receivedIsFull,
    received: t.received,
    paid: t.paid,
    changeReturned: t.changeReturned,
    balance: t.balance,
    goldNetG: t.goldNetG,
    silverNetG: t.silverNetG,
    notes: input.notes ?? "",
  };
}

/** DATA-01: inputs and computed outputs are both stored. Blank rows are dropped. */
async function writeChildren(tx: Tx, invoiceId: string, input: InvoiceInput, t: InvoiceTotals, userId: string) {
  const lineRows = input.lines
    .map((l, i) => ({ l, r: t.lines[i] }))
    .filter(({ r }) => r.used)
    .map(({ l, r }, i) => ({
      invoiceId,
      lineNo: i + 1,
      description: l.description ?? "",
      purityId: l.purityId ?? null,
      metal: l.metal,
      purityLabel: l.purityLabel ?? "",
      hsn: l.hsn ?? "",
      pcs: Number.isInteger(r.pcs) ? r.pcs : 0,
      grossG: r.gross,
      lessG: r.less,
      netG: r.net,
      wastagePct: r.wastagePct,
      chargeableG: r.chargeable,
      ratePerG: r.rate,
      rateManual: !!l.rateManual,
      makingType: l.makingType,
      makingInput: r.makingInput,
      makingAmt: r.making,
      stoneAmt: r.stone,
      metalValue: r.metalValue,
      amount: r.amount,
      createdBy: userId,
      updatedBy: userId,
    }));
  if (lineRows.length) await tx.insert(invoiceLines).values(lineRows);

  const xRows = input.exchange
    .map((x, i) => ({ x, r: t.exchange[i] }))
    .filter(({ r }) => r.used)
    .map(({ x, r }, i) => ({
      invoiceId,
      rowNo: i + 1,
      description: x.description ?? "",
      metal: x.metal,
      weightG: r.weight,
      touchPct: r.touchPct,
      fineG: r.fine,
      fineRate: r.fineRate,
      value: r.value,
      createdBy: userId,
      updatedBy: userId,
    }));
  if (xRows.length) await tx.insert(invoiceExchange).values(xRows);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Read model                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export interface InvoiceDTO extends Omit<InvoiceRow, "searchText"> {
  lines: InvoiceLineRow[];
  exchange: InvoiceExchangeRow[];
  createdByName: string | null;
  updatedByName: string | null;
  permissions: { canEdit: boolean; canCancel: boolean; canDelete: boolean };
}

/** D-03 (owner decision): staff may edit only invoices created today. */
function canEdit(user: SessionUser, inv: Pick<InvoiceRow, "status" | "createdAt">): boolean {
  if (inv.status !== "active") return false;
  if (user.role === "owner") return true;
  return user.role === "staff" && todayIST(inv.createdAt) === todayIST();
}

export function permissionsFor(user: SessionUser, inv: Pick<InvoiceRow, "status" | "createdAt">) {
  return {
    canEdit: canEdit(user, inv),
    canCancel: user.role === "owner" && inv.status === "active",
    canDelete: user.role === "owner",
  };
}

async function loadInvoice(tx: Tx, id: string, user: SessionUser): Promise<InvoiceDTO> {
  const [row] = await tx.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!row) throw notFound("Invoice not found.");
  const userIds = [row.createdBy, row.updatedBy].filter((x): x is string => !!x);
  // Sequential on purpose: inside a transaction all queries share one connection.
  const lines = await tx.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id)).orderBy(asc(invoiceLines.lineNo));
  const exchange = await tx.select().from(invoiceExchange).where(eq(invoiceExchange.invoiceId, id)).orderBy(asc(invoiceExchange.rowNo));
  const names = userIds.length ? await tx.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds)) : [];
  const nameOf = (uid: string | null) => names.find((n) => n.id === uid)?.name ?? null;
  const { searchText: _omit, ...rest } = row;
  void _omit;
  return {
    ...rest,
    lines,
    exchange,
    createdByName: nameOf(row.createdBy),
    updatedByName: nameOf(row.updatedBy),
    permissions: permissionsFor(user, row),
  };
}

export async function getInvoice(id: string, user: SessionUser): Promise<InvoiceDTO> {
  if (!isUuid(id)) throw notFound("Invoice not found.");
  return loadInvoice(getDb(), id, user);
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/* ────────────────────────────────────────────────────────────────────────── */
/* Preview / create / update / cancel / delete                               */
/* ────────────────────────────────────────────────────────────────────────── */

export interface PreviewResult {
  totals: InvoiceTotals;
  errors: Issue[];
  warnings: Issue[];
  number: string | null;
  placeOfSupply: string;
}

/** POST /api/invoices/preview — engine + validations without saving. */
export async function previewInvoice(body: unknown, user: SessionUser, editingId?: string): Promise<PreviewResult> {
  const b = invoiceBodySchema.parse(body);
  const db = getDb();
  const s = await loadSettingsRow(db);
  let gstRate = s.gstRate;
  let number: string | null = null;
  let existing: InvoiceRow | undefined;
  if (editingId) {
    if (!isUuid(editingId)) throw notFound("Invoice not found.");
    [existing] = await db.select().from(invoices).where(eq(invoices.id, editingId)).limit(1);
    if (!existing) throw notFound("Invoice not found.");
    if (!canEdit(user, existing)) throw forbidden("You can't edit this invoice.");
    gstRate = existing.gstRate;
    number = existing.number;
  }
  const input = await toEngineInput(db, b, s, gstRate);
  const { totals, errors, warnings } = await checkInput(db, input, s, { isNew: !existing, excludeId: existing?.id });
  if (!existing) number = await peekNextNumber(db, s, input.gstOn, input.date);
  return { totals, errors, warnings, number, placeOfSupply: placeOfSupply(input.customer, s).label };
}

/** POST /api/invoices — DATA-02: header, lines, exchange, number, summary, audit in ONE transaction. */
export async function createInvoice(body: unknown, user: SessionUser): Promise<InvoiceDTO> {
  const b = invoiceBodySchema.parse(body);
  return getDb().transaction(async (tx) => {
    const s = await loadSettingsRow(tx);
    const input = await toEngineInput(tx, b, s, s.gstRate);
    const { totals, errors, warnings } = await checkInput(tx, input, s, { isNew: true });
    if (errors.length) throw validationFailed(errors, { totals });
    if (warnings.length && !b.acceptWarnings) throw warningsNeedConfirmation(warnings, { totals });

    const num = await allocateNumber(tx, s, input.gstOn, input.date, user.id);
    const customerId = await upsertCustomer(tx, input, user.id);
    const [row] = await tx
      .insert(invoices)
      .values({
        ...headerValues(input, totals, s),
        number: num.number,
        seriesKey: num.seriesKey,
        seq: num.seq,
        fy: num.fy,
        customerId,
        shopSnapshot: toSettingsDTO(s),
        searchText: searchTextFor(num.number, input),
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: invoices.id });
    await writeChildren(tx, row.id, input, totals, user.id);
    await rebuildDailySummary(tx, input.date);
    const dto = await loadInvoice(tx, row.id, user);
    await writeAudit(tx, { userId: user.id, entity: "invoice", entityId: row.id, action: "create", after: dto });
    return dto;
  });
}

/** PUT /api/invoices/{id} — INV-19..22: same number, series, creation date and GST rate. */
export async function updateInvoice(id: string, body: unknown, user: SessionUser): Promise<InvoiceDTO> {
  if (!isUuid(id)) throw notFound("Invoice not found.");
  const b = invoiceBodySchema.parse(body);
  return getDb().transaction(async (tx) => {
    const locked = await tx.execute(sql`select id from invoices where id = ${id} for update`);
    if (!locked.rows.length) throw notFound("Invoice not found.");
    const before = await loadInvoice(tx, id, user);
    if (before.status !== "active") throw conflict("A cancelled invoice cannot be edited.");
    if (!canEdit(user, before))
      throw forbidden(user.role === "staff" ? "Billing staff can only edit invoices created today." : "You can't edit invoices.");

    const s = await loadSettingsRow(tx);
    const input = await toEngineInput(tx, b, s, before.gstRate);
    const { totals, errors, warnings } = await checkInput(tx, input, s, { isNew: false, excludeId: id });
    // The number encodes the FY: an edit may not move the bill into another financial year.
    if (before.fy && isValidIsoDate(input.date) && financialYear(input.date) !== before.fy)
      errors.push({
        id: "NUM-03",
        field: "date",
        message: `The date must stay in FY ${before.fy} — invoice ${before.number} belongs to that year.`,
      });
    if (errors.length) throw validationFailed(errors, { totals });
    if (warnings.length && !b.acceptWarnings) throw warningsNeedConfirmation(warnings, { totals });

    const customerId = await upsertCustomer(tx, input, user.id);
    await tx
      .update(invoices)
      .set({
        ...headerValues(input, totals, s),
        customerId,
        searchText: searchTextFor(before.number, input),
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(invoices.id, id));
    await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id));
    await tx.delete(invoiceExchange).where(eq(invoiceExchange.invoiceId, id));
    await writeChildren(tx, id, input, totals, user.id);
    await rebuildDailySummary(tx, before.invoiceDate);
    if (input.date !== before.invoiceDate) await rebuildDailySummary(tx, input.date);
    const after = await loadInvoice(tx, id, user);
    await writeAudit(tx, { userId: user.id, entity: "invoice", entityId: id, action: "update", before, after });
    return after;
  });
}

/** POST /api/invoices/{id}/cancel — D-01: bill stays, marked CANCELLED, excluded from totals. */
export async function cancelInvoice(id: string, reason: string, user: SessionUser): Promise<InvoiceDTO> {
  if (!isUuid(id)) throw notFound("Invoice not found.");
  return getDb().transaction(async (tx) => {
    const locked = await tx.execute(sql`select id from invoices where id = ${id} for update`);
    if (!locked.rows.length) throw notFound("Invoice not found.");
    const before = await loadInvoice(tx, id, user);
    if (before.status === "cancelled") throw conflict(`${before.number} is already cancelled.`);
    await tx
      .update(invoices)
      .set({ status: "cancelled", cancelledReason: reason, cancelledAt: new Date(), cancelledBy: user.id, updatedAt: new Date(), updatedBy: user.id })
      .where(eq(invoices.id, id));
    await rebuildDailySummary(tx, before.invoiceDate);
    const after = await loadInvoice(tx, id, user);
    await writeAudit(tx, { userId: user.id, entity: "invoice", entityId: id, action: "cancel", before, after });
    return after;
  });
}

/** DELETE /api/invoices/{id} — owner only; the number is never reused (NUM-05). */
export async function deleteInvoice(id: string, user: SessionUser): Promise<{ deleted: string }> {
  if (!isUuid(id)) throw notFound("Invoice not found.");
  return getDb().transaction(async (tx) => {
    const locked = await tx.execute(sql`select id from invoices where id = ${id} for update`);
    if (!locked.rows.length) throw notFound("Invoice not found.");
    const before = await loadInvoice(tx, id, user);
    await tx.delete(invoices).where(eq(invoices.id, id));
    await rebuildDailySummary(tx, before.invoiceDate);
    await writeAudit(tx, { userId: user.id, entity: "invoice", entityId: id, action: "delete", before });
    return { deleted: before.number };
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Ledger (TXN-01..06)                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export const PAGE_SIZE = 50;

export interface LedgerFilters {
  q?: string;
  from?: string;
  to?: string;
  metal?: "gold" | "silver";
  gst?: "with" | "without";
  due?: boolean;
  status?: "active" | "cancelled" | "all";
  /** Dashboard drill-down (DSH-03 / T-41): bills containing this purity. */
  purity?: string;
  mode?: string;
  phone?: string;
  page?: number;
}

export function parseLedgerFilters(url: URL): LedgerFilters {
  const p = url.searchParams;
  const pick = <T extends string>(k: string, allowed: readonly T[]) => {
    const v = p.get(k);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
  };
  const date = (k: string) => {
    const v = p.get(k);
    return v && isValidIsoDate(v) ? v : undefined;
  };
  return {
    q: p.get("q")?.trim() || undefined,
    from: date("from"),
    to: date("to"),
    metal: pick("metal", ["gold", "silver"] as const),
    gst: pick("gst", ["with", "without"] as const),
    due: p.get("due") === "1" || p.get("due") === "true",
    status: pick("status", ["active", "cancelled", "all"] as const),
    purity: p.get("purity")?.trim() || undefined,
    mode: p.get("mode")?.trim() || undefined,
    phone: p.get("phone")?.trim() || undefined,
    page: Math.max(1, Number.parseInt(p.get("page") ?? "1", 10) || 1),
  };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function ledgerWhere(f: LedgerFilters): SQL | undefined {
  const conds: (SQL | undefined)[] = [];
  if (f.q) conds.push(ilike(invoices.searchText, `%${escapeLike(f.q.toLowerCase())}%`));
  if (f.from) conds.push(gte(invoices.invoiceDate, f.from));
  if (f.to) conds.push(lte(invoices.invoiceDate, f.to));
  if (f.metal === "gold") conds.push(gt(invoices.goldNetG, "0"));
  if (f.metal === "silver") conds.push(gt(invoices.silverNetG, "0"));
  if (f.gst === "with") conds.push(eq(invoices.gstOn, true));
  if (f.gst === "without") conds.push(eq(invoices.gstOn, false));
  if (f.due) conds.push(gt(invoices.balance, "0"));
  if (f.mode) conds.push(sql`${invoices.payMode}::text = ${f.mode}`);
  if (f.phone) conds.push(eq(invoices.customerPhone, f.phone));
  if (f.purity)
    conds.push(
      sql`exists (select 1 from invoice_lines l where l.invoice_id = "invoices"."id" and lower(l.purity_label) = lower(${f.purity}))`,
    );
  return and(...conds);
}

export interface LedgerRow {
  id: string;
  number: string;
  invoiceDate: string;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  goldNetG: string;
  silverNetG: string;
  taxable: string;
  gstOn: boolean;
  gst: string;
  grandTotal: string;
  balance: string;
  payMode: string;
  payDetails: string;
  status: "active" | "cancelled";
  permissions: { canEdit: boolean; canCancel: boolean; canDelete: boolean };
}

export interface LedgerSummary {
  invoices: number;
  totalBilled: string;
  gstCollected: string;
  goldG: string;
  silverG: string;
  exchange: string;
  balanceDue: string;
  cancelled: number;
}

export async function listInvoices(
  f: LedgerFilters,
  user: SessionUser,
): Promise<{ rows: LedgerRow[]; page: number; pageSize: number; total: number; summary: LedgerSummary }> {
  const db = getDb();
  const base = ledgerWhere(f);
  const status = f.status ?? "all";
  const statusCond = status === "all" ? undefined : eq(invoices.status, status);
  const where = and(base, statusCond);
  const page = f.page ?? 1;

  const [rows, [{ total }], [sum]] = await Promise.all([
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        invoiceDate: invoices.invoiceDate,
        createdAt: invoices.createdAt,
        customerName: invoices.customerName,
        customerPhone: invoices.customerPhone,
        goldNetG: invoices.goldNetG,
        silverNetG: invoices.silverNetG,
        taxable: invoices.taxable,
        gstOn: invoices.gstOn,
        gst: sql<string>`(${invoices.cgst} + ${invoices.sgst} + ${invoices.igst})::numeric(14,2)::text`,
        grandTotal: invoices.grandTotal,
        balance: invoices.balance,
        payMode: invoices.payMode,
        payDetails: invoices.payDetails,
        status: invoices.status,
      })
      .from(invoices)
      .where(where)
      .orderBy(desc(invoices.invoiceDate), desc(invoices.createdAt), desc(invoices.seq))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: sql<number>`count(*)::int` }).from(invoices).where(where),
    // §9.2 summary tiles: the filtered set, cancelled bills excluded (counted separately)
    db
      .select({
        invoices: sql<number>`count(*) filter (where ${invoices.status} = 'active')::int`,
        totalBilled: sql<string>`coalesce(sum(${invoices.grandTotal}) filter (where ${invoices.status} = 'active'), 0)::numeric(14,2)::text`,
        gstCollected: sql<string>`coalesce(sum(${invoices.cgst} + ${invoices.sgst} + ${invoices.igst}) filter (where ${invoices.status} = 'active'), 0)::numeric(14,2)::text`,
        goldG: sql<string>`coalesce(sum(${invoices.goldNetG}) filter (where ${invoices.status} = 'active'), 0)::numeric(12,3)::text`,
        silverG: sql<string>`coalesce(sum(${invoices.silverNetG}) filter (where ${invoices.status} = 'active'), 0)::numeric(12,3)::text`,
        exchange: sql<string>`coalesce(sum(${invoices.exchangeTotal}) filter (where ${invoices.status} = 'active'), 0)::numeric(14,2)::text`,
        balanceDue: sql<string>`coalesce(sum(${invoices.balance}) filter (where ${invoices.status} = 'active' and ${invoices.balance} > 0), 0)::numeric(14,2)::text`,
        cancelled: sql<number>`count(*) filter (where ${invoices.status} = 'cancelled')::int`,
      })
      .from(invoices)
      .where(where),
  ]);

  return {
    rows: rows.map((r) => ({ ...r, permissions: permissionsFor(user, r) })),
    page,
    pageSize: PAGE_SIZE,
    total,
    summary: sum,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Customer recall (INV-07)                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export async function findCustomers(params: { phone?: string; q?: string }) {
  const db = getDb();
  const cols = {
    phone: customers.phone,
    name: customers.name,
    address: customers.address,
    gstin: customers.gstin,
    pan: customers.pan,
    state: customers.state,
    lastInvoiceAt: customers.lastInvoiceAt,
  };
  const phone = params.phone ? sanitizePhone(params.phone) : "";
  if (phone.length === 10) {
    const [c] = await db.select(cols).from(customers).where(eq(customers.phone, phone)).limit(1);
    return { customer: c ?? null, suggestions: c ? [c] : [] };
  }
  const q = (params.q ?? phone).trim();
  if (!q) return { customer: null, suggestions: [] };
  const digits = sanitizePhone(q);
  const like = `%${escapeLike(q.toLowerCase())}%`;
  const suggestions = await db
    .select(cols)
    .from(customers)
    .where(
      or(
        digits.length >= 3 ? ilike(customers.phone, `${escapeLike(digits)}%`) : undefined,
        q.length >= 2 ? ilike(customers.name, like) : undefined,
      ) ?? sql`false`,
    )
    .orderBy(desc(customers.lastInvoiceAt))
    .limit(8);
  return { customer: null, suggestions };
}

