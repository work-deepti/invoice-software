import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { financialYear, formatInvoiceNumber, todayIST } from "@/lib/calc-engine";
import {
  addDays,
  bucketLabel,
  bucketOf,
  bucketsIn,
  granularityFor,
  PERIODS,
  resolvePeriod,
  type DateRange,
  type Granularity,
  type PeriodKey,
  type ResolvedPeriod,
} from "@/lib/periods";
import { getDb } from "./db";
import { badRequest } from "./http";
import { loadSettingsRow } from "./settings";

/* ── filters (DSH-01) ───────────────────────────────────────────────── */

export interface DashFilters {
  metal?: "gold" | "silver";
  gst?: "with" | "without";
  mode?: string;
}

export interface DashQuery {
  period: ResolvedPeriod;
  filters: DashFilters;
}

const MODES = ["Cash", "UPI", "Card", "Bank transfer", "Cheque", "Mixed", "Credit"];

export function parseDashQuery(url: URL): DashQuery {
  const p = url.searchParams;
  const key = (PERIODS as readonly string[]).includes(p.get("period") ?? "") ? (p.get("period") as PeriodKey) : "month";
  const period = resolvePeriod(key, todayIST(), { from: p.get("from") ?? undefined, to: p.get("to") ?? undefined });
  const metal = p.get("metal");
  const gst = p.get("gst");
  const mode = p.get("mode");
  return {
    period,
    filters: {
      metal: metal === "gold" || metal === "silver" ? metal : undefined,
      gst: gst === "with" || gst === "without" ? gst : undefined,
      mode: mode && MODES.includes(mode) ? mode : undefined,
    },
  };
}

type Row = Record<string, unknown>;
async function q<T extends Row = Row>(query: SQL): Promise<T[]> {
  const r = await getDb().execute(query);
  return r.rows as T[];
}

const and = (parts: (SQL | null | false | undefined)[]) => sql.join(parts.filter(Boolean) as SQL[], sql` and `);

/** daily_summary, invoice-level rows ('ALL'), filtered by period / GST / mode / metal mix. */
function allRows(r: DateRange, f: DashFilters) {
  const mix =
    f.metal === "gold"
      ? sql`ds.purity_key in ('mix:gold','mix:mixed')`
      : f.metal === "silver"
        ? sql`ds.purity_key in ('mix:silver','mix:mixed')`
        : null;
  return and([
    sql`ds.metal = 'ALL'`,
    sql`ds.date between ${r.from}::date and ${r.to}::date`,
    f.gst ? sql`ds.gst_on = ${f.gst === "with"}` : null,
    f.mode ? sql`ds.pay_mode = ${f.mode}` : null,
    mix,
  ]);
}

/** daily_summary line rows (per metal & purity). A metal filter keeps that metal's lines. */
function lineRows(r: DateRange, f: DashFilters) {
  return and([
    sql`ds.metal <> 'ALL'`,
    sql`ds.purity_key <> '~exchange'`,
    sql`ds.date between ${r.from}::date and ${r.to}::date`,
    f.gst ? sql`ds.gst_on = ${f.gst === "with"}` : null,
    f.mode ? sql`ds.pay_mode = ${f.mode}` : null,
    f.metal ? sql`ds.metal = ${f.metal === "gold" ? "Gold" : "Silver"}` : null,
  ]);
}

function exchangeRows(r: DateRange, f: DashFilters) {
  return and([
    sql`ds.purity_key = '~exchange'`,
    sql`ds.date between ${r.from}::date and ${r.to}::date`,
    f.gst ? sql`ds.gst_on = ${f.gst === "with"}` : null,
    f.mode ? sql`ds.pay_mode = ${f.mode}` : null,
  ]);
}

/** Saved, active invoices for invoice-level views (same filters). */
function invWhere(r: DateRange | null, f: DashFilters, alias = "i") {
  const a = sql.raw(alias);
  return and([
    sql`${a}.status = 'active'`,
    r ? sql`${a}.invoice_date between ${r.from}::date and ${r.to}::date` : null,
    f.gst ? sql`${a}.gst_on = ${f.gst === "with"}` : null,
    f.mode ? sql`${a}.pay_mode::text = ${f.mode}` : null,
    f.metal === "gold" ? sql`${a}.gold_net_g > 0` : f.metal === "silver" ? sql`${a}.silver_net_g > 0` : null,
  ]);
}

const truncSql = (g: Granularity, col: SQL) =>
  g === "day" ? sql`(${col})::date` : g === "week" ? sql`date_trunc('week', ${col})::date` : sql`date_trunc('month', ${col})::date`;

const iso = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const str = (v: unknown, dp = 2) => (v === null || v === undefined ? (0).toFixed(dp) : String(v));

export interface Kpi {
  value: string;
  previous: string;
}

/* ── shared KPI block ───────────────────────────────────────────────── */

async function totals(r: DateRange, f: DashFilters) {
  const [a] = await q(sql`
    select coalesce(sum(invoices),0)::int as invoices, coalesce(sum(sales),0)::numeric(14,2)::text as sales,
           coalesce(sum(taxable),0)::numeric(14,2)::text as taxable,
           coalesce(sum(cgst),0)::numeric(14,2)::text as cgst, coalesce(sum(sgst),0)::numeric(14,2)::text as sgst,
           coalesce(sum(igst),0)::numeric(14,2)::text as igst,
           coalesce(sum(cgst+sgst+igst),0)::numeric(14,2)::text as gst,
           coalesce(sum(making),0)::numeric(14,2)::text as making, coalesce(sum(stone),0)::numeric(14,2)::text as stone,
           coalesce(sum(metal_value),0)::numeric(14,2)::text as metal_value,
           coalesce(sum(discount),0)::numeric(14,2)::text as discount,
           coalesce(sum(exchange_value),0)::numeric(14,2)::text as exchange,
           coalesce(sum(paid),0)::numeric(14,2)::text as received,
           coalesce(sum(paid) filter (where pay_mode = 'Cash'),0)::numeric(14,2)::text as cash
    from daily_summary ds where ${allRows(r, f)}`);
  const [g] = await q(sql`
    select coalesce(sum(net_g) filter (where metal = 'Gold'),0)::numeric(12,3)::text as gold,
           coalesce(sum(net_g) filter (where metal = 'Silver'),0)::numeric(12,3)::text as silver
    from daily_summary ds where ${lineRows(r, f)}`);
  return { ...a, ...g } as Record<string, string> & { invoices: number };
}

async function duesAsOf(asOf: string, f: DashFilters): Promise<string> {
  const [d] = await q(sql`
    select coalesce(sum(i.balance),0)::numeric(14,2)::text as dues
    from invoices i where ${invWhere(null, f)} and i.balance > 0 and i.invoice_date <= ${asOf}::date`);
  return String(d.dues);
}

const avg = (sales: string, n: number) => (n ? (Number(sales) / n).toFixed(2) : "0.00");

/* ── A. Overview ────────────────────────────────────────────────────── */

export async function overview({ period, filters: f }: DashQuery) {
  const { current: r, previous: p } = period;
  const g = granularityFor(r);
  const [cur, prev, dues, prevDues] = await Promise.all([totals(r, f), totals(p, f), duesAsOf(todayIST(), f), duesAsOf(p.to, f)]);

  const kpis: Record<string, Kpi> = {
    sales: { value: cur.sales, previous: prev.sales },
    invoices: { value: String(cur.invoices), previous: String(prev.invoices) },
    avgBill: { value: avg(cur.sales, cur.invoices), previous: avg(prev.sales, prev.invoices) },
    goldG: { value: cur.gold, previous: prev.gold },
    silverG: { value: cur.silver, previous: prev.silver },
    gst: { value: cur.gst, previous: prev.gst },
    making: { value: cur.making, previous: prev.making },
    dues: { value: dues, previous: prevDues },
  };

  const bucket = truncSql(g, sql`ds.date`);
  const [trendCur, trendPrev, mix, metals, top] = await Promise.all([
    q(sql`select ${bucket} as b, sum(sales)::numeric(14,2)::text as sales, sum(invoices)::int as invoices from daily_summary ds where ${allRows(r, f)} group by 1`),
    q(sql`select ${bucket} as b, sum(sales)::numeric(14,2)::text as sales from daily_summary ds where ${allRows(p, f)} group by 1`),
    q(sql`select ${bucket} as b, sum(metal_value)::numeric(14,2)::text as metal_value, sum(making)::numeric(14,2)::text as making,
             sum(stone)::numeric(14,2)::text as stone, sum(cgst+sgst+igst)::numeric(14,2)::text as gst, sum(discount)::numeric(14,2)::text as discount
          from daily_summary ds where ${allRows(r, f)} group by 1`),
    q(sql`select ${bucket} as b, coalesce(sum(net_g) filter (where metal='Gold'),0)::numeric(12,3)::text as gold,
             coalesce(sum(net_g) filter (where metal='Silver'),0)::numeric(12,3)::text as silver
          from daily_summary ds where ${lineRows(r, f)} group by 1`),
    q(sql`select nullif(i.customer_phone,'') as phone, max(i.customer_name) as name, count(*)::int as invoices,
             sum(i.grand_total)::numeric(14,2)::text as sales
          from invoices i where ${invWhere(r, f)} group by 1 order by sum(i.grand_total) desc limit 5`),
  ]);

  const curBuckets = bucketsIn(r, g);
  const prevBuckets = bucketsIn(p, g);
  const byB = <T extends Row>(rows: T[]) => new Map(rows.map((x) => [iso(x.b), x]));
  const tc = byB(trendCur), tp = byB(trendPrev), mx = byB(mix), mt = byB(metals);
  const trend = curBuckets.map((b, i) => ({
    bucket: b,
    label: bucketLabel(b, g),
    sales: str(tc.get(b)?.sales),
    invoices: Number(tc.get(b)?.invoices ?? 0),
    previous: prevBuckets[i] ? str(tp.get(prevBuckets[i])?.sales) : null,
  }));
  const salesMix = curBuckets.map((b) => ({
    bucket: b,
    label: bucketLabel(b, g),
    metalValue: str(mx.get(b)?.metal_value),
    making: str(mx.get(b)?.making),
    stone: str(mx.get(b)?.stone),
    gst: str(mx.get(b)?.gst),
    discount: str(mx.get(b)?.discount),
  }));
  const metalTrend = curBuckets.map((b) => ({ bucket: b, label: bucketLabel(b, g), gold: str(mt.get(b)?.gold, 3), silver: str(mt.get(b)?.silver, 3) }));

  // Today's rates vs the day before (from rate history)
  const rateRows = await q(sql`
    with d as (select distinct date from rate_history where date <= ${todayIST()}::date order by date desc limit 2)
    select rh.date, rh.label, rh.metal::text as metal, rh.rate_per_g::text as rate
    from rate_history rh join d on d.date = rh.date left join purities p on p.id = rh.purity_id
    where rh.rate_per_g is not null order by rh.date desc, coalesce(p.sort_order, 999), rh.label`);
  const dates = [...new Set(rateRows.map((x) => iso(x.date)))];
  const rates = rateRows
    .filter((x) => iso(x.date) === dates[0])
    .map((x) => ({
      label: String(x.label),
      metal: String(x.metal),
      rate: String(x.rate),
      previous: (rateRows.find((y) => iso(y.date) === dates[1] && y.label === x.label)?.rate as string | undefined) ?? null,
    }));

  return {
    granularity: g,
    kpis,
    trend,
    salesMix,
    metalTrend,
    topCustomers: top.map((t) => ({ phone: (t.phone as string | null) ?? null, name: (t.name as string) || "", invoices: t.invoices as number, sales: String(t.sales) })),
    rates: { date: dates[0] ?? null, previousDate: dates[1] ?? null, rows: rates },
  };
}

/* ── B. Sales & products ────────────────────────────────────────────── */

export async function sales({ period, filters: f }: DashQuery) {
  const r = period.current;
  const [byPurity, byItem, billSize, heat, making, discount] = await Promise.all([
    q(sql`select ds.metal, ds.purity_key as purity, sum(sales)::numeric(14,2)::text as sales, sum(net_g)::numeric(12,3)::text as grams
          from daily_summary ds where ${lineRows(r, f)} group by 1,2 order by sum(sales) desc`),
    q(sql`select lower(trim(l.description)) as key, min(trim(l.description)) as description, count(*)::int as count,
             sum(l.amount)::numeric(14,2)::text as sales
          from invoice_lines l join invoices i on i.id = l.invoice_id
          where ${invWhere(r, f)} and trim(l.description) <> '' group by 1 order by sum(l.amount) desc limit 15`),
    q(sql`select case when i.grand_total < 10000 then 0 when i.grand_total < 50000 then 1 when i.grand_total < 100000 then 2
                      when i.grand_total < 200000 then 3 when i.grand_total < 500000 then 4 else 5 end as bucket,
             count(*)::int as count, sum(i.grand_total)::numeric(14,2)::text as sales
          from invoices i where ${invWhere(r, f)} group by 1`),
    q(sql`select extract(isodow from i.created_at at time zone 'Asia/Kolkata')::int as dow,
             extract(hour from i.created_at at time zone 'Asia/Kolkata')::int as hour, count(*)::int as count
          from invoices i where ${invWhere(r, f)} group by 1,2`),
    q(sql`select ds.metal, ds.purity_key as purity, sum(making)::numeric(14,2)::text as making, sum(net_g)::numeric(12,3)::text as grams,
             sum(metal_value)::numeric(14,2)::text as metal_value
          from daily_summary ds where ${lineRows(r, f)} group by 1,2 order by 1,2`),
    q(sql`select date_trunc('month', ds.date)::date as m, sum(discount)::numeric(14,2)::text as discount, sum(taxable)::numeric(14,2)::text as taxable
          from daily_summary ds where ${allRows(r, f)} group by 1 order by 1`),
  ]);
  const BUCKETS = ["< ₹10k", "₹10–50k", "₹50k–1L", "₹1–2L", "₹2–5L", "> ₹5L"];
  return {
    byPurity: byPurity.map((x) => ({ metal: String(x.metal), purity: String(x.purity) || "(no purity)", sales: String(x.sales), grams: String(x.grams) })),
    byItem: byItem.map((x) => ({ description: String(x.description), count: x.count as number, sales: String(x.sales) })),
    billSize: BUCKETS.map((label, i) => {
      const b = billSize.find((x) => Number(x.bucket) === i);
      return { label, count: Number(b?.count ?? 0), sales: str(b?.sales) };
    }),
    heatmap: heat.map((x) => ({ dow: Number(x.dow), hour: Number(x.hour), count: Number(x.count) })),
    making: making.map((x) => {
      const grams = Number(x.grams);
      const mv = Number(x.metal_value);
      return {
        metal: String(x.metal),
        purity: String(x.purity) || "(no purity)",
        making: String(x.making),
        perGram: grams ? (Number(x.making) / grams).toFixed(2) : "0.00",
        pctOfValue: mv ? ((Number(x.making) / mv) * 100).toFixed(2) : "0.00",
      };
    }),
    discount: discount.map((x) => ({
      month: iso(x.m),
      label: bucketLabel(iso(x.m), "month"),
      discount: String(x.discount),
      pct: Number(x.taxable) ? ((Number(x.discount) / Number(x.taxable)) * 100).toFixed(2) : "0.00",
    })),
  };
}

/* ── C. Customers & dues ────────────────────────────────────────────── */

export async function customers({ period, filters: f }: DashQuery, lookupPhone?: string) {
  const r = period.current;
  if (lookupPhone) return { lookup: await customerLookup(lookupPhone) };
  const today = todayIST();
  const [counts, prevCounts, monthly, top, ageing, dueList] = await Promise.all([
    customerCounts(r, f),
    customerCounts(period.previous, f),
    q(sql`
      with firsts as (select customer_phone, min(invoice_date) as first from invoices where status = 'active' and customer_phone <> '' group by 1),
      m as (select distinct date_trunc('month', i.invoice_date)::date as month, i.customer_phone
            from invoices i where ${invWhere(r, f)} and i.customer_phone <> '')
      select m.month, count(*) filter (where date_trunc('month', f.first) = m.month)::int as new,
             count(*) filter (where date_trunc('month', f.first) < m.month)::int as repeat
      from m join firsts f on f.customer_phone = m.customer_phone group by 1 order by 1`),
    q(sql`
      select nullif(i.customer_phone,'') as phone, max(i.customer_name) as name, count(*)::int as invoices,
             sum(i.grand_total)::numeric(14,2)::text as sales, max(i.invoice_date) as last,
             coalesce((select sum(d.balance) from invoices d where d.status='active' and d.balance > 0
                        and d.customer_phone = i.customer_phone and i.customer_phone <> ''),0)::numeric(14,2)::text as outstanding
      from invoices i where ${invWhere(r, f)} group by i.customer_phone order by sum(i.grand_total) desc limit 20`),
    q(sql`
      select case when ${today}::date - i.invoice_date <= 30 then 0 when ${today}::date - i.invoice_date <= 60 then 1
                  when ${today}::date - i.invoice_date <= 90 then 2 else 3 end as bucket,
             count(*)::int as count, sum(i.balance)::numeric(14,2)::text as dues
      from invoices i where ${invWhere(null, f)} and i.balance > 0 group by 1`),
    q(sql`
      select i.id, i.number, i.invoice_date, i.customer_name, i.customer_phone, i.balance::text as balance,
             (${today}::date - i.invoice_date)::int as days
      from invoices i where ${invWhere(null, f)} and i.balance > 0 order by i.invoice_date asc limit 200`),
  ]);
  const AGE = ["0–30 days", "31–60 days", "61–90 days", "> 90 days"];
  return {
    kpis: {
      unique: { value: String(counts.unique), previous: String(prevCounts.unique) },
      repeat: { value: String(counts.repeat), previous: String(prevCounts.repeat) },
      walkIn: { value: String(counts.walkIn), previous: String(prevCounts.walkIn) },
    },
    newVsRepeat: monthly.map((x) => ({ month: iso(x.month), label: bucketLabel(iso(x.month), "month"), new: Number(x.new), repeat: Number(x.repeat) })),
    top: top.map((t) => ({ phone: (t.phone as string | null) ?? null, name: String(t.name ?? ""), invoices: Number(t.invoices), sales: String(t.sales), last: iso(t.last), outstanding: String(t.outstanding) })),
    ageing: AGE.map((label, i) => {
      const b = ageing.find((x) => Number(x.bucket) === i);
      return { label, count: Number(b?.count ?? 0), dues: str(b?.dues) };
    }),
    dues: dueList.map((d) => ({ id: String(d.id), number: String(d.number), date: iso(d.invoice_date), name: String(d.customer_name), phone: String(d.customer_phone), balance: String(d.balance), days: Number(d.days) })),
  };
}

async function customerCounts(r: DateRange, f: DashFilters) {
  const [c] = await q(sql`
    with per as (select customer_phone, count(*) as n from invoices i where ${invWhere(r, f)} group by 1)
    select count(*) filter (where customer_phone <> '')::int as unique,
           count(*) filter (where customer_phone <> '' and n >= 2)::int as repeat,
           coalesce(sum(n) filter (where customer_phone = ''),0)::int as walk_in from per`);
  return { unique: Number(c.unique), repeat: Number(c.repeat), walkIn: Number(c.walk_in) };
}

async function customerLookup(phone: string) {
  const digits = phone.replace(/\D/g, "").slice(0, 10);
  if (digits.length !== 10) throw badRequest("Enter a 10-digit phone number.");
  const [c] = await q(sql`
    select max(customer_name) as name, count(*)::int as invoices, coalesce(sum(grand_total),0)::numeric(14,2)::text as sales,
           coalesce(sum(gold_net_g),0)::numeric(12,3)::text as gold, coalesce(sum(silver_net_g),0)::numeric(12,3)::text as silver,
           coalesce(sum(balance) filter (where balance > 0),0)::numeric(14,2)::text as dues,
           min(invoice_date) as first, max(invoice_date) as last
    from invoices where status = 'active' and customer_phone = ${digits}`);
  const recent = await q(sql`
    select id, number, invoice_date, grand_total::text as total, balance::text as balance from invoices
    where status = 'active' and customer_phone = ${digits} order by invoice_date desc, created_at desc limit 10`);
  return {
    phone: digits,
    name: String(c.name ?? ""),
    invoices: Number(c.invoices),
    sales: String(c.sales),
    gold: String(c.gold),
    silver: String(c.silver),
    dues: String(c.dues),
    first: c.first ? iso(c.first) : null,
    last: c.last ? iso(c.last) : null,
    recent: recent.map((x) => ({ id: String(x.id), number: String(x.number), date: iso(x.invoice_date), total: String(x.total), balance: String(x.balance) })),
  };
}

/* ── D. Payments ────────────────────────────────────────────────────── */

export async function payments({ period, filters: f }: DashQuery) {
  const r = period.current;
  const s = await loadSettingsRow();
  const [cur, prev, byMode, monthly, cashNear, mixedBig, noPan] = await Promise.all([
    totals(r, f),
    totals(period.previous, f),
    q(sql`select pay_mode as mode, sum(paid)::numeric(14,2)::text as received, sum(invoices)::int as invoices
          from daily_summary ds where ${allRows(r, f)} group by 1 order by sum(paid) desc`),
    q(sql`select date_trunc('month', ds.date)::date as m, pay_mode as mode, sum(paid)::numeric(14,2)::text as received
          from daily_summary ds where ${allRows(r, f)} group by 1,2 order by 1`),
    // compliance panel — near the cash limit: 75% of it (₹1.5 lakh at the default ₹2 lakh)
    q(sql`select i.id, i.number, i.invoice_date, i.customer_name, i.paid::text as amount from invoices i
          where ${invWhere(r, f)} and i.pay_mode = 'Cash' and i.paid >= ${s.cashLimit}::numeric * 0.75 order by i.paid desc limit 100`),
    q(sql`select i.id, i.number, i.invoice_date, i.customer_name, i.paid::text as amount from invoices i
          where ${invWhere(r, f)} and i.pay_mode = 'Mixed' and i.paid >= ${s.cashLimit}::numeric order by i.paid desc limit 100`),
    q(sql`select i.id, i.number, i.invoice_date, i.customer_name, i.grand_total::text as amount, i.pan_declaration from invoices i
          where ${invWhere(r, f)} and i.grand_total >= ${s.panLimit}::numeric and i.customer_pan = '' order by i.grand_total desc limit 100`),
  ]);
  const share = (t: Record<string, string>) => (Number(t.received) ? ((Number(t.cash) / Number(t.received)) * 100).toFixed(1) : "0.0");
  const list = (rows: Row[]) =>
    rows.map((x) => ({ id: String(x.id), number: String(x.number), date: iso(x.invoice_date), name: String(x.customer_name), amount: String(x.amount), form60: x.pan_declaration === true }));
  return {
    kpis: {
      received: { value: cur.received, previous: prev.received },
      cashShare: { value: share(cur), previous: share(prev) },
      cash: { value: cur.cash, previous: prev.cash },
    },
    byMode: byMode.map((x) => ({ mode: String(x.mode), received: String(x.received), invoices: Number(x.invoices) })),
    monthly: monthly.map((x) => ({ month: iso(x.m), label: bucketLabel(iso(x.m), "month"), mode: String(x.mode), received: String(x.received) })),
    compliance: { cashNear: list(cashNear), mixedBig: list(mixedBig), noPan: list(noPan), cashLimit: s.cashLimit, panLimit: s.panLimit },
  };
}

/* ── E. GST & compliance (accountant view) ──────────────────────────── */

export async function gst({ period, filters: f }: DashQuery) {
  const fy = financialYear(period.current.to);
  const fyRange: DateRange = { from: `${fy.slice(0, 4)}-04-01`, to: `${Number(fy.slice(0, 4)) + 1}-03-31` };
  const s = await loadSettingsRow();
  const r = period.current;
  const [monthly, numbers, b2b, b2c, b2cl, hsn, noGst, series] = await Promise.all([
    q(sql`select date_trunc('month', ds.date)::date as m, sum(taxable)::numeric(14,2)::text as taxable, sum(cgst)::numeric(14,2)::text as cgst,
             sum(sgst)::numeric(14,2)::text as sgst, sum(igst)::numeric(14,2)::text as igst, sum(invoices)::int as invoices
          from daily_summary ds where ${allRows(fyRange, { ...f, gst: "with" })} group by 1 order by 1`),
    q(sql`select date_trunc('month', i.invoice_date)::date as m,
             (array_agg(i.number order by i.seq asc))[1] as first, (array_agg(i.number order by i.seq desc))[1] as last
          from invoices i where ${invWhere(fyRange, { ...f, gst: "with" })} group by 1`),
    q(sql`select i.customer_gstin as gstin, max(i.customer_name) as name, count(*)::int as invoices,
             sum(i.taxable)::numeric(14,2)::text as taxable, sum(i.cgst+i.sgst+i.igst)::numeric(14,2)::text as tax
          from invoices i where ${invWhere(r, { ...f, gst: "with" })} and i.customer_gstin <> '' group by 1 order by sum(i.taxable) desc`),
    q(sql`select coalesce(nullif(i.place_of_supply,''),'—') as place, count(*)::int as invoices,
             sum(i.taxable)::numeric(14,2)::text as taxable, sum(i.cgst+i.sgst+i.igst)::numeric(14,2)::text as tax
          from invoices i where ${invWhere(r, { ...f, gst: "with" })} and i.customer_gstin = '' group by 1 order by sum(i.taxable) desc`),
    q(sql`select i.id, i.number, i.invoice_date, i.customer_name, i.place_of_supply, i.grand_total::text as amount
          from invoices i where ${invWhere(r, { ...f, gst: "with" })} and i.customer_gstin = '' and i.inter_state
            and i.grand_total > ${s.b2cLargeLimit}::numeric order by i.invoice_date`),
    q(sql`select l.hsn, sum(l.net_g)::numeric(12,3)::text as grams,
             sum(l.amount * i.taxable / nullif(i.items_total,0))::numeric(14,2)::text as taxable,
             sum(l.amount * i.cgst / nullif(i.items_total,0))::numeric(14,2)::text as cgst,
             sum(l.amount * i.sgst / nullif(i.items_total,0))::numeric(14,2)::text as sgst,
             sum(l.amount * i.igst / nullif(i.items_total,0))::numeric(14,2)::text as igst
          from invoice_lines l join invoices i on i.id = l.invoice_id
          where ${invWhere(r, { ...f, gst: "with" })} group by 1 order by 1`),
    q(sql`select date_trunc('month', ds.date)::date as m, sum(invoices)::int as invoices, sum(sales)::numeric(14,2)::text as value
          from daily_summary ds where ${allRows(fyRange, { ...f, gst: "without" })} group by 1 order by 1`),
    q(sql`select series_key, prefix, fy, last_seq from invoice_series where fy = ${fy} or fy is null`),
  ]);

  // Invoice number gaps: numbers issued in each series but no longer present (deleted bills)
  const gaps: { series: string; number: string; deletedBy: string | null; deletedAt: string | null }[] = [];
  for (const srow of series) {
    const key = String(srow.series_key);
    const existing = new Set(
      (await q(sql`select seq from invoices where series_key = ${key}`)).map((x) => Number(x.seq)),
    );
    const prefix = String(srow.prefix);
    const missing: number[] = [];
    for (let n = 1; n <= Number(srow.last_seq) && missing.length < 500; n++) if (!existing.has(n)) missing.push(n);
    if (!missing.length) continue;
    const numbersMissing = missing.map((n) => formatInvoiceNumber(prefix, srow.fy ? fyRange.from : todayIST(), n, srow.fy !== null));
    const audits = await q(sql`
      select a.before->>'number' as number, a.at, u.name from audit_log a left join users u on u.id = a.user_id
      where a.entity = 'invoice' and a.action = 'delete'
        and a.before->>'number' in (${sql.join(numbersMissing.map((n) => sql`${n}`), sql`, `)})`);
    for (const num of numbersMissing) {
      const a = audits.find((x) => x.number === num);
      gaps.push({ series: key.replace("|", " "), number: num, deletedBy: (a?.name as string) ?? null, deletedAt: a?.at ? new Date(a.at as string).toISOString() : null });
    }
  }

  const firstLast = new Map(numbers.map((x) => [iso(x.m), { first: String(x.first), last: String(x.last) }]));
  const months: string[] = [];
  for (let m = fyRange.from; m <= fyRange.to; m = addDays(`${m.slice(0, 7)}-28`, 4).slice(0, 7) + "-01") months.push(m);
  const mm = new Map(monthly.map((x) => [iso(x.m), x]));
  return {
    fy,
    monthly: months.map((m) => {
      const x = mm.get(m);
      const total = x ? (Number(x.cgst) + Number(x.sgst) + Number(x.igst)).toFixed(2) : "0.00";
      return {
        month: m,
        label: bucketLabel(m, "month"),
        taxable: str(x?.taxable),
        cgst: str(x?.cgst),
        sgst: str(x?.sgst),
        igst: str(x?.igst),
        total,
        invoices: Number(x?.invoices ?? 0),
        first: firstLast.get(m)?.first ?? null,
        last: firstLast.get(m)?.last ?? null,
      };
    }),
    b2b: b2b.map((x) => ({ gstin: String(x.gstin), name: String(x.name ?? ""), invoices: Number(x.invoices), taxable: String(x.taxable), tax: String(x.tax) })),
    b2c: b2c.map((x) => ({ place: String(x.place), invoices: Number(x.invoices), taxable: String(x.taxable), tax: String(x.tax) })),
    b2cLarge: b2cl.map((x) => ({ id: String(x.id), number: String(x.number), date: iso(x.invoice_date), name: String(x.customer_name), place: String(x.place_of_supply), amount: String(x.amount) })),
    b2cLargeLimit: s.b2cLargeLimit,
    hsn: hsn.map((x) => ({ hsn: String(x.hsn) || "—", grams: String(x.grams), taxable: str(x.taxable), cgst: str(x.cgst), sgst: str(x.sgst), igst: str(x.igst) })),
    gaps,
    noGst: noGst.map((x) => ({ month: iso(x.m), label: bucketLabel(iso(x.m), "month"), invoices: Number(x.invoices), value: String(x.value) })),
  };
}

/* ── F. Rates & old gold ────────────────────────────────────────────── */

export async function rates({ period, filters: f }: DashQuery) {
  const r = period.current;
  // up to one year of rate history
  const from = r.from < addDays(r.to, -365) ? addDays(r.to, -365) : r.from;
  const [history, intake, realised] = await Promise.all([
    q(sql`select rh.date, rh.label, rh.metal::text as metal, rh.rate_per_g::text as rate, coalesce(p.sort_order, 999) as sort
          from rate_history rh left join purities p on p.id = rh.purity_id
          where rh.date between ${from}::date and ${r.to}::date and rh.rate_per_g is not null order by rh.date`),
    q(sql`select date_trunc('month', ds.date)::date as m, ds.metal, sum(exchange_g)::numeric(12,3)::text as grams,
             sum(exchange_fine_g)::numeric(12,3)::text as fine, sum(exchange_value)::numeric(14,2)::text as value
          from daily_summary ds where ${exchangeRows(r, f)} group by 1,2 order by 1`),
    q(sql`select l.purity_label as purity, l.metal::text as metal,
             (sum(l.rate_per_g * l.net_g) / nullif(sum(l.net_g),0))::numeric(14,2)::text as charged,
             (sum(rh.rate_per_g * l.net_g) / nullif(sum(l.net_g) filter (where rh.rate_per_g is not null),0))::numeric(14,2)::text as master,
             sum(l.net_g)::numeric(12,3)::text as grams
          from invoice_lines l join invoices i on i.id = l.invoice_id
          left join rate_history rh on rh.date = i.invoice_date and lower(rh.label) = lower(l.purity_label)
          where ${invWhere(r, f)} and l.net_g > 0 group by 1,2 order by 2,1`),
  ]);
  // same order as the rate master (and the top-bar pills)
  const sortOf = new Map(history.map((h) => [String(h.label), Number(h.sort)]));
  const labels = [...new Set(history.map((h) => String(h.label)))].sort((a, b) => sortOf.get(a)! - sortOf.get(b)! || a.localeCompare(b));
  const byDate = new Map<string, Record<string, string>>();
  for (const h of history) (byDate.get(iso(h.date)) ?? byDate.set(iso(h.date), {}).get(iso(h.date))!)[String(h.label)] = String(h.rate);
  return {
    rateTrend: {
      series: labels.map((l) => ({ label: l, metal: String(history.find((h) => h.label === l)?.metal ?? "") })),
      points: [...byDate.entries()].map(([date, v]) => ({ date, ...v })),
    },
    intake: intake.map((x) => ({
      month: iso(x.m),
      label: bucketLabel(iso(x.m), "month"),
      metal: String(x.metal),
      grams: String(x.grams),
      fine: String(x.fine),
      value: String(x.value),
      avgTouch: Number(x.grams) ? ((Number(x.fine) / Number(x.grams)) * 100).toFixed(2) : "0.00",
    })),
    realised: realised.map((x) => ({ purity: String(x.purity) || "(no purity)", metal: String(x.metal), charged: x.charged ? String(x.charged) : null, master: x.master ? String(x.master) : null, grams: String(x.grams) })),
  };
}

export const DASHBOARD_PAGES = { overview, sales, customers, payments, gst, rates } as const;
export type DashboardPage = keyof typeof DASHBOARD_PAGES;

export function bucketForDrill(date: string, g: Granularity) {
  return bucketOf(date, g);
}
