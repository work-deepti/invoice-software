"use client";
import { FileText } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
      <div className="mx-auto mt-10 max-w-md rounded-xl border border-line bg-surface p-6 text-center shadow-hair">
        <h1 className="tight text-[17px] font-semibold">Dashboards are off for billing staff</h1>
        <p className="mt-1.5 text-[14px] text-muted">The owner can turn them on in Shop settings → Access.</p>
      </div>
    );

  const today = todayIST();
  const ready = res && resView === view;

  return (
    <div className="flex flex-col gap-4 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="tight text-[22px] font-semibold text-ink">Dashboard</h1>
          <p className="mt-0.5 text-[13.5px] text-muted">
            {res ? (
              <>
                <span className="num">{res.period.label}</span> · compared with <span className="num">{res.period.previousLabel}</span>
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
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-hair print:hidden tab:p-4">
        <div role="radiogroup" aria-label="Period" className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
          {PERIODS.map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={period === p}
              onClick={() => set({ period: p === "month" ? null : p, ...(p !== "custom" ? { from: null, to: null } : {}) })}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                period === p ? "bg-ink text-white" : "text-ink-3 hover:bg-sunken",
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
                <span className="text-[12px] font-medium text-ink-3">From</span>
                <DateField value={params.get("from") ?? res?.period.current.from ?? ""} max={today} onValueChange={(v) => set({ from: v })} />
              </label>
              <label className="flex w-[calc(50%-5px)] flex-col gap-1 tab:w-[148px]">
                <span className="text-[12px] font-medium text-ink-3">To</span>
                <DateField value={params.get("to") ?? res?.period.current.to ?? ""} max={today} onValueChange={(v) => set({ to: v })} />
              </label>
            </>
          ) : null}
          <Filter label="Metal" value={params.get("metal") ?? ""} onChange={(v) => set({ metal: v })} options={[["", "All metals"], ["gold", "Gold"], ["silver", "Silver"]]} />
          <Filter label="GST" value={params.get("gst") ?? ""} onChange={(v) => set({ gst: v })} options={[["", "All bills"], ["with", "With GST"], ["without", "Without GST"]]} />
          <Filter label="Payment mode" value={params.get("mode") ?? ""} onChange={(v) => set({ mode: v })} options={[["", "All modes"], ...PAY_MODES.map((m) => [m, m] as [string, string])]} />
        </div>
      </div>

      <nav aria-label="Dashboard pages" className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 print:hidden [scrollbar-width:none]">
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
            className={cn(
              "relative shrink-0 px-3 pt-1.5 pb-2.5 text-[13.5px] font-medium transition-colors",
              view === v.key ? "text-ink after:absolute after:inset-x-3 after:-bottom-px after:h-[2px] after:rounded-full after:bg-gold" : "text-muted hover:text-ink",
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <p role="alert" className="rounded-lg bg-danger-fill px-4 py-3 text-[13.5px] text-danger-deep">
          {error}
        </p>
      ) : null}

      {!ready ? (
        <div aria-busy className="space-y-4">
          <div className="h-28 animate-pulse rounded-xl bg-line/50" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-72 animate-pulse rounded-xl bg-line/40" />
            <div className="h-72 animate-pulse rounded-xl bg-line/40" />
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

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex w-[calc(50%-5px)] flex-col gap-1 tab:w-[150px]">
      <span className="text-[12px] font-medium text-ink-3">{label}</span>
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
