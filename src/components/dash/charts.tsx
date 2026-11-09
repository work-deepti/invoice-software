"use client";
import { ArrowDownRight, ArrowUpRight, Download, Minus, Table2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatCompactINR, formatINR, formatIndianNumber, toDec } from "@/lib/calc-engine";
import { cn } from "@/lib/cn";
import { Flash } from "@/components/invoice/ticker";

/* ── palette (validated with the dataviz validator: light + dark, adjacent pairs) ──
   1 amber = gold, 2 steel = silver (identity, never reused for anything else);
   3–7 for non-metal categories, always assigned in this fixed order. */
export const SERIES = {
  gold: "#c2700a",
  silver: "#3d6fb0",
  c3: "#12a37a",
  c4: "#8a5cc7",
  c5: "#d0527a",
  c6: "#5f8f1f",
  c7: "#1b7fb8",
  ink: "#334155",
  previous: "#94a3b8",
  grid: "#eef2f6",
  axis: "#94a3b8",
} as const;

export const metalColor = (metal: string) => (metal === "Gold" ? SERIES.gold : metal === "Silver" ? SERIES.silver : SERIES.c4);

/* ── formatting ─────────────────────────────────────────────────────── */

export const inr = (v: string | number) => formatCompactINR(v);
export const inrExact = (v: string | number) => formatINR(v);
export const grams = (v: string | number) => `${formatIndianNumber(v, 3)} g`;
const axisInr = (v: number) => (Math.abs(v) >= 100000 ? formatCompactINR(v) : `₹${formatIndianNumber(v, 0)}`);
const axisNum = (v: number) => formatIndianNumber(v, 0);

/* ── CSV (DSH-06) ───────────────────────────────────────────────────── */

export type CsvRow = Record<string, string | number | null | undefined>;

export function downloadCsv(name: string, rows: CsvRow[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [cols.map(esc).join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n");
  const blob = new Blob(["﻿", body], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ── KPI tile (DSH-02) ──────────────────────────────────────────────── */

export function KpiTile({
  label,
  value,
  previous,
  kind = "money",
  upIsGood = true,
  accent,
  previousLabel,
  onClick,
}: {
  label: string;
  value: string;
  previous: string;
  kind?: "money" | "count" | "grams" | "pct";
  upIsGood?: boolean;
  accent?: "gold" | "silver" | "danger";
  previousLabel: string;
  onClick?: () => void;
}) {
  const v = Number(value);
  const p = Number(previous);
  const fmt = (x: string) =>
    kind === "money" ? inr(x) : kind === "grams" ? grams(x) : kind === "pct" ? `${formatIndianNumber(x, 1)}%` : formatIndianNumber(x, 0);
  const exact = kind === "money" ? inrExact(value) : undefined;
  const change = p === 0 ? (v === 0 ? 0 : null) : ((v - p) / Math.abs(p)) * 100;
  const up = change !== null && change > 0;
  const flat = change === 0;
  const good = flat ? null : change === null ? null : up === upIsGood;
  const Body = onClick ? "button" : "div";
  return (
    <Body
      onClick={onClick}
      className={cn("flex min-w-0 flex-col bg-surface px-4 py-3.5 text-left", onClick && "transition-colors hover:bg-canvas focus-visible:bg-canvas")}
      title={exact}
    >
      <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
        {accent === "gold" ? <span aria-hidden className="size-1.5 rounded-full bg-gold" /> : null}
        {accent === "silver" ? <span aria-hidden className="size-1.5 rounded-full" style={{ background: SERIES.silver }} /> : null}
        {label}
      </span>
      <span className={cn("num tight mt-1.5 truncate text-[22px] leading-none font-semibold text-ink", accent === "danger" && v > 0 && "text-danger-deep")}>
        {/* the world's signature move: a figure that changed flashes amber once */}
        <Flash value={value}>{fmt(value)}</Flash>
      </span>
      <span className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-muted">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded px-1 py-px font-medium",
            good === true && "bg-ok-fill text-ok-deep",
            good === false && "bg-danger-fill text-danger-deep",
            good === null && "bg-sunken text-muted",
          )}
        >
          {flat ? <Minus className="size-3" aria-hidden /> : change === null ? null : up ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
          <span className="num">{change === null ? "new" : `${formatIndianNumber(Math.abs(change), 1)}%`}</span>
        </span>
        <span className="truncate">
          vs <span className="num">{fmt(previous)}</span> {previousLabel}
        </span>
      </span>
    </Body>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  // DSH-10: 4 per row on desktop, 2 on phones
  return <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line shadow-hair lg:grid-cols-4">{children}</section>;
}

/* ── chart card (title, table view, CSV, empty state) ───────────────── */

export function ChartCard({
  title,
  subtitle,
  csvName,
  rows,
  columns,
  empty,
  children,
  className,
  legend,
}: {
  title: string;
  subtitle?: string;
  csvName?: string;
  rows: CsvRow[];
  columns?: { key: string; label: string; align?: "right"; format?: (v: unknown, row: CsvRow) => ReactNode }[];
  empty?: string;
  children: ReactNode;
  className?: string;
  legend?: { color: string; label: string; dashed?: boolean }[];
}) {
  const [table, setTable] = useState(false);
  const isEmpty = rows.length === 0;
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]).map((k) => ({ key: k, label: k })) : []);
  return (
    <section className={cn("print-keep flex min-w-0 flex-col rounded-xl border border-line bg-surface shadow-hair", className)}>
      <header className="flex items-start justify-between gap-3 px-4 pt-4 tab:px-5">
        <div className="min-w-0">
          <h3 className="tight text-[14.5px] font-semibold text-ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p> : null}
        </div>
        {!isEmpty ? (
          <div className="flex shrink-0 gap-0.5 print:hidden">
            {columns !== undefined || rows.length ? (
              <button
                onClick={() => setTable((t) => !t)}
                aria-pressed={table}
                title={table ? "Show chart" : "Show as table"}
                className={cn("grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink", table && "bg-sunken text-ink")}
              >
                <Table2 className="size-4" aria-hidden />
                <span className="sr-only">{table ? "Show chart" : "Show as table"}</span>
              </button>
            ) : null}
            {csvName ? (
              <button
                onClick={() => downloadCsv(csvName, rows)}
                title="Download CSV"
                className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                <Download className="size-4" aria-hidden />
                <span className="sr-only">Download CSV</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </header>
      {legend && !isEmpty && !table ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-2 text-[12px] text-ink-3 tab:px-5">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-[2px] w-3.5 rounded"
                style={l.dashed ? { backgroundImage: `linear-gradient(90deg, ${l.color} 60%, transparent 0)`, backgroundSize: "5px 2px" } : { background: l.color, height: 8, width: 8, borderRadius: 2 }}
              />
              {l.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="min-h-0 flex-1 px-2 pt-3 pb-4 tab:px-3">
        {isEmpty ? (
          <p className="grid h-40 place-items-center rounded-lg border border-dashed border-line text-[13px] text-muted">{empty ?? "No sales in this period"}</p>
        ) : table ? (
          <DataTable rows={rows} columns={cols} />
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export function DataTable({
  rows,
  columns,
  onRow,
  maxHeight,
}: {
  rows: CsvRow[];
  columns: { key: string; label: string; align?: "right"; format?: (v: unknown, row: CsvRow) => ReactNode }[];
  onRow?: (row: CsvRow) => void;
  maxHeight?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // a table that genuinely has to scroll sideways shows a fade at the edge that hides columns
    const check = () => setMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    el.addEventListener("scroll", check, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", check);
    };
  }, [rows.length]);
  return (
    <div
      ref={box}
      className={cn("overflow-auto rounded-lg border border-line", more && "[mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]")}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-[1]">
          <tr className="bg-sunken text-left text-[11.5px] font-medium text-muted">
            {columns.map((c) => (
              <th key={c.key} className={cn("px-3 py-2 font-medium whitespace-nowrap", c.align === "right" && "text-right")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              onClick={onRow ? () => onRow(r) : undefined}
              className={cn("border-t border-line", onRow && "cursor-pointer hover:bg-canvas")}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("px-3 py-2 whitespace-nowrap text-ink-3", c.align === "right" && "num text-right")}>
                  {c.format ? c.format(r[c.key], r) : (r[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── tooltip ────────────────────────────────────────────────────────── */

type TipFormat = (v: number) => string;

function Tip({ active, payload, label, format }: TooltipContentProps & { format: TipFormat }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] shadow-pop">
      <p className="mb-1 text-muted">{(payload[0]?.payload as { tipLabel?: string })?.tipLabel ?? label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-ink-3">
            <span aria-hidden className="inline-block h-[2px] w-3 rounded" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="num font-semibold text-ink">{p.value === null || p.value === undefined ? "—" : format(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

const axisProps = {
  tick: { fill: SERIES.axis, fontSize: 11, fontFamily: "var(--font-figtree)", fontVariantNumeric: "tabular-nums" },
  tickLine: false,
  axisLine: false,
} as const;

/** Round a fitted range outward to "nice" steps (1, 2, 2.5, 5 × 10ⁿ) with about `count` intervals. */
export function niceScale(min: number, max: number, count = 4): { domain: [number, number]; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { domain: [0, 1], ticks: [0, 1] };
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.01);
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  // 2.5 × 10ⁿ only when it stays a whole number, so whole-rupee ticks never round (97.5 → "98")
  const steps = mag >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10];
  const step = (steps.find((m) => m * mag >= raw) ?? 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Number(t.toFixed(6)));
  return { domain: [lo, hi], ticks };
}

/* ── line: sales trend with the previous period dashed ──────────────── */

export function TrendLine({
  data,
  series,
  format = "money",
  height = 240,
  onPointClick,
  fitDomain,
}: {
  data: Record<string, unknown>[];
  series: { key: string; name: string; color: string; dashed?: boolean }[];
  format?: "money" | "grams" | "count";
  height?: number;
  onPointClick?: (row: Record<string, unknown>) => void;
  /** Fit the y-axis to the data's own range (rates) instead of starting at zero. */
  fitDomain?: boolean;
}) {
  const f: TipFormat = format === "money" ? (v) => inrExact(v) : format === "grams" ? (v) => grams(v) : (v) => formatIndianNumber(v, 0);
  const values = fitDomain
    ? data.flatMap((d) => series.map((s) => d[s.key])).filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    : [];
  const fitted = fitDomain && values.length ? niceScale(Math.min(...values), Math.max(...values)) : null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 28, bottom: 0, left: 4 }}
        onClick={(s) => {
          const i = s?.activeIndex;
          if (onPointClick && i !== undefined && i !== null) onPointClick(data[Number(i)]);
        }}
        style={{ cursor: onPointClick ? "pointer" : undefined }}
      >
        <CartesianGrid vertical={false} stroke={SERIES.grid} />
        <XAxis dataKey="label" {...axisProps} minTickGap={16} />
        <YAxis
          {...axisProps}
          width={64}
          tickFormatter={format === "money" ? axisInr : axisNum}
          domain={fitted ? fitted.domain : undefined}
          ticks={fitted ? fitted.ticks : undefined}
          interval={fitted ? 0 : undefined}
        />
        <Tooltip content={(p) => <Tip {...(p as TooltipContentProps)} format={f} />} cursor={{ stroke: SERIES.axis, strokeWidth: 1 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? "4 4" : undefined}
            dot={false}
            activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
            isAnimationActive={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── columns (stacked or single) ────────────────────────────────────── */

export function Columns({
  data,
  series,
  format = "money",
  height = 240,
  stacked,
  layout = "horizontal",
  categoryKey = "label",
  onBarClick,
}: {
  data: Record<string, unknown>[];
  series: { key: string; name: string; color: string }[];
  format?: "money" | "grams" | "count";
  height?: number;
  stacked?: boolean;
  layout?: "horizontal" | "vertical";
  categoryKey?: string;
  onBarClick?: (row: Record<string, unknown>) => void;
}) {
  const f: TipFormat = format === "money" ? (v) => inrExact(v) : format === "grams" ? (v) => grams(v) : (v) => formatIndianNumber(v, 0);
  const tickF = format === "money" ? axisInr : axisNum;
  const vertical = layout === "vertical";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={vertical ? "vertical" : "horizontal"} margin={{ top: 8, right: 28, bottom: 0, left: 4 }} barCategoryGap="28%">
        <CartesianGrid vertical={vertical} horizontal={!vertical} stroke={SERIES.grid} />
        {vertical ? (
          <>
            <XAxis type="number" {...axisProps} tickFormatter={tickF} />
            <YAxis type="category" dataKey={categoryKey} {...axisProps} tick={{ ...axisProps.tick, fontFamily: "var(--font-figtree)" }} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey={categoryKey} {...axisProps} minTickGap={8} />
            <YAxis {...axisProps} width={64} tickFormatter={tickF} />
          </>
        )}
        <Tooltip content={(p) => <Tip {...(p as TooltipContentProps)} format={f} />} cursor={{ fill: "rgba(148,163,184,0.12)" }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            stackId={stacked ? "a" : undefined}
            maxBarSize={24}
            radius={stacked && i < series.length - 1 ? 0 : vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            stroke="#fff"
            strokeWidth={stacked ? 2 : 0}
            isAnimationActive={false}
            onClick={onBarClick ? (d) => onBarClick((d as unknown as { payload: Record<string, unknown> }).payload) : undefined}
            style={{ cursor: onBarClick ? "pointer" : undefined }}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── bar list (ranked, HTML) ────────────────────────────────────────── */

export function BarList({
  items,
  format = "money",
  onClick,
}: {
  items: { key: string; label: ReactNode; sub?: ReactNode; value: string; color?: string }[];
  format?: "money" | "grams" | "count";
  onClick?: (key: string) => void;
}) {
  const max = Math.max(...items.map((i) => Math.abs(Number(i.value))), 1);
  const f = (v: string) => (format === "money" ? inr(v) : format === "grams" ? grams(v) : formatIndianNumber(v, 0));
  return (
    <ol className="flex flex-col gap-2.5 px-2">
      {items.map((it) => {
        const pct = (Math.abs(Number(it.value)) / max) * 100;
        const Row = onClick ? "button" : "div";
        return (
          <li key={it.key}>
            <Row
              onClick={onClick ? () => onClick(it.key) : undefined}
              className={cn("group block w-full rounded-md text-left", onClick && "-mx-1 px-1 py-0.5 transition-colors hover:bg-canvas")}
              title={format === "money" ? inrExact(it.value) : undefined}
            >
              <span className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-ink">
                  {it.label}
                  {it.sub ? <span className="ml-1.5 text-[12px] text-muted">{it.sub}</span> : null}
                </span>
                <span className="num shrink-0 font-medium text-ink">{f(it.value)}</span>
              </span>
              <span className="mt-1 block h-1.5 rounded-full bg-sunken">
                <span className="block h-full rounded-full transition-[width] duration-150" style={{ width: `${pct === 0 ? 0 : Math.max(pct, 1.5)}%`, background: it.color ?? SERIES.ink }} />
              </span>
            </Row>
          </li>
        );
      })}
    </ol>
  );
}

/* ── heatmap (day of week × hour) ───────────────────────────────────── */

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEAT = ["#f1f5f9", "#d6e2f1", "#adc5e3", "#7fa3d1", "#4f7fbd", "#2f5d99"]; // one hue, light → dark

export function Heatmap({ cells }: { cells: { dow: number; hour: number; count: number }[] }) {
  const max = Math.max(...cells.map((c) => c.count), 1);
  const hours = cells.length ? [Math.min(...cells.map((c) => c.hour), 9), Math.max(...cells.map((c) => c.hour), 20)] : [9, 20];
  const range = Array.from({ length: hours[1] - hours[0] + 1 }, (_, i) => hours[0] + i);
  const at = (d: number, h: number) => cells.find((c) => c.dow === d && c.hour === h)?.count ?? 0;
  return (
    <div className="overflow-x-auto px-2">
      <table className="border-separate border-spacing-[3px] text-[11.5px]">
        <thead>
          <tr>
            <th />
            {range.map((h) => (
              <th key={h} className="num w-7 font-normal text-faint">
                {h % 3 === 0 ? h : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DOW.map((d, di) => (
            <tr key={d}>
              <th className="pr-1.5 text-left font-normal text-muted">{d}</th>
              {range.map((h) => {
                const n = at(di + 1, h);
                const step = n === 0 ? 0 : Math.min(HEAT.length - 1, 1 + Math.floor((n / max) * (HEAT.length - 2)));
                return (
                  <td
                    key={h}
                    tabIndex={n ? 0 : -1}
                    title={`${d} ${String(h).padStart(2, "0")}:00–${String(h + 1).padStart(2, "0")}:00 · ${n} ${n === 1 ? "invoice" : "invoices"}`}
                    className="h-6 w-7 rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
                    style={{ background: HEAT[step] }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted">
        Fewer
        {HEAT.map((c) => (
          <span key={c} className="inline-block size-3 rounded-[3px]" style={{ background: c }} />
        ))}
        More invoices
      </p>
    </div>
  );
}

export const pct = (a: string | number, b: string | number) => (toDec(b).isZero() ? "0.0" : toDec(a).div(toDec(b)).times(100).toFixed(1));
