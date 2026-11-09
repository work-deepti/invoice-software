import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  DEFAULT_PURITIES,
  fineRateFor,
  isBlank,
  METALS,
  rateEquivalent,
  round2,
  toDec,
  todayIST,
  validateRates,
  type Metal,
  type PurityRateRow,
  type RateRef,
} from "@/lib/calc-engine";
import { writeAudit } from "./audit";
import type { SessionUser } from "./auth";
import { getDb, type Tx } from "./db";
import { purities, rateHistory, ratesCurrent } from "./db/schema";
import { validationFailed, warningsNeedConfirmation } from "./http";
import { ratesBodySchema } from "./schemas";

export interface RateRowDTO {
  id: string;
  metal: Metal;
  label: string;
  purityPct: string;
  rate: string;
  sortOrder: number;
  equivalent: { amount: string; unit: "10 g" | "kg" } | null;
}

export interface RatesDTO {
  rows: RateRowDTO[];
  /** Date the current rates were last saved, or null when no rate exists. */
  effectiveDate: string | null;
  today: string;
  /** RATE-08: current = saved today; stale = saved before today; none = never set. */
  status: "current" | "stale" | "none";
  /** RATE-05 base per metal — default exchange fine rate (INV-12). */
  fineRates: Partial<Record<Metal, string>>;
}

const trimPct = (v: string) => (v.includes(".") ? v.replace(/\.?0+$/, "") : v);

/** RATE-01: seed the default purities once, with blank rates. */
async function ensureSeeded(tx: Tx): Promise<void> {
  const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(purities);
  if (n > 0) return;
  await tx.transaction(async (t) => {
    await t.execute(sql`select pg_advisory_xact_lock(hashtext('gsb:seed-purities'))`);
    const [{ n: again }] = await t.select({ n: sql<number>`count(*)::int` }).from(purities);
    if (again > 0) return;
    await t.insert(purities).values(
      DEFAULT_PURITIES.map((p, i) => ({ metal: p.metal, label: p.label, purityPct: String(p.purityPct), sortOrder: i })),
    );
  });
}

export async function getRates(tx: Tx = getDb()): Promise<RatesDTO> {
  await ensureSeeded(tx);
  const rows = await tx
    .select({
      id: purities.id,
      metal: purities.metal,
      label: purities.label,
      purityPct: purities.purityPct,
      sortOrder: purities.sortOrder,
      rate: ratesCurrent.ratePerG,
      effectiveDate: ratesCurrent.effectiveDate,
    })
    .from(purities)
    .leftJoin(ratesCurrent, eq(ratesCurrent.purityId, purities.id))
    .where(eq(purities.active, true))
    .orderBy(asc(purities.sortOrder), asc(purities.label));

  const today = todayIST();
  const dated = rows.filter((r) => r.rate !== null && r.effectiveDate);
  const effectiveDate = dated.length ? dated.map((r) => r.effectiveDate!).sort().at(-1)! : null;
  const status = !effectiveDate ? "none" : effectiveDate === today ? "current" : "stale";

  const dto: RateRowDTO[] = rows.map((r) => ({
    id: r.id,
    metal: r.metal,
    label: r.label,
    purityPct: trimPct(r.purityPct),
    rate: r.rate ?? "",
    sortOrder: r.sortOrder,
    equivalent: rateEquivalent(r.metal, r.rate),
  }));
  const asRows: PurityRateRow[] = dto.map((r) => ({ ...r }));
  const fineRates: Partial<Record<Metal, string>> = {};
  for (const m of METALS) {
    const f = fineRateFor(m, asRows);
    if (f) fineRates[m] = f;
  }
  return { rows: dto, effectiveDate, today, status, fineRates };
}

/** Today's master rates in the shape the engine's W-06 check wants. */
export async function todaysRateRefs(tx: Tx): Promise<RateRef[]> {
  const rows = await tx
    .select({ purityId: purities.id, label: purities.label, rate: ratesCurrent.ratePerG })
    .from(purities)
    .innerJoin(ratesCurrent, eq(ratesCurrent.purityId, purities.id))
    .where(and(eq(purities.active, true), isNotNull(ratesCurrent.ratePerG)));
  return rows.map((r) => ({ purityId: r.purityId, label: r.label, rate: r.rate }));
}

/**
 * PUT /api/rates (owner). R-01..R-03 → 422; R-04/R-05 → 409 until acceptWarnings.
 * RATE-06: stores current rates and overwrites today's rate_history rows.
 */
export async function saveRates(body: unknown, user: SessionUser): Promise<RatesDTO> {
  const b = ratesBodySchema.parse(body);
  const incoming = b.rows
    .map((r) => ({
      id: r.id ?? null,
      metal: r.metal,
      label: r.label.trim(),
      purityPct: isBlank(r.purityPct) ? "" : String(r.purityPct).trim(),
      rate: isBlank(r.rate) ? "" : round2(toDec(r.rate)).toFixed(2),
    }))
    // Blank rows are ignored (§8.4: R-rules apply to filled rows only)
    .filter((r) => r.label !== "" || r.rate !== "" || r.purityPct !== "");

  const { errors, warnings } = validateRates(incoming);
  if (errors.length) throw validationFailed(errors);
  if (warnings.length && !b.acceptWarnings) throw warningsNeedConfirmation(warnings);

  const today = todayIST();
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('gsb:rates'))`);
    const before = await getRates(tx);
    const existing = await tx.select().from(purities).where(eq(purities.active, true));
    const existingIds = new Set(existing.map((p) => p.id));
    const savedIds: string[] = [];

    // Deactivate removed rows first so a renamed/re-added label doesn't clash on the unique index.
    const incomingIds = new Set(incoming.map((r) => r.id).filter((x): x is string => !!x && existingIds.has(x)));
    const removed = existing.filter((p) => !incomingIds.has(p.id)).map((p) => p.id);
    if (removed.length) {
      await tx
        .update(purities)
        .set({ active: false, updatedAt: new Date(), updatedBy: user.id })
        .where(inArray(purities.id, removed));
      await tx.delete(ratesCurrent).where(inArray(ratesCurrent.purityId, removed));
    }

    for (const [i, r] of incoming.entries()) {
      let id: string;
      if (r.id && existingIds.has(r.id) && !savedIds.includes(r.id)) {
        id = r.id;
        await tx
          .update(purities)
          .set({ metal: r.metal, label: r.label, purityPct: r.purityPct, sortOrder: i, updatedAt: new Date(), updatedBy: user.id })
          .where(eq(purities.id, id));
      } else {
        const [ins] = await tx
          .insert(purities)
          .values({ metal: r.metal, label: r.label, purityPct: r.purityPct, sortOrder: i, createdBy: user.id, updatedBy: user.id })
          .returning({ id: purities.id });
        id = ins.id;
      }
      savedIds.push(id);
      await tx
        .insert(ratesCurrent)
        .values({ purityId: id, ratePerG: r.rate || null, effectiveDate: today, createdBy: user.id, updatedBy: user.id })
        .onConflictDoUpdate({
          target: ratesCurrent.purityId,
          set: { ratePerG: r.rate || null, effectiveDate: today, updatedAt: new Date(), updatedBy: user.id },
        });
    }

    // RATE-06: one history record per purity for today, overwritten on re-save (T-31)
    await tx.delete(rateHistory).where(eq(rateHistory.date, today));
    const historyRows = incoming
      .map((r, i) => ({ r, id: savedIds[i] }))
      .filter(({ r }) => r.rate !== "")
      .map(({ r, id }) => ({
        date: today,
        purityId: id,
        label: r.label,
        metal: r.metal,
        purityPct: r.purityPct,
        ratePerG: r.rate,
        createdBy: user.id,
        updatedBy: user.id,
      }));
    if (historyRows.length) await tx.insert(rateHistory).values(historyRows);

    const after = await getRates(tx);
    await writeAudit(tx, { userId: user.id, entity: "rates", entityId: today, action: "rates", before: before.rows, after: after.rows });
  });
  return getRates();
}

export interface RateHistoryDTO {
  dates: string[];
  columns: { purityId: string; label: string; metal: Metal }[];
  /** values[date][purityId] = rate */
  values: Record<string, Record<string, string>>;
}

/** RATE-07: the last N saved days, newest first, one column per purity. */
export async function getRateHistory(days = 30): Promise<RateHistoryDTO> {
  const db = getDb();
  const n = Math.min(Math.max(1, Math.trunc(days) || 30), 366);
  const dateRows = await db
    .selectDistinct({ date: rateHistory.date })
    .from(rateHistory)
    .orderBy(desc(rateHistory.date))
    .limit(n);
  const dates = dateRows.map((d) => d.date);
  if (!dates.length) return { dates: [], columns: [], values: {} };

  const rows = await db
    .select({
      date: rateHistory.date,
      purityId: rateHistory.purityId,
      label: rateHistory.label,
      metal: rateHistory.metal,
      rate: rateHistory.ratePerG,
      sortOrder: purities.sortOrder,
      active: purities.active,
    })
    .from(rateHistory)
    .leftJoin(purities, eq(purities.id, rateHistory.purityId))
    .where(inArray(rateHistory.date, dates))
    .orderBy(desc(rateHistory.date));

  const colMap = new Map<string, { purityId: string; label: string; metal: Metal; sort: number }>();
  const values: Record<string, Record<string, string>> = {};
  for (const r of rows) {
    // newest label wins (rows are newest first)
    if (!colMap.has(r.purityId))
      colMap.set(r.purityId, { purityId: r.purityId, label: r.label, metal: r.metal, sort: r.active ? (r.sortOrder ?? 999) : 1000 });
    (values[r.date] ??= {})[r.purityId] = r.rate ?? "";
  }
  const columns = [...colMap.values()]
    .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label))
    .map(({ purityId, label, metal }) => ({ purityId, label, metal }));
  return { dates, columns, values };
}
