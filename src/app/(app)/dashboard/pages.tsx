"use client";
import { ArrowDownRight, ArrowUpRight, Phone, Search } from "lucide-react";
import { useState } from "react";
import { formatDateDMY, formatIndianNumber, toDec } from "@/lib/calc-engine";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { bucketRange, type DateRange, type Granularity } from "@/lib/periods";
import type { customers, gst, overview, payments, rates, sales } from "@/server/dashboard";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import {
  BarList,
  ChartCard,
  Columns,
  DataTable,
  Heatmap,
  KpiGrid,
  KpiTile,
  SERIES,
  TrendLine,
  grams,
  inr,
  inrExact,
  metalColor,
  pct,
} from "@/components/dash/charts";
import type { DashResponse } from "./dashboard";

export type Drill = (extra?: { range?: DateRange; params?: Record<string, string | null>; allDates?: boolean }) => void;
type Res<F extends (...a: never[]) => unknown> = DashResponse<Awaited<ReturnType<F>>>;

const money = (v: unknown) => formatIndianNumber(String(v ?? 0), 2);
const g3 = (v: unknown) => formatIndianNumber(String(v ?? 0), 3);
const shortPurity = (p: string) => p.replace(/^(gold|silver|platinum)\s+/i, "");

/* ── A. Overview ────────────────────────────────────────────────────── */

export function OverviewPage({ res, drill }: { res: Res<typeof overview>; drill: Drill }) {
  const d = res.data;
  const k = d.kpis;
  const prevLabel = "";
  const range = res.period.current;
  const bucketDrill = (row: Record<string, unknown>) => drill({ range: bucketRange(String(row.bucket), d.granularity as Granularity, range) });
  const hasSales = d.trend.some((t) => Number(t.sales) !== 0);
  const hasGrams = d.metalTrend.some((t) => Number(t.gold) || Number(t.silver));
  return (
    <>
      <KpiGrid>
        <KpiTile label="Sales" value={k.sales.value} previous={k.sales.previous} previousLabel={prevLabel} onClick={() => drill()} />
        <KpiTile label="Invoices" value={k.invoices.value} previous={k.invoices.previous} kind="count" previousLabel={prevLabel} onClick={() => drill()} />
        <KpiTile label="Average bill" value={k.avgBill.value} previous={k.avgBill.previous} previousLabel={prevLabel} />
        <KpiTile label="Gold sold" value={k.goldG.value} previous={k.goldG.previous} kind="grams" accent="gold" previousLabel={prevLabel} onClick={() => drill({ params: { metal: "gold" } })} />
        <KpiTile label="Silver sold" value={k.silverG.value} previous={k.silverG.previous} kind="grams" accent="silver" previousLabel={prevLabel} onClick={() => drill({ params: { metal: "silver" } })} />
        <KpiTile label="GST collected" value={k.gst.value} previous={k.gst.previous} previousLabel={prevLabel} onClick={() => drill({ params: { gst: "with" } })} />
        <KpiTile label="Making earned" value={k.making.value} previous={k.making.previous} previousLabel={prevLabel} />
        <KpiTile label="Outstanding dues" value={k.dues.value} previous={k.dues.previous} upIsGood={false} accent="danger" previousLabel="then" onClick={() => drill({ allDates: true, params: { due: "1" } })} />
      </KpiGrid>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ChartCard
          title="Sales trend"
          subtitle={`Grand total per ${d.granularity}; dashed line is the previous period. Click a point to see its invoices.`}
          csvName="sales-trend"
          rows={hasSales ? d.trend.map((t) => ({ period: t.label, sales: t.sales, previous: t.previous ?? "", invoices: t.invoices })) : []}
          legend={[
            { color: SERIES.ink, label: "This period" },
            { color: SERIES.previous, label: "Previous period", dashed: true },
          ]}
        >
          <TrendLine
            data={d.trend.map((t) => ({ ...t, sales: Number(t.sales), previous: t.previous === null ? null : Number(t.previous) }))}
            series={[
              { key: "sales", name: "Sales", color: SERIES.ink },
              { key: "previous", name: "Previous", color: SERIES.previous, dashed: true },
            ]}
            onPointClick={bucketDrill}
          />
        </ChartCard>

        <ChartCard title="Top 5 customers" subtitle="By sales in this period" csvName="top-customers" rows={d.topCustomers.map((c) => ({ customer: c.name || "Walk-in", phone: c.phone ?? "", invoices: c.invoices, sales: c.sales }))}>
          <BarList
            items={d.topCustomers.map((c, i) => ({
              key: c.phone ?? `walkin-${i}`,
              label: c.phone ? c.name || c.phone : "Walk-in (no phone)",
              sub: `${c.invoices} ${c.invoices === 1 ? "bill" : "bills"}`,
              value: c.sales,
            }))}
            onClick={(key) => (key.startsWith("walkin") ? drill() : drill({ params: { phone: key } }))}
          />
        </ChartCard>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ChartCard
          title="Sales mix"
          subtitle="What the bills were made of: metal value, making, stone/other and GST"
          csvName="sales-mix"
          rows={hasSales ? d.salesMix.map((m) => ({ period: m.label, metal_value: m.metalValue, making: m.making, stone_other: m.stone, gst: m.gst })) : []}
          legend={[
            { color: SERIES.c3, label: "Metal value" },
            { color: SERIES.c4, label: "Making" },
            { color: SERIES.c5, label: "Stone / other" },
            { color: SERIES.c6, label: "GST" },
          ]}
        >
          <Columns
            stacked
            data={d.salesMix.map((m) => ({ ...m, metalValue: Number(m.metalValue), making: Number(m.making), stone: Number(m.stone), gst: Number(m.gst) }))}
            series={[
              { key: "metalValue", name: "Metal value", color: SERIES.c3 },
              { key: "making", name: "Making", color: SERIES.c4 },
              { key: "stone", name: "Stone / other", color: SERIES.c5 },
              { key: "gst", name: "GST", color: SERIES.c6 },
            ]}
            onBarClick={bucketDrill}
          />
        </ChartCard>

        <div className="grid gap-4 tab:grid-cols-2">
          <ChartCard title="Gold sold" subtitle={`Net grams per ${d.granularity}`} csvName="gold-grams" rows={hasGrams ? d.metalTrend.map((m) => ({ period: m.label, gold_g: m.gold })) : []} empty="No gold sold in this period">
            <TrendLine height={180} format="grams" data={d.metalTrend.map((m) => ({ ...m, gold: Number(m.gold) }))} series={[{ key: "gold", name: "Gold", color: SERIES.gold }]} onPointClick={(r) => drill({ range: bucketRange(String(r.bucket), d.granularity as Granularity, range), params: { metal: "gold" } })} />
          </ChartCard>
          <ChartCard title="Silver sold" subtitle={`Net grams per ${d.granularity}`} csvName="silver-grams" rows={hasGrams ? d.metalTrend.map((m) => ({ period: m.label, silver_g: m.silver })) : []} empty="No silver sold in this period">
            <TrendLine height={180} format="grams" data={d.metalTrend.map((m) => ({ ...m, silver: Number(m.silver) }))} series={[{ key: "silver", name: "Silver", color: SERIES.silver }]} onPointClick={(r) => drill({ range: bucketRange(String(r.bucket), d.granularity as Granularity, range), params: { metal: "silver" } })} />
          </ChartCard>
        </div>
      </div>

      <ChartCard
        title="Today's rates"
        subtitle={d.rates.date ? `Saved ${formatDateDMY(d.rates.date)}${d.rates.previousDate ? `, compared with ${formatDateDMY(d.rates.previousDate)}` : ""}` : undefined}
        rows={d.rates.rows.map((r) => ({ purity: r.label, rate: r.rate, previous: r.previous ?? "" }))}
        empty="No rates saved yet"
      >
        <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line tab:grid-cols-3 lg:grid-cols-5">
          {d.rates.rows.map((r) => {
            const delta = r.previous ? Number(r.rate) - Number(r.previous) : 0;
            return (
              <li key={r.label} className="bg-surface px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
                  <span aria-hidden className="size-1.5 rounded-full" style={{ background: metalColor(r.metal) }} />
                  {r.label}
                </p>
                <p className="num mt-1 text-[17px] font-semibold text-ink">₹{money(r.rate)}</p>
                <p className={cn("num mt-0.5 flex items-center gap-0.5 text-[12px]", delta > 0 ? "text-ok-deep" : delta < 0 ? "text-danger-deep" : "text-muted")}>
                  {delta > 0 ? <ArrowUpRight className="size-3" aria-hidden /> : delta < 0 ? <ArrowDownRight className="size-3" aria-hidden /> : null}
                  {r.previous ? (delta ? `${delta > 0 ? "+" : "−"}₹${money(Math.abs(delta))}` : "No change") : "—"}
                </p>
              </li>
            );
          })}
        </ul>
      </ChartCard>
    </>
  );
}

/* ── B. Sales & products ────────────────────────────────────────────── */

export function SalesPage({ res, drill }: { res: Res<typeof sales>; drill: Drill }) {
  const d = res.data;
  const [unit, setUnit] = useState<"inr" | "g">("inr");
  const anyBills = d.billSize.some((b) => b.count);
  return (
    <>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ChartCard
          title="Sales by purity"
          subtitle="Line amounts before GST. Click a bar to see the bills with that purity."
          csvName="sales-by-purity"
          rows={d.byPurity.map((p) => ({ metal: p.metal, purity: p.purity, sales: p.sales, net_g: p.grams }))}
        >
          <div className="mb-2 flex justify-end px-2 print:hidden">
            <div role="radiogroup" aria-label="Measure" className="inline-flex rounded-lg border border-line p-0.5 text-[12.5px]">
              {(["inr", "g"] as const).map((u) => (
                <button key={u} role="radio" aria-checked={unit === u} onClick={() => setUnit(u)} className={cn("rounded-md px-2.5 py-1 font-medium", unit === u ? "bg-ink text-white" : "text-ink-3")}>
                  {u === "inr" ? "₹" : "Grams"}
                </button>
              ))}
            </div>
          </div>
          <BarList
            format={unit === "inr" ? "money" : "grams"}
            items={[...d.byPurity]
              .sort((a, b) => Number(unit === "inr" ? b.sales : b.grams) - Number(unit === "inr" ? a.sales : a.grams))
              .map((p) => ({ key: p.purity, label: p.purity, value: unit === "inr" ? p.sales : p.grams, color: metalColor(p.metal) }))}
            onClick={(purity) => drill({ params: { purity } })}
          />
        </ChartCard>

        <ChartCard title="Top items" subtitle="Top 15 descriptions by sales (names matched without case)" csvName="top-items" rows={d.byItem.map((i) => ({ item: i.description, count: i.count, sales: i.sales }))}>
          <BarList
            items={d.byItem.map((i) => ({ key: i.description, label: i.description, sub: `× ${i.count}`, value: i.sales }))}
            onClick={(q) => drill({ params: { q } })}
          />
        </ChartCard>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ChartCard title="Bill size" subtitle="How many bills fall in each grand-total band" csvName="bill-size" rows={anyBills ? d.billSize.map((b) => ({ band: b.label, bills: b.count, sales: b.sales })) : []}>
          <Columns format="count" data={d.billSize.map((b) => ({ ...b }))} series={[{ key: "count", name: "Bills", color: SERIES.ink }]} />
        </ChartCard>
        <ChartCard
          title="When bills are made"
          subtitle="Invoices by day of week and hour, to plan counter staff"
          csvName="bills-by-hour"
          rows={d.heatmap.map((h) => ({ day: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][h.dow], hour: h.hour, invoices: h.count }))}
        >
          <Heatmap cells={d.heatmap} />
        </ChartCard>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ChartCard
          title="Making charges by purity"
          subtitle="Average making per net gram, and making as % of metal value"
          csvName="making-by-purity"
          rows={d.making.map((m) => ({ purity: m.purity, making: m.making, per_gram: m.perGram, pct_of_metal_value: m.pctOfValue }))}
        >
          <DataTable
            rows={d.making.map((m) => ({ purity: m.purity, making: m.making, perGram: m.perGram, pct: m.pctOfValue }))}
            columns={[
              { key: "purity", label: "Purity" },
              { key: "making", label: "Making earned", align: "right", format: (v) => `₹${money(v)}` },
              { key: "perGram", label: "Per gram", align: "right", format: (v) => `₹${money(v)}` },
              { key: "pct", label: "% of metal value", align: "right", format: (v) => `${formatIndianNumber(String(v), 2)}%` },
            ]}
          />
        </ChartCard>
        <ChartCard title="Discounts" subtitle="Discount given each month, and as % of net sales" csvName="discounts" rows={d.discount.filter((x) => Number(x.discount)).map((x) => ({ month: x.label, discount: x.discount, pct_of_net_sales: x.pct }))} empty="No discounts in this period">
          <DataTable
            rows={d.discount.map((x) => ({ month: x.label, discount: x.discount, pct: x.pct }))}
            columns={[
              { key: "month", label: "Month" },
              { key: "discount", label: "Discount", align: "right", format: (v) => `₹${money(v)}` },
              { key: "pct", label: "% of net sales", align: "right", format: (v) => `${formatIndianNumber(String(v), 2)}%` },
            ]}
          />
        </ChartCard>
      </div>
    </>
  );
}

/* ── C. Customers & dues ────────────────────────────────────────────── */

export function CustomersPage({ res, drill }: { res: Res<typeof customers>; drill: Drill; qs: string }) {
  const d = res.data as Exclude<Awaited<ReturnType<typeof customers>>, { lookup: unknown }>;
  const k = d.kpis;
  return (
    <>
      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line shadow-hair tab:grid-cols-3">
        <KpiTile label="Unique customers" value={k.unique.value} previous={k.unique.previous} kind="count" previousLabel="" />
        <KpiTile label="Repeat customers (2+ bills)" value={k.repeat.value} previous={k.repeat.previous} kind="count" previousLabel="" />
        <KpiTile label="Walk-in bills (no phone)" value={k.walkIn.value} previous={k.walkIn.previous} kind="count" previousLabel="" />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ChartCard
          title="New and returning customers"
          subtitle="Customers with a bill each month, split by whether it was their first"
          csvName="new-vs-repeat"
          rows={d.newVsRepeat.map((m) => ({ month: m.label, new: m.new, returning: m.repeat }))}
          legend={[
            { color: SERIES.c3, label: "New" },
            { color: SERIES.c4, label: "Returning" },
          ]}
        >
          <Columns stacked format="count" data={d.newVsRepeat} series={[{ key: "new", name: "New", color: SERIES.c3 }, { key: "repeat", name: "Returning", color: SERIES.c4 }]} />
        </ChartCard>
        <ChartCard
          title="Dues by age"
          subtitle="Unpaid balances by how old the bill is (all dates, as of today)"
          csvName="dues-ageing"
          rows={d.ageing.some((a) => a.count) ? d.ageing.map((a) => ({ age: a.label, bills: a.count, dues: a.dues })) : []}
          empty="No dues — every bill is paid"
        >
          <BarList items={d.ageing.map((a) => ({ key: a.label, label: a.label, sub: `${a.count} ${a.count === 1 ? "bill" : "bills"}`, value: a.dues, color: "#dc2626" }))} onClick={() => drill({ allDates: true, params: { due: "1" } })} />
        </ChartCard>
      </div>

      <CustomerLookup />

      <ChartCard title="Top 20 customers" subtitle="By sales in this period. Click a row for their bills." csvName="top-customers" rows={d.top.map((t) => ({ customer: t.name || "Walk-in", phone: t.phone ?? "", invoices: t.invoices, sales: t.sales, last_purchase: t.last, outstanding: t.outstanding }))}>
        <DataTable
          rows={d.top.map((t) => ({ name: t.name || (t.phone ? "—" : "Walk-in"), phone: t.phone ?? "", invoices: t.invoices, sales: t.sales, last: t.last, outstanding: t.outstanding }))}
          onRow={(r) => (r.phone ? drill({ params: { phone: String(r.phone) } }) : drill())}
          columns={[
            { key: "name", label: "Customer" },
            { key: "phone", label: "Phone", format: (v) => <span className="num">{String(v || "—")}</span> },
            { key: "invoices", label: "Bills", align: "right" },
            { key: "sales", label: "Sales", align: "right", format: (v) => `₹${money(v)}` },
            { key: "last", label: "Last purchase", format: (v) => <span className="num">{formatDateDMY(String(v))}</span> },
            { key: "outstanding", label: "Outstanding", align: "right", format: (v) => (toDec(String(v)).gt(0) ? <span className="text-danger-deep">₹{money(v)}</span> : "—") },
          ]}
        />
      </ChartCard>

      <ChartCard title="Bills with a balance due" subtitle="Oldest first, all dates. Call the customer straight from here." csvName="dues" rows={d.dues.map((x) => ({ number: x.number, date: x.date, customer: x.name, phone: x.phone, balance: x.balance, days: x.days }))} empty="No dues — every bill is paid">
        <DataTable
          rows={d.dues.slice(0, 10).map((x) => ({ number: x.number, date: x.date, name: x.name, phone: x.phone, balance: x.balance, days: x.days }))}
          columns={[
            { key: "number", label: "Invoice", format: (v) => <span className="num font-medium text-ink">{String(v)}</span> },
            { key: "date", label: "Date", format: (v) => <span className="num">{formatDateDMY(String(v))}</span> },
            { key: "name", label: "Customer" },
            { key: "days", label: "Days", align: "right" },
            { key: "balance", label: "Balance", align: "right", format: (v) => <span className="text-danger-deep">₹{money(v)}</span> },
            {
              key: "phone",
              label: "",
              format: (v) =>
                v ? (
                  <a href={`tel:${String(v)}`} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[12.5px] font-medium text-ink hover:bg-canvas" onClick={(e) => e.stopPropagation()}>
                    <Phone className="size-3.5" aria-hidden />
                    Call
                  </a>
                ) : null,
            },
          ]}
        />
        {d.dues.length > 10 ? (
          <button onClick={() => drill({ allDates: true, params: { due: "1" } })} className="mt-2 px-1 text-[12.5px] font-medium text-ink-3 hover:text-ink">
            Show all {d.dues.length} bills with a balance in Transactions →
          </button>
        ) : null}
      </ChartCard>
    </>
  );
}

function CustomerLookup() {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Extract<Awaited<ReturnType<typeof customers>>, { lookup: unknown }>["lookup"] | null>(null);
  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-hair tab:p-5">
      <h3 className="tight text-[14.5px] font-semibold text-ink">Customer lookup</h3>
      <p className="mt-0.5 text-[12.5px] text-muted">Lifetime sales, grams bought, bills and dues for one phone number.</p>
      <form
        className="mt-3 flex max-w-md gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await api<{ data: { lookup: NonNullable<typeof data> } }>(`/api/dashboard/customers?lookup=${phone}`);
          setBusy(false);
          if (!r.ok) {
            setError(r.error.message);
            setData(null);
          } else {
            setError(null);
            setData(r.data.data.lookup);
          }
        }}
      >
        <TextInput value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="tel" placeholder="10-digit phone" className="num" aria-label="Phone number" />
        <Button type="submit" variant="primary" loading={busy} disabled={phone.length !== 10}>
          <Search className="size-4" aria-hidden />
          Look up
        </Button>
      </form>
      {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}
      {data ? (
        data.invoices === 0 ? (
          <p className="mt-3 text-[13.5px] text-muted">No bills for {data.phone} yet.</p>
        ) : (
          <div className="mt-4 animate-enter">
            <p className="text-[14px] font-medium text-ink">
              {data.name || "No name on file"} <span className="num text-muted">· {data.phone}</span>
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] tab:grid-cols-6">
              {[
                ["Lifetime sales", inr(data.sales)],
                ["Bills", String(data.invoices)],
                ["Gold bought", grams(data.gold)],
                ["Silver bought", grams(data.silver)],
                ["Dues", toDec(data.dues).gt(0) ? inrExact(data.dues) : "None"],
                ["Customer since", data.first ? formatDateDMY(data.first) : "—"],
              ].map(([l, v]) => (
                <div key={l}>
                  <dt className="text-muted">{l}</dt>
                  <dd className={cn("num font-medium text-ink", l === "Dues" && toDec(data.dues).gt(0) && "text-danger-deep")}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )
      ) : null}
    </section>
  );
}

/* ── D. Payments ────────────────────────────────────────────────────── */

export function PaymentsPage({ res, drill }: { res: Res<typeof payments>; drill: Drill }) {
  const d = res.data;
  const k = d.kpis;
  const months = [...new Set(d.monthly.map((m) => m.month))];
  const modes = [...new Set(d.monthly.map((m) => m.mode))];
  const lists = [
    { key: "cashNear", title: "Cash bills near the limit", note: `Cash received of ₹${formatIndianNumber(toDec(d.compliance.cashLimit).times(0.75).toFixed(0), 0)} or more`, rows: d.compliance.cashNear, params: { mode: "Cash" } },
    { key: "mixedBig", title: "Mixed payments of ₹2 lakh+", note: "Check the cash part stayed below the limit", rows: d.compliance.mixedBig, params: { mode: "Mixed" } },
    { key: "noPan", title: "₹2 lakh+ bills without PAN", note: "Form 60 declaration noted where ticked", rows: d.compliance.noPan, params: {} },
  ] as const;
  return (
    <>
      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line shadow-hair tab:grid-cols-3">
        <KpiTile label="Received" value={k.received.value} previous={k.received.previous} previousLabel="" />
        <KpiTile label="Received in cash" value={k.cash.value} previous={k.cash.previous} previousLabel="" onClick={() => drill({ params: { mode: "Cash" } })} />
        <KpiTile label="Cash share" value={k.cashShare.value} previous={k.cashShare.previous} kind="pct" upIsGood={false} previousLabel="" />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ChartCard title="Received by payment mode" subtitle="Money actually received in this period. Click a mode for its bills." csvName="received-by-mode" rows={d.byMode.map((m) => ({ mode: m.mode, received: m.received, bills: m.invoices }))}>
          <BarList items={d.byMode.map((m) => ({ key: m.mode, label: m.mode, sub: `${m.invoices} ${m.invoices === 1 ? "bill" : "bills"}`, value: m.received }))} onClick={(mode) => drill({ params: { mode } })} />
        </ChartCard>
        <ChartCard title="Monthly by payment mode" subtitle="Received per month, per mode" csvName="monthly-by-mode" rows={d.monthly.map((m) => ({ month: m.label, mode: m.mode, received: m.received }))}>
          <DataTable
            rows={months.map((mo) => {
              const row: Record<string, string> = { month: d.monthly.find((x) => x.month === mo)!.label };
              for (const md of modes) row[md] = d.monthly.find((x) => x.month === mo && x.mode === md)?.received ?? "";
              return row;
            })}
            columns={[
              { key: "month", label: "Month" },
              // compact so all modes fit the card; the exact amount is in the tooltip, the CSV and the table above
              ...modes.map((md) => ({ key: md, label: md, align: "right" as const, format: (v: unknown) => (v ? <span title={inrExact(String(v))}>{inr(String(v))}</span> : "—") })),
            ]}
          />
        </ChartCard>
      </div>

      <section className="rounded-xl border border-line bg-surface p-4 shadow-hair tab:p-5">
        <h3 className="tight text-[14.5px] font-semibold text-ink">Cash compliance</h3>
        <p className="mt-0.5 text-[12.5px] text-muted">Bills to double-check against the income-tax limits. Click a bill number to open its row in Transactions.</p>
        <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-3">
          {lists.map((l) => (
            <div key={l.key} className="bg-surface">
              <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
                <div>
                  <p className="text-[13.5px] font-medium text-ink">{l.title}</p>
                  <p className="text-[12px] text-muted">{l.note}</p>
                </div>
                <span className={cn("num rounded-md px-2 py-0.5 text-[13px] font-semibold", l.rows.length ? "bg-warn-fill text-gold-deep" : "bg-sunken text-muted")}>{l.rows.length}</span>
              </div>
              {l.rows.length ? (
                <ul className="divide-y divide-line">
                  {l.rows.slice(0, 6).map((r) => (
                    <li key={r.id}>
                      <button onClick={() => drill({ params: { ...l.params, q: r.number } })} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-canvas">
                        <span className="min-w-0">
                          <span className="num block font-medium text-ink">{r.number}</span>
                          <span className="block truncate text-[12px] text-muted">
                            {formatDateDMY(r.date)} · {r.name || "Cash customer"}
                            {"form60" in r && r.form60 ? " · Form 60" : ""}
                          </span>
                        </span>
                        <span className="num shrink-0 text-ink-3">₹{money(r.amount)}</span>
                      </button>
                    </li>
                  ))}
                  {l.rows.length > 6 ? (
                    <li>
                      <button onClick={() => drill({ params: l.params })} className="w-full px-3 py-2 text-left text-[12.5px] font-medium text-ink-3 hover:bg-canvas">
                        Show all {l.rows.length} in Transactions →
                      </button>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="px-3 py-4 text-[13px] text-muted">None in this period.</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/* ── E. GST & compliance ────────────────────────────────────────────── */

export function GstPage({ res, drill }: { res: Res<typeof gst>; drill: Drill }) {
  const d = res.data;
  const tot = (k: "taxable" | "cgst" | "sgst" | "igst" | "total") => d.monthly.reduce((a, m) => a.plus(toDec(m[k])), toDec(0)).toFixed(2);
  const totalCount = d.monthly.reduce((a, m) => a + m.invoices, 0);
  const fyFrom = `${d.fy.slice(0, 4)}-04-01`;
  return (
    <>
      <ChartCard
        title={`Monthly GST summary · FY ${d.fy}`}
        subtitle="For GSTR-1 / GSTR-3B preparation. Click a month for its invoices."
        csvName={`gst-summary-${d.fy}`}
        rows={d.monthly.map((m) => ({ month: m.label, taxable: m.taxable, cgst: m.cgst, sgst: m.sgst, igst: m.igst, total_tax: m.total, invoices: m.invoices, first_invoice: m.first ?? "", last_invoice: m.last ?? "" }))}
      >
        <DataTable
          maxHeight={520}
          rows={[
            ...d.monthly.map((m) => ({ ...m })),
            { label: "Total", taxable: tot("taxable"), cgst: tot("cgst"), sgst: tot("sgst"), igst: tot("igst"), total: tot("total"), invoices: totalCount, first: "", last: "", month: "" },
          ]}
          onRow={(r) => {
            if (!r.month) return;
            const from = String(r.month);
            const end = new Date(Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)), 0)).toISOString().slice(0, 10);
            drill({ range: { from: from < fyFrom ? fyFrom : from, to: end }, params: { gst: "with" } });
          }}
          columns={[
            { key: "label", label: "Month", format: (v, r) => <span className={cn(!r.month && "font-semibold text-ink")}>{String(v)}</span> },
            { key: "taxable", label: "Taxable value", align: "right", format: money },
            { key: "cgst", label: "CGST", align: "right", format: money },
            { key: "sgst", label: "SGST", align: "right", format: money },
            { key: "igst", label: "IGST", align: "right", format: money },
            { key: "total", label: "Total tax", align: "right", format: (v) => <span className="font-semibold text-ink">{money(v)}</span> },
            { key: "invoices", label: "Bills", align: "right" },
            { key: "first", label: "First no.", format: (v) => <span className="num">{String(v || "—")}</span> },
            { key: "last", label: "Last no.", format: (v) => <span className="num">{String(v || "—")}</span> },
          ]}
        />
      </ChartCard>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ChartCard title="B2B — customers with a GSTIN" subtitle="One row per GSTIN, this period" csvName="b2b" rows={d.b2b.map((x) => ({ gstin: x.gstin, customer: x.name, invoices: x.invoices, taxable: x.taxable, tax: x.tax }))} empty="No B2B bills in this period">
          <DataTable
            rows={d.b2b.map((x) => ({ ...x }))}
            onRow={(r) => drill({ params: { q: String(r.gstin), gst: "with" } })}
            columns={[
              { key: "gstin", label: "GSTIN", format: (v) => <span className="num">{String(v)}</span> },
              { key: "name", label: "Customer" },
              { key: "invoices", label: "Bills", align: "right" },
              { key: "taxable", label: "Taxable", align: "right", format: money },
              { key: "tax", label: "Tax", align: "right", format: money },
            ]}
          />
        </ChartCard>
        <ChartCard title="B2C — by place of supply" subtitle="Bills without a customer GSTIN, this period" csvName="b2c" rows={d.b2c.map((x) => ({ place_of_supply: x.place, invoices: x.invoices, taxable: x.taxable, tax: x.tax }))} empty="No B2C bills in this period">
          <DataTable
            rows={d.b2c.map((x) => ({ ...x }))}
            columns={[
              { key: "place", label: "Place of supply" },
              { key: "invoices", label: "Bills", align: "right" },
              { key: "taxable", label: "Taxable", align: "right", format: money },
              { key: "tax", label: "Tax", align: "right", format: money },
            ]}
          />
        </ChartCard>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ChartCard
          title="B2C large (inter-state)"
          subtitle={`Inter-state bills without GSTIN above ₹${formatIndianNumber(d.b2cLargeLimit, 0)} — reported separately in GSTR-1`}
          csvName="b2c-large"
          rows={d.b2cLarge.map((x) => ({ number: x.number, date: x.date, customer: x.name, place_of_supply: x.place, amount: x.amount }))}
          empty="None in this period"
        >
          <DataTable
            rows={d.b2cLarge.map((x) => ({ ...x }))}
            onRow={(r) => drill({ params: { q: String(r.number) } })}
            columns={[
              { key: "number", label: "Invoice", format: (v) => <span className="num">{String(v)}</span> },
              { key: "date", label: "Date", format: (v) => <span className="num">{formatDateDMY(String(v))}</span> },
              { key: "place", label: "Place of supply" },
              { key: "amount", label: "Total", align: "right", format: money },
            ]}
          />
        </ChartCard>
        <ChartCard title="HSN summary" subtitle="Per HSN code: grams, taxable value and tax, this period" csvName="hsn-summary" rows={d.hsn.map((h) => ({ hsn: h.hsn, net_g: h.grams, taxable: h.taxable, cgst: h.cgst, sgst: h.sgst, igst: h.igst }))}>
          <DataTable
            rows={d.hsn.map((h) => ({ ...h }))}
            columns={[
              { key: "hsn", label: "HSN", format: (v) => <span className="num">{String(v)}</span> },
              { key: "grams", label: "Quantity (g)", align: "right", format: g3 },
              { key: "taxable", label: "Taxable", align: "right", format: money },
              { key: "cgst", label: "CGST", align: "right", format: money },
              { key: "sgst", label: "SGST", align: "right", format: money },
              { key: "igst", label: "IGST", align: "right", format: money },
            ]}
          />
        </ChartCard>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ChartCard title="Invoice number gaps" subtitle={`Numbers issued in FY ${d.fy} that no longer exist (deleted bills)`} csvName="number-gaps" rows={d.gaps.map((g) => ({ series: g.series, number: g.number, deleted_by: g.deletedBy ?? "", deleted_at: g.deletedAt ?? "" }))} empty="No gaps — every number in the series is present">
          <DataTable
            rows={d.gaps.map((g) => ({ ...g }))}
            columns={[
              { key: "number", label: "Missing number", format: (v) => <span className="num font-medium text-ink">{String(v)}</span> },
              { key: "deletedBy", label: "Deleted by", format: (v) => String(v ?? "Unknown") },
              { key: "deletedAt", label: "When", format: (v) => (v ? <span className="num">{formatDateDMY(String(v).slice(0, 10))}</span> : "—") },
            ]}
          />
        </ChartCard>
        <ChartCard title="Bills without GST" subtitle={`Count and value per month, FY ${d.fy}`} csvName="bills-without-gst" rows={d.noGst.map((x) => ({ month: x.label, bills: x.invoices, value: x.value }))} empty="No bills without GST this year">
          <DataTable
            rows={d.noGst.map((x) => ({ ...x }))}
            columns={[
              { key: "label", label: "Month" },
              { key: "invoices", label: "Bills", align: "right" },
              { key: "value", label: "Value", align: "right", format: money },
            ]}
          />
        </ChartCard>
      </div>
    </>
  );
}

/* ── F. Rates & old gold ────────────────────────────────────────────── */

export function RatesPage({ res }: { res: Res<typeof rates> }) {
  const d = res.data;
  return (
    <>
      {/* one small chart per purity: gold and silver rates differ ~80×, so one shared axis would flatten silver */}
      <ChartCard
        title="Rate trend"
        subtitle="Rate per gram from the rate master history (up to one year), one chart per purity"
        csvName="rate-trend"
        rows={d.rateTrend.points.map((p) => ({ ...p }))}
        empty="No saved rates in this period"
      >
        <div className="grid gap-x-4 gap-y-5 tab:grid-cols-2 lg:grid-cols-3">
          {d.rateTrend.series.map((s) => (
            <div key={s.label}>
              <p className="flex items-center gap-1.5 px-2 text-[12.5px] font-medium text-ink-3">
                <span aria-hidden className="size-1.5 rounded-full" style={{ background: metalColor(s.metal) }} />
                {shortPurity(s.label)}
              </p>
              <TrendLine
                height={150}
                data={d.rateTrend.points.map((p) => ({ label: formatDateDMY(p.date).slice(0, 5), tipLabel: formatDateDMY(p.date), value: (p as Record<string, string>)[s.label] ? Number((p as Record<string, string>)[s.label]) : null }))}
                series={[{ key: "value", name: s.label, color: metalColor(s.metal) }]}
                fitDomain
              />
            </div>
          ))}
        </div>
      </ChartCard>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ChartCard title="Old gold & silver taken in" subtitle="Grams, fine grams, average touch and value per month" csvName="old-metal-intake" rows={d.intake.map((x) => ({ month: x.label, metal: x.metal, grams: x.grams, fine_g: x.fine, avg_touch_pct: x.avgTouch, value: x.value }))} empty="No old metal taken in this period">
          <DataTable
            rows={d.intake.map((x) => ({ ...x }))}
            columns={[
              { key: "label", label: "Month" },
              { key: "metal", label: "Metal", format: (v) => <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-full" style={{ background: metalColor(String(v)) }} />{String(v)}</span> },
              { key: "grams", label: "Weight (g)", align: "right", format: g3 },
              { key: "fine", label: "Fine (g)", align: "right", format: g3 },
              { key: "avgTouch", label: "Avg touch", align: "right", format: (v) => `${formatIndianNumber(String(v), 2)}%` },
              { key: "value", label: "Value", align: "right", format: money },
            ]}
          />
        </ChartCard>
        <ChartCard title="Rate charged vs rate master" subtitle="Average rate per gram on bills (weighted by net grams) vs the master rate that day" csvName="realised-vs-master" rows={d.realised.map((x) => ({ purity: x.purity, charged: x.charged ?? "", master: x.master ?? "", net_g: x.grams }))}>
          <DataTable
            rows={d.realised.map((x) => ({ ...x, diff: x.charged && x.master ? pct(toDec(x.charged).minus(x.master).toFixed(2), x.master) : null }))}
            columns={[
              { key: "purity", label: "Purity", format: (v, r) => <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-full" style={{ background: metalColor(String(r.metal)) }} />{String(v)}</span> },
              { key: "charged", label: "Charged /g", align: "right", format: (v) => (v ? `₹${money(v)}` : "—") },
              { key: "master", label: "Master /g", align: "right", format: (v) => (v ? `₹${money(v)}` : "—") },
              {
                key: "diff",
                label: "Difference",
                align: "right",
                format: (v) => (v === null ? "—" : <span className={cn(Number(v) < -0.05 ? "text-danger-deep" : Number(v) > 0.05 ? "text-ok-deep" : "text-muted")}>{Number(v) > 0 ? "+" : ""}{String(v)}%</span>),
              },
              { key: "grams", label: "Net grams", align: "right", format: g3 },
            ]}
          />
        </ChartCard>
      </div>
    </>
  );
}
