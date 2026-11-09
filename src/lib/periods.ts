/**
 * Dashboard periods (DSH-01/02/05): Asia/Kolkata calendar days, weeks starting
 * Monday, FY April–March. Every period has a "previous equal period" to compare.
 * Pure functions on ISO dates (YYYY-MM-DD), shared by the browser and the API.
 */
import { financialYear, formatDateDMY, isValidIsoDate } from "./calc-engine";

export const PERIODS = ["today", "yesterday", "week", "month", "lastmonth", "fy", "lastfy", "custom"] as const;
export type PeriodKey = (typeof PERIODS)[number];

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  month: "This month",
  lastmonth: "Last month",
  fy: "This FY",
  lastfy: "Last FY",
  custom: "Custom",
};

export interface DateRange {
  from: string;
  to: string;
}

export type Granularity = "day" | "week" | "month";

const toUTC = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUTC = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => fromUTC(toUTC(iso) + n * 86_400_000);
export const daysInclusive = (r: DateRange) => Math.round((toUTC(r.to) - toUTC(r.from)) / 86_400_000) + 1;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based
const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Shift a date by whole months, clamping the day (31 Mar − 1 month → 28/29 Feb). */
function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return ymd(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

function fyStart(iso: string): string {
  return `${financialYear(iso).slice(0, 4)}-04-01`;
}

export interface ResolvedPeriod {
  key: PeriodKey;
  current: DateRange;
  previous: DateRange;
  label: string;
  previousLabel: string;
}

export function rangeLabel(r: DateRange): string {
  return r.from === r.to ? formatDateDMY(r.from) : `${formatDateDMY(r.from)} – ${formatDateDMY(r.to)}`;
}

/** Resolve a period key (and custom dates) to the current and previous ranges. */
export function resolvePeriod(key: PeriodKey, today: string, custom?: Partial<DateRange>): ResolvedPeriod {
  let current: DateRange;
  let previous: DateRange;
  switch (key) {
    case "today":
      current = { from: today, to: today };
      previous = { from: addDays(today, -1), to: addDays(today, -1) };
      break;
    case "yesterday": {
      const y = addDays(today, -1);
      current = { from: y, to: y };
      previous = { from: addDays(y, -1), to: addDays(y, -1) };
      break;
    }
    case "week": {
      const dow = (new Date(toUTC(today)).getUTCDay() + 6) % 7; // Monday = 0
      const from = addDays(today, -dow);
      current = { from, to: today };
      previous = { from: addDays(from, -7), to: addDays(today, -7) };
      break;
    }
    case "month": {
      // month to date vs the same days of last month
      const from = `${today.slice(0, 7)}-01`;
      current = { from, to: today };
      previous = { from: addMonths(from, -1), to: addMonths(today, -1) };
      break;
    }
    case "lastmonth": {
      const from = addMonths(`${today.slice(0, 7)}-01`, -1);
      const [y, m] = from.split("-").map(Number);
      current = { from, to: ymd(y, m, daysInMonth(y, m)) };
      const pf = addMonths(from, -1);
      const [py, pm] = pf.split("-").map(Number);
      previous = { from: pf, to: ymd(py, pm, daysInMonth(py, pm)) };
      break;
    }
    case "fy": {
      const from = fyStart(today);
      current = { from, to: today };
      previous = { from: addMonths(from, -12), to: addMonths(today, -12) };
      break;
    }
    case "lastfy": {
      const from = addMonths(fyStart(today), -12);
      current = { from, to: addDays(fyStart(today), -1) };
      previous = { from: addMonths(from, -12), to: addDays(from, -1) };
      break;
    }
    case "custom":
    default: {
      let from = custom?.from && isValidIsoDate(custom.from) ? custom.from : `${today.slice(0, 7)}-01`;
      let to = custom?.to && isValidIsoDate(custom.to) ? custom.to : today;
      if (from > to) [from, to] = [to, from];
      current = { from, to };
      const n = daysInclusive(current);
      previous = { from: addDays(from, -n), to: addDays(from, -1) };
    }
  }
  return { key, current, previous, label: rangeLabel(current), previousLabel: rangeLabel(previous) };
}

/** Sales trend points: daily up to 62 days, weekly up to ~6 months, then monthly. */
export function granularityFor(r: DateRange): Granularity {
  const n = daysInclusive(r);
  return n <= 62 ? "day" : n <= 190 ? "week" : "month";
}

/** The bucket a date falls in (ISO date of the bucket start). */
export function bucketOf(iso: string, g: Granularity): string {
  if (g === "day") return iso;
  if (g === "month") return `${iso.slice(0, 7)}-01`;
  const dow = (new Date(toUTC(iso)).getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

/** Every bucket start in a range, in order (so empty days still plot as zero). */
export function bucketsIn(r: DateRange, g: Granularity): string[] {
  const out: string[] = [];
  let b = bucketOf(r.from, g);
  while (b <= r.to) {
    out.push(b);
    b = g === "day" ? addDays(b, 1) : g === "week" ? addDays(b, 7) : addMonths(b, 1);
  }
  return out;
}

/** The date range a bucket covers, clipped to the period (for drill-down). */
export function bucketRange(bucket: string, g: Granularity, within: DateRange): DateRange {
  const end = g === "day" ? bucket : g === "week" ? addDays(bucket, 6) : addDays(addMonths(bucket, 1), -1);
  return { from: bucket < within.from ? within.from : bucket, to: end > within.to ? within.to : end };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function bucketLabel(bucket: string, g: Granularity): string {
  const [y, m, d] = bucket.split("-").map(Number);
  if (g === "month") return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
  return `${d} ${MONTHS[m - 1]}`;
}
