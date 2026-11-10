"use client";
import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PAY_MODES, todayIST } from "@/lib/calc-engine";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { PERIODS, PERIOD_LABEL, type DateRange, type PeriodKey } from "@/lib/periods";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Select } from "@/components/ui/field";
import { useSession } from "@/components/shell/session";
import { CustomersPage, GstPage, OverviewPage, PaymentsPage, RatesPage, SalesPage, type Drill } from "./pages";

export const VIEWS = [
  { key: "overview", label: "Overview" },
  { key: "sales", label: "Sales & products" },
  { key: "customers", label: "Customers & dues" },
  { key: "payments", label: "Payments" },
  { key: "gst", label: "GST & compliance" },
  { key: "rates", label: "Rates & old gold" },
] as const;
type View = (typeof VIEWS)[number]["key"];

export interface DashResponse<T> {
  period: { key: PeriodKey; current: DateRange; previous: DateRange; label: string; previousLabel: string };
  filters: { metal?: string; gst?: string; mode?: string };
  data: T;
}

/** §11 — one global filter bar (DSH-01) for pages A–F; every chart drills into Transactions (DSH-03). */
export function Dashboard() {
  const { capabilities } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view = (VIEWS.some((v) => v.key === params.get("view")) ? params.get("view") : "overview") as View;
  const period = ((PERIODS as readonly string[]).includes(params.get("period") ?? "") ? params.get("period") : "month") as PeriodKey;
  const qs = params.toString();

  const [res, setRes] = useState<DashResponse<unknown> | null>(null);
  const [resView, setResView] = useState<View | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const set = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    if (!capabilities.canSeeDashboard) return;
    const p = new URLSearchParams(qs);
    p.delete("view");
    const ctl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api<DashResponse<unknown>>(`/api/dashboard/${view}?${p.toString()}`, { signal: ctl.signal })
      .then((r) => {
        setLoading(false);
        if (!r.ok) return setError(r.error.message);
        setError(null);
        setRes(r.data);
        setResView(view);
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [qs, view, capabilities.canSeeDashboard]);

  /** DSH-03: open Transactions filtered to exactly the invoices behind a mark. */
  const drill: Drill = useCallback(
    (extra = {}) => {
      if (!res) return;
      const p = new URLSearchParams();
      const range = extra.range ?? res.period.current;
      if (!extra.allDates) {
        p.set("from", range.from);
        p.set("to", range.to);
      }
      if (res.filters.metal) p.set("metal", res.filters.metal);
      if (res.filters.gst) p.set("gst", res.filters.gst);
      if (res.filters.mode) p.set("mode", res.filters.mode);
      for (const [k, v] of Object.entries(extra.params ?? {})) if (v) p.set(k, v);
      router.push(`/transactions?${p.toString()}`);
    },
    [res, router],
  );

  if (!capabilities.canSeeDashboard)
    return (
      <div className="mx-auto mt-10 max-w-md rounded-[24px] bg-surface p-7 text-center shadow-card">
        <h1 className="tight text-[18px] font-bold">Dashboards are off for billing staff</h1>
        <p className="mt-1.5 text-[14px] text-muted">The owner can turn them on in Shop settings → Access.</p>
      </div>
    );

  const today = todayIST();
  const ready = res && resView === view;

  return (
    <div className="flex flex-col gap-4 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="tight text-[26px] font-extrabold text-ink tab:text-[30px]">Dashboard</h1>
          <p className="mt-1 text-[14px] text-muted">
            {res ? (
              <>
                <DateRangeText text={res.period.label} /> · compared with <DateRangeText text={res.period.previousLabel} />
              </>
            ) : (
              "Loading…"
            )}
          </p>
        </div>
        <Button onClick={() => window.print()} className="print:hidden">
          <FileText className="size-4" aria-hidden />
          Export PDF
        </Button>
      </div>

      {/* DSH-01 global filter bar */}
      <div className="flex flex-col gap-4 rounded-[24px] bg-surface p-4 shadow-card print:hidden tab:p-5">
        <div role="radiogroup" aria-label="Period" className="flex w-fit max-w-full flex-wrap gap-1 rounded-[20px] bg-sunken p-1 tab:flex-nowrap tab:overflow-x-auto tab:rounded-full tab:[scrollbar-width:none]">
          {PERIODS.map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={period === p}
              onClick={() => set({ period: p === "month" ? null : p, ...(p !== "custom" ? { from: null, to: null } : {}) })}
              className={cn(
                "h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-semibold transition-[background-color,color,box-shadow]",
                period === p ? "bg-surface text-ink shadow-hair" : "text-muted hover:text-ink",
              )}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          {period === "custom" ? (
            <>
              <label className="flex w-[calc(50%-5px)] flex-col gap-1 tab:w-[148px]">
                <span className="text-[13px] font-semibold text-ink-3">From</span>
                <DateField value={params.get("from") ?? res?.period.current.from ?? ""} max={today} onValueChange={(v) => set({ from: v })} />
              </label>
              <label className="flex w-[calc(50%-5px)] flex-col gap-1 tab:w-[148px]">
                <span className="text-[13px] font-semibold text-ink-3">To</span>
                <DateField value={params.get("to") ?? res?.period.current.to ?? ""} max={today} onValueChange={(v) => set({ to: v })} />
              </label>
            </>
          ) : null}
          <Filter label="Metal" value={params.get("metal") ?? ""} onChange={(v) => set({ metal: v })} options={[["", "All metals"], ["gold", "Gold"], ["silver", "Silver"]]} />
          <Filter label="GST" value={params.get("gst") ?? ""} onChange={(v) => set({ gst: v })} options={[["", "All bills"], ["with", "With GST"], ["without", "Without GST"]]} />
          <Filter label="Payment mode" value={params.get("mode") ?? ""} onChange={(v) => set({ mode: v })} options={[["", "All modes"], ...PAY_MODES.map((m) => [m, m] as [string, string])]} />
        </div>
      </div>

      <PageTabs>
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`${pathname}?${(() => {
              const p = new URLSearchParams(qs);
              if (v.key === "overview") p.delete("view");
              else p.set("view", v.key);
              return p.toString();
            })()}`}
            scroll={false}
            aria-current={view === v.key ? "page" : undefined}
            ref={view === v.key ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest" }) : undefined}
            className={cn(
              "flex h-10 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold transition-colors",
              view === v.key ? "bg-ink text-on-ink" : "text-ink-3 hover:bg-surface hover:text-ink",
            )}
          >
            {v.label}
          </Link>
        ))}
      </PageTabs>

      {error ? (
        <p role="alert" className="rounded-[16px] bg-danger-fill px-4 py-3 text-[13.5px] text-danger-deep">
          {error}
        </p>
      ) : null}

      {!ready ? (
        <div aria-busy className="space-y-4">
          <div className="h-36 animate-pulse rounded-[24px] bg-line/50" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-72 animate-pulse rounded-[24px] bg-line/40" />
            <div className="h-72 animate-pulse rounded-[24px] bg-line/40" />
          </div>
        </div>
      ) : (
        // Refetch keeps the frame: the previous render stays, dimmed, until new data lands
        <div className={cn("flex flex-col gap-4 transition-opacity duration-150", loading && "opacity-60")}>
          {view === "overview" ? <OverviewPage res={res as never} drill={drill} /> : null}
          {view === "sales" ? <SalesPage res={res as never} drill={drill} /> : null}
          {view === "customers" ? <CustomersPage res={res as never} drill={drill} qs={qs} /> : null}
          {view === "payments" ? <PaymentsPage res={res as never} drill={drill} /> : null}
          {view === "gst" ? <GstPage res={res as never} drill={drill} /> : null}
          {view === "rates" ? <RatesPage res={res as never} /> : null}
        </div>
      )}
    </div>
  );
}

/** Page tabs; on narrow screens a chevron shows (and scrolls to) tabs that are off to the right. */
function PageTabs({ children }: { children: ReactNode }) {
  const nav = useRef<HTMLElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const check = () => setMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    el.addEventListener("scroll", check, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", check);
    };
  }, []);
  return (
    <div className="relative print:hidden">
      <nav ref={nav} aria-label="Dashboard pages" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pr-12 [scrollbar-width:none] lg:pr-1">
        {children}
      </nav>
      {more ? (
        <button
          type="button"
          onClick={() => nav.current?.scrollBy({ left: 180, behavior: "smooth" })}
          aria-label="More dashboard pages"
          className="absolute top-0 right-0 bottom-0 grid w-12 place-items-center bg-gradient-to-l from-canvas from-60% to-transparent text-ink-3"
        >
          <span className="grid size-8 place-items-center rounded-full bg-surface shadow-card">
            <ChevronRight className="size-4" aria-hidden />
          </span>
        </button>
      ) : null}
    </div>
  );
}

/** "01-10-2026 – 09-10-2026" that wraps between the dates, never inside one. */
function DateRangeText({ text }: { text: string }) {
  const [a, b] = text.split(" – ");
  return (
    <span className="num">
      <span className="whitespace-nowrap">{a}</span>
      {b ? (
        <>
          {" – "}
          <span className="whitespace-nowrap">{b}</span>
        </>
      ) : null}
    </span>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex w-[calc(50%-5px)] flex-col gap-1 tab:w-[150px]">
      <span className="text-[13px] font-semibold text-ink-3">{label}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
    </label>
  );
}
