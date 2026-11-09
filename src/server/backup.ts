import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { InvoiceInput, Metal } from "@/lib/calc-engine";
import { writeAudit } from "./audit";
import type { SessionUser } from "./auth";
import { getDb } from "./db";
import {
  invoiceExchange,
  invoiceLines,
  invoiceSeries,
  invoices,
  purities,
  rateHistory,
  ratesCurrent,
  shopSettings,
} from "./db/schema";
import { badRequest } from "./http";
import { searchTextFor, upsertCustomer } from "./invoices";
import { loadSettingsRow, toSettingsDTO } from "./settings";

export const BACKUP_FORMAT = "gold-silver-billing-backup";
export const BACKUP_VERSION = 1;
/** Invoices per restore request — keeps each request short and drives the progress bar. */
export const RESTORE_BATCH = 50;

/* ── Backup (TXN-13) ────────────────────────────────────────────────── */

/** GET /api/backup — settings, rates, rate date, numbering counters, history and every invoice. */
export async function buildBackup() {
  const db = getDb();
  const settings = toSettingsDTO(await loadSettingsRow(db));
  const [purityRows, rateRows, historyRows, seriesRows, invoiceRows, lineRows, exchangeRows] = await Promise.all([
    db.select().from(purities).orderBy(asc(purities.sortOrder)),
    db.select().from(ratesCurrent),
    db.select().from(rateHistory).orderBy(asc(rateHistory.date)),
    db.select().from(invoiceSeries),
    db.select().from(invoices).orderBy(asc(invoices.invoiceDate), asc(invoices.createdAt)),
    db.select().from(invoiceLines).orderBy(asc(invoiceLines.lineNo)),
    db.select().from(invoiceExchange).orderBy(asc(invoiceExchange.rowNo)),
  ]);
  const linesBy = new Map<string, typeof lineRows>();
  for (const l of lineRows) (linesBy.get(l.invoiceId) ?? linesBy.set(l.invoiceId, []).get(l.invoiceId)!).push(l);
  const xBy = new Map<string, typeof exchangeRows>();
  for (const x of exchangeRows) (xBy.get(x.invoiceId) ?? xBy.set(x.invoiceId, []).get(x.invoiceId)!).push(x);
  const rateDate = rateRows.map((r) => r.effectiveDate).sort().at(-1) ?? null;

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    purities: purityRows.map((p) => ({ id: p.id, metal: p.metal, label: p.label, purityPct: p.purityPct, sortOrder: p.sortOrder, active: p.active })),
    rates: rateRows.map((r) => ({ purityId: r.purityId, ratePerG: r.ratePerG, effectiveDate: r.effectiveDate })),
    rateDate,
    rateHistory: historyRows.map((h) => ({ date: h.date, purityId: h.purityId, label: h.label, metal: h.metal, purityPct: h.purityPct, ratePerG: h.ratePerG })),
    series: seriesRows.map((s) => ({ seriesKey: s.seriesKey, prefix: s.prefix, fy: s.fy, lastSeq: s.lastSeq })),
    invoices: invoiceRows.map(({ searchText: _s, customerId: _c, ...inv }) => {
      void _s;
      void _c;
      return {
        ...inv,
        lines: (linesBy.get(inv.id) ?? []).map(({ id: _i, invoiceId: _v, createdAt: _a, updatedAt: _b, createdBy: _x, updatedBy: _y, ...l }) => {
          void _i, void _v, void _a, void _b, void _x, void _y;
          return l;
        }),
        exchange: (xBy.get(inv.id) ?? []).map(({ id: _i, invoiceId: _v, createdAt: _a, updatedAt: _b, createdBy: _x, updatedBy: _y, ...x }) => {
          void _i, void _v, void _a, void _b, void _x, void _y;
          return x;
        }),
      };
    }),
  };
}

/* ── Restore (TXN-14) ───────────────────────────────────────────────── */

const s = z.string();
const n = z.union([z.string(), z.number()]).transform(String);
const nn = z.union([z.string(), z.number()]).nullable().transform((v) => (v === null ? null : String(v)));
const metal = z.enum(["Gold", "Silver", "Platinum", "Other"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const metaSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().max(BACKUP_VERSION),
  settings: z.record(z.string(), z.unknown()),
  purities: z.array(z.object({ id: z.string().uuid(), metal, label: s, purityPct: n, sortOrder: z.number().int(), active: z.boolean() })),
  rates: z.array(z.object({ purityId: z.string().uuid(), ratePerG: nn, effectiveDate: isoDate })),
  rateHistory: z.array(z.object({ date: isoDate, purityId: z.string().uuid(), label: s, metal, purityPct: n, ratePerG: nn })),
  series: z.array(z.object({ seriesKey: s, prefix: s, fy: s.nullable(), lastSeq: z.number().int().min(0) })),
});

const lineSchema = z.object({
  lineNo: z.number().int(),
  description: s,
  purityId: z.string().uuid().nullable(),
  metal,
  purityLabel: s,
  hsn: s,
  pcs: z.number().int(),
  grossG: n,
  lessG: n,
  netG: n,
  wastagePct: n,
  chargeableG: n,
  ratePerG: n,
  rateManual: z.boolean(),
  makingType: z.enum(["per_g", "pct", "flat"]),
  makingInput: n,
  makingAmt: n,
  stoneAmt: n,
  metalValue: n,
  amount: n,
});

const exchangeSchema = z.object({
  rowNo: z.number().int(),
  description: s,
  metal,
  weightG: n,
  touchPct: n,
  fineG: n,
  fineRate: n,
  value: n,
});

const invoiceSchema = z.object({
  number: s.min(1).max(20),
  seriesKey: s,
  seq: z.number().int().min(1),
  fy: s.nullable(),
  invoiceDate: isoDate,
  gstOn: z.boolean(),
  interState: z.boolean(),
  gstRate: n,
  customerName: s,
  customerPhone: s,
  customerAddress: s,
  customerGstin: s,
  customerPan: s,
  customerState: s,
  panDeclaration: z.boolean().default(false),
  placeOfSupply: s,
  placeCode: s.nullable(),
  payMode: z.enum(["Cash", "UPI", "Card", "Bank transfer", "Cheque", "Mixed", "Credit"]),
  payDetails: s.default(""),
  discountInput: n,
  discount: n,
  itemsTotal: n,
  taxable: n,
  cgst: n,
  sgst: n,
  igst: n,
  exchangeTotal: n,
  roundOff: n,
  grandTotal: n,
  receivedFull: z.boolean(),
  received: n,
  paid: n,
  changeReturned: n,
  balance: n,
  goldNetG: n,
  silverNetG: n,
  notes: s,
  shopSnapshot: z.record(z.string(), z.unknown()),
  status: z.enum(["active", "cancelled"]),
  cancelledReason: s.nullable(),
  cancelledAt: s.nullable(),
  cancelledBy: s.nullable(),
  createdAt: s,
  updatedAt: s,
  createdBy: s.nullable(),
  updatedBy: s.nullable(),
  lines: z.array(lineSchema),
  exchange: z.array(exchangeSchema),
});

export const restoreBodySchema = z.discriminatedUnion("phase", [
  z.object({ phase: z.literal("start"), meta: metaSchema }),
  z.object({ phase: z.literal("invoices"), invoices: z.array(invoiceSchema).max(RESTORE_BATCH) }),
  z.object({ phase: z.literal("finish"), total: z.number().int().min(0), exportedAt: z.string().optional() }),
]);

const SETTING_KEYS = [
  "name", "phone", "email", "gstin", "state", "stateCode", "address", "gstRate", "gstDefault", "prefixGst", "prefixNoGst",
  "noGstTitle", "hsnGold", "hsnSilver", "fyNumbering", "terms", "bankDetails", "signatoryLabel", "staffCanSeeDashboard",
  "cashLimit", "panLimit", "cashPayoutLimit", "panMissingPolicy", "b2cLargeLimit",
] as const;

/**
 * POST /api/restore — runs in three phases so the browser can show "Restoring… n/N":
 *   start    → settings, purities, rates, rate history, numbering counters
 *   invoices → up to 50 invoices per call; an invoice with the same number is replaced
 *   finish   → audit entry
 * Nothing that isn't in the file is deleted. Each phase is its own transaction.
 */
export async function restorePhase(body: unknown, user: SessionUser) {
  const b = restoreBodySchema.parse(body);
  const db = getDb();

  if (b.phase === "start") {
    const m = b.meta;
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('gsb:rates'))`);
      await loadSettingsRow(tx);
      const patch: Record<string, unknown> = {};
      for (const k of SETTING_KEYS) if (k in m.settings && m.settings[k] !== undefined) patch[k] = m.settings[k];
      if (Object.keys(patch).length) await tx.update(shopSettings).set({ ...patch, updatedAt: new Date(), updatedBy: user.id }).where(eq(shopSettings.id, 1));

      // Purities: same id → update; same active label under another id → reuse that row.
      const existing = await tx.select().from(purities);
      const byId = new Map(existing.map((p) => [p.id, p]));
      const byLabel = new Map(existing.filter((p) => p.active).map((p) => [p.label.trim().toLowerCase(), p]));
      for (const p of m.purities) {
        const clash = byLabel.get(p.label.trim().toLowerCase());
        if (byId.has(p.id)) {
          await tx.update(purities).set({ metal: p.metal, label: p.label, purityPct: p.purityPct, sortOrder: p.sortOrder, active: p.active, updatedAt: new Date(), updatedBy: user.id }).where(eq(purities.id, p.id));
        } else if (clash && p.active) {
          continue; // keep the local row with that name; lines map to it below by label
        } else {
          await tx.insert(purities).values({ id: p.id, metal: p.metal, label: p.label, purityPct: p.purityPct, sortOrder: p.sortOrder, active: p.active, createdBy: user.id, updatedBy: user.id });
        }
      }
      const known = new Set((await tx.select({ id: purities.id }).from(purities)).map((r) => r.id));
      for (const r of m.rates.filter((r) => known.has(r.purityId)))
        await tx
          .insert(ratesCurrent)
          .values({ purityId: r.purityId, ratePerG: r.ratePerG, effectiveDate: r.effectiveDate, createdBy: user.id, updatedBy: user.id })
          .onConflictDoUpdate({ target: ratesCurrent.purityId, set: { ratePerG: r.ratePerG, effectiveDate: r.effectiveDate, updatedAt: new Date() } });
      for (const h of m.rateHistory)
        await tx
          .insert(rateHistory)
          .values({ ...h, createdBy: user.id, updatedBy: user.id })
          .onConflictDoUpdate({ target: [rateHistory.date, rateHistory.purityId], set: { label: h.label, metal: h.metal, purityPct: h.purityPct, ratePerG: h.ratePerG } });
      // NUM-05: counters only move up
      for (const s of m.series)
        await tx.execute(sql`
          insert into invoice_series (series_key, prefix, fy, last_seq, created_by, updated_by)
          values (${s.seriesKey}, ${s.prefix}, ${s.fy}, ${s.lastSeq}, ${user.id}, ${user.id})
          on conflict (series_key) do update set last_seq = greatest(invoice_series.last_seq, excluded.last_seq), updated_at = now()`);
      return { ok: true };
    });
  }

  if (b.phase === "invoices") {
    return db.transaction(async (tx) => {
      const local = await tx.select({ id: purities.id, label: purities.label, active: purities.active }).from(purities);
      const ids = new Set(local.map((p) => p.id));
      const byLabel = new Map(local.filter((p) => p.active).map((p) => [p.label.trim().toLowerCase(), p.id]));
      const dates = new Set<string>();
      const numbers = b.invoices.map((i) => i.number);
      const replaced = numbers.length
        ? await tx.select({ number: invoices.number, date: invoices.invoiceDate }).from(invoices).where(inArray(invoices.number, numbers))
        : [];
      replaced.forEach((r) => dates.add(r.date));
      if (numbers.length) await tx.delete(invoices).where(inArray(invoices.number, numbers));

      for (const inv of b.invoices) {
        const { lines, exchange, ...h } = inv;
        const input: InvoiceInput = {
          date: h.invoiceDate,
          payMode: h.payMode,
          payDetails: h.payDetails,
          gstOn: h.gstOn,
          interState: h.interState,
          gstRate: h.gstRate,
          customer: { name: h.customerName, phone: h.customerPhone, gstin: h.customerGstin, pan: h.customerPan, state: h.customerState, address: h.customerAddress },
          lines: lines.map((l) => ({ description: l.description, metal: l.metal as Metal, makingType: l.makingType })),
          exchange: [],
          notes: h.notes,
        };
        const customerId = await upsertCustomer(tx, input, user.id);
        const [row] = await tx
          .insert(invoices)
          .values({
            ...h,
            customerId,
            cancelledAt: h.cancelledAt ? new Date(h.cancelledAt) : null,
            createdAt: new Date(h.createdAt),
            updatedAt: new Date(h.updatedAt),
            searchText: searchTextFor(h.number, input),
          })
          .returning({ id: invoices.id });
        if (lines.length)
          await tx.insert(invoiceLines).values(
            lines.map((l) => ({
              ...l,
              invoiceId: row.id,
              purityId: l.purityId && ids.has(l.purityId) ? l.purityId : (byLabel.get(l.purityLabel.trim().toLowerCase()) ?? null),
              createdBy: user.id,
              updatedBy: user.id,
            })),
          );
        if (exchange.length) await tx.insert(invoiceExchange).values(exchange.map((x) => ({ ...x, invoiceId: row.id, createdBy: user.id, updatedBy: user.id })));
        // numbering continues correctly after a restore (T-33)
        await tx.execute(sql`
          insert into invoice_series (series_key, prefix, fy, last_seq, created_by, updated_by)
          values (${h.seriesKey}, ${h.seriesKey.split("|")[0]}, ${h.fy}, ${h.seq}, ${user.id}, ${user.id})
          on conflict (series_key) do update set last_seq = greatest(invoice_series.last_seq, excluded.last_seq), updated_at = now()`);
        dates.add(h.invoiceDate);
      }
      for (const d of [...dates].sort()) await tx.execute(sql`select gsb_rebuild_daily_summary(${d}::date)`);
      return { ok: true, restored: b.invoices.length, replaced: replaced.length };
    });
  }

  return db.transaction(async (tx) => {
    await writeAudit(tx, { userId: user.id, entity: "backup", entityId: b.exportedAt ?? null, action: "restore", after: { invoices: b.total } });
    return { ok: true };
  });
}

export function assertBackupShape(v: unknown) {
  if (!v || typeof v !== "object" || (v as { format?: string }).format !== BACKUP_FORMAT) throw badRequest("This isn't a Gold & Silver Billing backup file.");
}
