"use client";
import { DropdownMenu } from "radix-ui";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileDown,
  MoreHorizontal,
  Pencil,
  Printer,
  Search,
  Trash2,
  X,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDateDMY, formatINR, formatIndianNumber, formatWeight, todayIST, toDec } from "@/lib/calc-engine";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { LedgerRow, LedgerSummary } from "@/server/invoices";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { Dialog } from "@/components/ui/dialog";
import { Select, TextInput, controlBase } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { InvoicePreviewDialog } from "@/components/invoice/preview-dialog";
import { usePrint } from "@/components/invoice/print";
import type { SavedInvoice, Serialized } from "@/components/invoice/types";
import { CancelInvoiceDialog } from "@/components/invoice/workspace";
import { useSession } from "@/components/shell/session";
import { BackupRestore } from "./backup-restore";

type Row = Serialized<LedgerRow>;
interface ListResponse {
  rows: Row[];
  page: number;
  pageSize: number;
  total: number;
  summary: LedgerSummary;
}

const FILTER_KEYS = ["q", "from", "to", "metal", "gst", "due", "status", "purity", "mode", "phone"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const money = (v: string) => formatIndianNumber(v, 2);

/** §9 — the ledger: server-filtered, URL-synced (TXN-04), 50 per page (TXN-05). */
export function Ledger() {
  const { capabilities } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const print = usePrint();

  const qs = params.toString();
  const get = (k: FilterKey) => params.get(k) ?? "";

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SavedInvoice | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SavedInvoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [reload, setReload] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const setParams = useCallback(
    (patch: Partial<Record<FilterKey | "page", string | null>>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (!("page" in patch)) next.delete("page");
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    const ctl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api<ListResponse>(`/api/invoices${qs ? `?${qs}` : ""}`, { signal: ctl.signal })
      .then((r) => {
        if (r.ok) {
          setData(r.data);
          setError(null);
        } else setError(r.error.message);
        setLoading(false);
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [qs, reload]);

  const openInvoice = async (id: string, then: (inv: SavedInvoice) => void) => {
    const r = await api<{ invoice: SavedInvoice }>(`/api/invoices/${id}`);
    if (r.ok) then(r.data.invoice);
    else toast(r.error.message, "error");
  };

  const today = todayIST();
  const monthStart = `${today.slice(0, 7)}-01`;
  const activeChips = (["purity", "mode", "phone"] as const).filter((k) => get(k));
  const anyFilter = FILTER_KEYS.some((k) => get(k));
  const filterCount = FILTER_KEYS.filter((k) => k !== "q" && get(k)).length;

  return (
    <div className="flex flex-col gap-4 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="tight text-[26px] font-extrabold text-ink tab:text-[30px]">Transactions</h1>
          <p className="mt-1 text-[14px] text-muted">Every saved invoice, newest first. Filters stay in the address bar, so you can bookmark a view.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportMenu qs={qs} isOwner={capabilities.isOwner} />
          {capabilities.isOwner ? <BackupRestore onRestored={() => setReload((n) => n + 1)} /> : null}
        </div>
      </div>

      {/* TXN-01..03 filters — one row above what they scope */}
      <Card className="p-4 tab:p-5">
        <div className="flex flex-wrap items-end gap-2.5">
          <SearchBox value={get("q")} onChange={(v) => setParams({ q: v })} />
          {/* phones: filters fold away behind one pill so the list starts sooner */}
          <Button className="h-11 tab:hidden" variant={filtersOpen ? "primary" : "secondary"} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
            <SlidersHorizontal className="size-4" aria-hidden />
            Filters{filterCount ? <span className="num grid size-5 place-items-center rounded-full bg-lav text-[11px] text-white">{filterCount}</span> : null}
          </Button>
          <div className={cn("contents", !filtersOpen && "max-tab:hidden")}>
          <label className="flex w-[calc(50%-5px)] flex-col gap-1 tab:w-[148px]">
            <span className="text-[13px] font-semibold text-ink-3">From</span>
            <DateField value={get("from")} max={today} onValueChange={(v) => setParams({ from: v })} aria-label="From date" />
          </label>
          <label className="flex w-[calc(50%-5px)] flex-col gap-1 tab:w-[148px]">
            <span className="text-[13px] font-semibold text-ink-3">To</span>
            <DateField value={get("to")} max={today} onValueChange={(v) => setParams({ to: v })} aria-label="To date" />
          </label>
          <FilterSelect label="Metal" value={get("metal")} onChange={(v) => setParams({ metal: v })} options={[["", "All"], ["gold", "Gold"], ["silver", "Silver"]]} />
          <FilterSelect label="GST" value={get("gst")} onChange={(v) => setParams({ gst: v })} options={[["", "All"], ["with", "With GST"], ["without", "Without GST"]]} />
          <FilterSelect label="Payment" value={get("due") ? "1" : ""} onChange={(v) => setParams({ due: v })} options={[["", "All"], ["1", "Balance due"]]} />
          <FilterSelect label="Status" value={get("status")} onChange={(v) => setParams({ status: v })} options={[["", "All"], ["active", "Active"], ["cancelled", "Cancelled"]]} />
          <div className="flex gap-1.5 pb-1.5">
            <Button size="sm" variant={get("from") === today && get("to") === today ? "primary" : "secondary"} onClick={() => setParams({ from: today, to: today })}>
              Today
            </Button>
            <Button size="sm" variant={get("from") === monthStart && get("to") === today ? "primary" : "secondary"} onClick={() => setParams({ from: monthStart, to: today })}>
              This month
            </Button>
            <Button size="sm" variant="ghost" disabled={!anyFilter} onClick={() => router.replace(pathname, { scroll: false })}>
              Clear
            </Button>
          </div>
          </div>
        </div>
        {activeChips.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
            {activeChips.map((k) => (
              <button
                key={k}
                onClick={() => setParams({ [k]: null })}
                className="inline-flex items-center gap-1.5 rounded-full bg-lav-fill px-3 py-1.5 text-[12.5px] font-medium text-lav-deep transition-colors hover:bg-[#e3ddfb]"
              >
                {k === "purity" ? "Purity" : k === "mode" ? "Mode" : "Phone"}: <span className="font-medium text-ink">{get(k)}</span>
                <X className="size-3" aria-label="Remove filter" />
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      {/* §9.2 summary tiles for the filtered set */}
      <SummaryStrip summary={data?.summary} />

      {error ? (
        <p role="alert" className="rounded-[16px] bg-danger-fill px-4 py-3 text-[13.5px] text-danger-deep">
          {error}
        </p>
      ) : null}

      <Card className={cn("overflow-hidden transition-opacity duration-150", loading && data && "opacity-60")} aria-busy={loading}>
        {!data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-[14px] bg-line/40" />
            ))}
          </div>
        ) : data.rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-[15px] font-medium text-ink">{anyFilter ? "No invoices match these filters" : "No invoices yet"}</p>
            <p className="mt-1 text-[13.5px] text-muted">
              {anyFilter ? "Try a wider date range, or clear the filters." : "Saved bills appear here, newest first."}
            </p>
            {anyFilter ? (
              <Button className="mt-4" onClick={() => router.replace(pathname, { scroll: false })}>
                Clear filters
              </Button>
            ) : capabilities.canBill ? (
              <Link href="/invoices/new" className="mt-4 inline-flex h-10 items-center rounded-full bg-ink px-5 text-[14px] font-semibold text-white">
                Make the first invoice
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <LedgerTable
              rows={data.rows}
              onView={(r) => void openInvoice(r.id, setPreview)}
              onPrint={(r) => void openInvoice(r.id, (inv) => print(inv))}
              onCancel={(r) => void openInvoice(r.id, setCancelTarget)}
              onDelete={setDeleteTarget}
            />
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setParams({ page: String(p) })} />
          </>
        )}
      </Card>

      <InvoicePreviewDialog invoice={preview} open={!!preview} onOpenChange={(v) => !v && setPreview(null)} onCancelInvoice={setCancelTarget} />
      <CancelInvoiceDialog
        invoice={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onDone={(inv) => {
          setCancelTarget(null);
          if (preview) setPreview(inv);
          toast(
            <>
              Cancelled <span className="num font-medium">{inv.number}</span>
            </>,
          );
          setReload((n) => n + 1);
        }}
      />
      <DeleteDialog
        row={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(number) => {
          setDeleteTarget(null);
          // TXN-10: deleting the open preview closes it
          if (preview?.number === number) setPreview(null);
          toast(
            <>
              Deleted <span className="num font-medium">{number}</span>
            </>,
          );
          setReload((n) => n + 1);
        }}
      />
    </div>
  );
}

/* ── filters ─────────────────────────────────────────────────────────── */

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setText(value);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  return (
    <label className="flex min-w-[170px] flex-[1_1_170px] tab:flex-[1_1_260px] flex-col gap-1">
      <span className="text-[13px] font-semibold text-ink-3">Search</span>
      <span className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <TextInput
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => onChange(v.trim()), 250);
          }}
          placeholder="Number, name, phone, GSTIN, PAN, bank, item…"
          className="pl-9"
          type="search"
        />
      </span>
    </label>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex w-[calc(50%-5px)] flex-col gap-1 tab:w-[128px]">
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

/* ── summary tiles ───────────────────────────────────────────────────── */

function SummaryStrip({ summary }: { summary?: LedgerSummary }) {
  if (!summary)
    return (
      <section aria-label="Totals for these filters" aria-busy className="grid gap-3 tab:grid-cols-2 desk:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))]">
        <div className="h-[132px] animate-pulse rounded-[24px] bg-ink/85" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[132px] animate-pulse rounded-[24px] bg-line/50" />
        ))}
      </section>
    );
  const due = toDec(summary.balanceDue).gt(0);
  const tiles: { label: string; value: string; tone: string; ink: string; note?: string }[] = [
    { label: "Gold sold", value: formatWeight(summary.goldG), tone: "bg-gold-fill", ink: "text-gold-deep" },
    { label: "Silver sold", value: formatWeight(summary.silverG), tone: "bg-silver-fill", ink: "text-silver-deep" },
    { label: "Old metal taken", value: formatINR(summary.exchange), tone: "bg-peach-fill", ink: "text-[#a64b1e]" },
    due
      ? { label: "Balance due", value: formatINR(summary.balanceDue), tone: "bg-rose-fill", ink: "text-danger-deep" }
      : { label: "Balance due", value: formatINR(summary.balanceDue), tone: "bg-mint-fill", ink: "text-ok-deep", note: "All paid" },
  ];
  return (
    <section aria-label="Totals for these filters" className="grid grid-cols-2 gap-3 desk:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))]">
      {/* hero: the wallet-style balance card */}
      <div className="col-span-2 flex flex-col justify-between rounded-[24px] bg-ink p-5 text-white shadow-dock desk:col-span-1">
        <p className="text-[13px] font-semibold text-white/60">Total billed</p>
        <p className="num tight mt-1 truncate text-[30px] font-extrabold tracking-[-0.025em] desk:text-[26px] min-[1500px]:text-[30px]">{formatINR(summary.totalBilled)}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[12.5px]">
          <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold">
            <span className="num">{formatIndianNumber(summary.invoices, 0)}</span> {summary.invoices === 1 ? "invoice" : "invoices"}
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold">
            GST <span className="num">{formatINR(summary.gstCollected)}</span>
          </span>
        </div>
      </div>
      {tiles.map((t) => (
        <div key={t.label} className={cn("flex min-w-0 flex-col justify-between rounded-[24px] p-4 tab:p-5", t.tone)}>
          <p className={cn("text-[13px] font-semibold", t.ink)}>{t.label}</p>
          <div>
            <p className="num tight mt-3 truncate text-[20px] font-extrabold text-ink tab:text-[22px] desk:text-[18px] min-[1500px]:text-[22px]">{t.value}</p>
            {t.note ? <p className={cn("mt-0.5 text-[12.5px] font-semibold", t.ink)}>{t.note}</p> : null}
          </div>
        </div>
      ))}
      {summary.cancelled ? (
        <p className="col-span-full px-1 text-[12.5px] text-muted">
          {summary.cancelled === 1 ? "1 cancelled invoice in this view is" : `${summary.cancelled} cancelled invoices in this view are`} listed but left out of the totals.
        </p>
      ) : null}
    </section>
  );
}

/** Two little coins: which metals are on the bill, echoing the Coin B mark. */
function MetalAvatar({ gold, silver, cancelled }: { gold: boolean; silver: boolean; cancelled?: boolean }) {
  return (
    <span aria-hidden className={cn("relative grid size-10 shrink-0 place-items-center rounded-full", cancelled ? "bg-sunken" : gold ? "bg-gold-fill" : silver ? "bg-silver-fill" : "bg-sunken")}>
      {gold && silver ? (
        <span className="relative block h-3.5 w-5">
          <span className="absolute top-0 left-0 size-3.5 rounded-full bg-gold ring-2 ring-gold-fill" />
          <span className="absolute top-0 right-0 size-3.5 rounded-full bg-silver ring-2 ring-gold-fill" />
        </span>
      ) : (
        <span className={cn("size-3.5 rounded-full", cancelled ? "bg-line-strong" : gold ? "bg-gold" : silver ? "bg-silver" : "bg-line-strong")} />
      )}
    </span>
  );
}

/* ── table / cards (TXN-06/07) ───────────────────────────────────────── */

function LedgerTable({
  rows,
  onView,
  onPrint,
  onCancel,
  onDelete,
}: {
  rows: Row[];
  onView: (r: Row) => void;
  onPrint: (r: Row) => void;
  onCancel: (r: Row) => void;
  onDelete: (r: Row) => void;
}) {
  return (
    <>
      {/* computers: one row per invoice */}
      <table className="hidden w-full border-collapse text-[13.5px] desk:table">
        <thead>
          <tr className="border-b border-line text-left text-[12px] font-semibold text-muted">
            <th className="py-3.5 pr-3 pl-5 font-semibold">Date</th>
            <th className="py-2.5 pr-3 font-medium">Invoice</th>
            <th className="py-2.5 pr-3 font-medium">Customer</th>
            <th className="py-2.5 pr-3 text-right font-medium">Gold (g)</th>
            <th className="py-2.5 pr-3 text-right font-medium">Silver (g)</th>
            {/* UX-06: Taxable hides between 1200 and 1299 px */}
            <th className="hidden py-2.5 pr-3 text-right font-medium min-[1300px]:table-cell">Taxable</th>
            <th className="py-2.5 pr-3 text-right font-medium">GST</th>
            <th className="py-2.5 pr-3 text-right font-medium">Total</th>
            <th className="py-2.5 pr-3 text-right font-medium">Balance</th>
            <th className="py-2.5 pr-3 font-medium">Mode</th>
            <th className="py-3.5 pr-5 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const cancelled = r.status === "cancelled";
            const balance = toDec(r.balance);
            return (
              <tr key={r.id} className={cn("group border-b border-line last:border-b-0 hover:bg-canvas", cancelled && "text-muted")}>
                <td className="num py-3 pr-3 pl-5 whitespace-nowrap">{formatDateDMY(r.invoiceDate)}</td>
                <td className="py-2.5 pr-3 whitespace-nowrap">
                  <button onClick={() => onView(r)} className={cn("num font-medium text-ink underline-offset-4 hover:underline", cancelled && "text-muted line-through decoration-muted/60")}>
                    {r.number}
                  </button>
                  {cancelled ? <span className="ml-2 rounded-full bg-danger-fill px-1.5 py-0.5 text-[11.5px] font-medium text-danger-deep">Cancelled</span> : null}
                </td>
                <td className="max-w-[240px] py-2.5 pr-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <MetalAvatar gold={!toDec(r.goldNetG).isZero()} silver={!toDec(r.silverNetG).isZero()} cancelled={cancelled} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{r.customerName || "Cash customer"}</p>
                      {r.customerPhone ? <p className="num text-[12.5px] text-muted">{r.customerPhone}</p> : null}
                    </div>
                  </div>
                </td>
                <td className="num py-2.5 pr-3 text-right">{toDec(r.goldNetG).isZero() ? <span className="text-faint">—</span> : formatIndianNumber(r.goldNetG, 3)}</td>
                <td className="num py-2.5 pr-3 text-right">{toDec(r.silverNetG).isZero() ? <span className="text-faint">—</span> : formatIndianNumber(r.silverNetG, 3)}</td>
                <td className="num hidden py-2.5 pr-3 text-right min-[1300px]:table-cell">{money(r.taxable)}</td>
                <td className="py-2.5 pr-3 text-right">{r.gstOn ? <span className="num">{money(r.gst)}</span> : <NoGstTag />}</td>
                <td className="num py-2.5 pr-3 text-right font-semibold text-ink">{formatINR(toDec(r.grandTotal).abs())}</td>
                <td className="py-2.5 pr-3 text-right">
                  {balance.gt(0) && !cancelled ? (
                    <span className="num rounded-full bg-rose-fill px-2 py-0.5 text-[12.5px] font-semibold text-danger-deep">{money(r.balance)}</span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
                <td className="max-w-[180px] py-2.5 pr-3">
                  <p className="text-ink-3">{r.payMode}</p>
                  {r.payDetails ? <p className="truncate text-[12.5px] text-muted" title={r.payDetails}>{r.payDetails}</p> : null}
                </td>
                <td className="py-2 pr-5">
                  <RowActions row={r} onView={onView} onPrint={onPrint} onCancel={onCancel} onDelete={onDelete} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* phones & tablets: cards with four large actions */}
      <ul className="divide-y divide-line desk:hidden">
        {rows.map((r) => {
          const cancelled = r.status === "cancelled";
          const balance = toDec(r.balance);
          return (
            <li key={r.id} className={cn("px-4 py-4 tab:px-5", cancelled && "text-muted")}>
              <div className="flex items-start gap-3">
                <MetalAvatar gold={!toDec(r.goldNetG).isZero()} silver={!toDec(r.silverNetG).isZero()} cancelled={cancelled} />
                <div className="min-w-0 flex-1">
                  <p className="num text-[14px] font-semibold text-ink">
                    {r.number}
                    {cancelled ? <span className="ml-2 rounded-full bg-danger-fill px-1.5 py-0.5 font-sans text-[11.5px] font-medium text-danger-deep">Cancelled</span> : null}
                  </p>
                  <p className="mt-0.5 truncate text-[13.5px] text-ink-3">
                    {r.customerName || "Cash customer"}
                    {r.customerPhone ? <span className="num text-muted"> · {r.customerPhone}</span> : null}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    <span className="num">{formatDateDMY(r.invoiceDate)}</span> · {r.payMode}
                    {r.payDetails ? ` · ${r.payDetails}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="num text-[16px] font-extrabold text-ink">{formatINR(toDec(r.grandTotal).abs())}</p>
                  {balance.gt(0) && !cancelled ? <p className="num mt-0.5 text-[12.5px] font-medium text-danger-deep">Due {money(r.balance)}</p> : null}
                  {!r.gstOn ? (
                    <p className="mt-1">
                      <NoGstTag />
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-[52px] text-[12.5px] text-muted">
                {!toDec(r.goldNetG).isZero() ? (
                  <span>
                    Gold <span className="num text-gold-deep">{formatWeight(r.goldNetG)}</span>
                  </span>
                ) : null}
                {!toDec(r.silverNetG).isZero() ? (
                  <span>
                    Silver <span className="num text-silver-deep">{formatWeight(r.silverNetG)}</span>
                  </span>
                ) : null}
                {r.gstOn ? (
                  <span>
                    GST <span className="num text-ink-3">{money(r.gst)}</span>
                  </span>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                <CardAction icon={<Eye className="size-4" aria-hidden />} label="View" onClick={() => onView(r)} />
                <CardAction icon={<Printer className="size-4" aria-hidden />} label="Print" onClick={() => onPrint(r)} />
                {r.permissions.canEdit ? (
                  <Link href={`/invoices/${r.id}/edit`} className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-sunken text-[12.5px] font-semibold text-ink transition-colors hover:bg-line">
                    <Pencil className="size-4" aria-hidden />
                    Edit
                  </Link>
                ) : (
                  <span className="flex h-10 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-semibold text-faint ring-1 ring-line ring-inset">
                    <Pencil className="size-4" aria-hidden />
                    Edit
                  </span>
                )}
                {r.permissions.canCancel ? (
                  <CardAction icon={<Ban className="size-4" aria-hidden />} label="Cancel" danger onClick={() => onCancel(r)} />
                ) : r.permissions.canDelete ? (
                  <CardAction icon={<Trash2 className="size-4" aria-hidden />} label="Delete" danger onClick={() => onDelete(r)} />
                ) : (
                  <span />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function NoGstTag() {
  return <span className="rounded-full bg-sunken px-2 py-0.5 text-[11.5px] font-semibold text-muted">No GST</span>;
}

function CardAction({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-10 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-semibold transition-colors",
        danger ? "bg-rose-fill text-danger-deep hover:bg-[#f9d5dc]" : "bg-sunken text-ink hover:bg-line",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function RowActions({
  row: r,
  onView,
  onPrint,
  onCancel,
  onDelete,
}: {
  row: Row;
  onView: (r: Row) => void;
  onPrint: (r: Row) => void;
  onCancel: (r: Row) => void;
  onDelete: (r: Row) => void;
}) {
  const iconBtn = "grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink";
  return (
    <div className="flex items-center justify-end gap-0.5">
      <button className={iconBtn} onClick={() => onView(r)} aria-label={`View ${r.number}`} title="View">
        <Eye className="size-4" aria-hidden />
      </button>
      <button className={iconBtn} onClick={() => onPrint(r)} aria-label={`Print ${r.number}`} title="Print">
        <Printer className="size-4" aria-hidden />
      </button>
      {r.permissions.canEdit ? (
        <Link className={iconBtn} href={`/invoices/${r.id}/edit`} aria-label={`Edit ${r.number}`} title="Edit">
          <Pencil className="size-4" aria-hidden />
        </Link>
      ) : (
        <span className="size-8" />
      )}
      {r.permissions.canCancel || r.permissions.canDelete ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className={cn(iconBtn, "data-[state=open]:bg-sunken")} aria-label={`More actions for ${r.number}`}>
            <MoreHorizontal className="size-4" aria-hidden />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-48 animate-enter rounded-[18px] bg-surface p-1.5 shadow-pop">
              {r.permissions.canCancel ? (
                <DropdownMenu.Item onSelect={() => onCancel(r)} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] text-ink outline-none data-[highlighted]:bg-sunken">
                  <Ban className="size-4 text-muted" aria-hidden />
                  Cancel invoice…
                </DropdownMenu.Item>
              ) : null}
              {r.permissions.canDelete ? (
                <DropdownMenu.Item onSelect={() => onDelete(r)} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] text-danger-deep outline-none data-[highlighted]:bg-danger-fill">
                  <Trash2 className="size-4" aria-hidden />
                  Delete permanently…
                </DropdownMenu.Item>
              ) : null}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : (
        <span className="size-8" />
      )}
    </div>
  );
}

function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-muted">
      <span>
        <span className="num text-ink-3">{formatIndianNumber(from, 0)}–{formatIndianNumber(to, 0)}</span> of{" "}
        <span className="num text-ink-3">{formatIndianNumber(total, 0)}</span>
      </span>
      <div className="flex gap-1.5">
        <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="size-4" aria-hidden />
          Newer
        </Button>
        <Button size="sm" disabled={page >= last} onClick={() => onPage(page + 1)}>
          Older
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/* ── export (TXN-12) ─────────────────────────────────────────────────── */

function ExportMenu({ qs, isOwner }: { qs: string; isOwner: boolean }) {
  const href = (full: boolean) => {
    const p = new URLSearchParams(qs);
    p.delete("page");
    if (full) p.set("full", "1");
    const s = p.toString();
    return `/api/export/csv${s ? `?${s}` : ""}`;
  };
  if (!isOwner)
    return (
      <a href={href(false)} className={cn(controlBase, "inline-flex h-9 w-auto items-center gap-2 font-medium shadow-hair hover:bg-canvas")}>
        <FileDown className="size-4" aria-hidden />
        Export CSV
      </a>
    );
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button>
          <FileDown className="size-4" aria-hidden />
          Export CSV
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-50 w-72 animate-enter rounded-[18px] bg-surface p-1.5 shadow-pop">
          <DropdownMenu.Item asChild>
            <a href={href(false)} className="flex flex-col rounded-[12px] px-3 py-2.5 outline-none data-[highlighted]:bg-sunken">
              <span className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                <Download className="size-4 text-muted" aria-hidden />
                These invoices
              </span>
              <span className="pl-6 text-[12.5px] text-muted">Phone and PAN partly hidden</span>
            </a>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <a href={href(true)} className="flex flex-col rounded-[12px] px-3 py-2.5 outline-none data-[highlighted]:bg-sunken">
              <span className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                <Download className="size-4 text-muted" aria-hidden />
                With full phone and PAN
              </span>
              <span className="pl-6 text-[12.5px] text-muted">For your accountant only</span>
            </a>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* ── delete (TXN-09) ─────────────────────────────────────────────────── */

function DeleteDialog({ row, onClose, onDeleted }: { row: Row | null; onClose: () => void; onDeleted: (number: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = useMemo(() => (row ? `${row.customerName || "Cash customer"}, ${formatINR(toDec(row.grandTotal).abs())}` : ""), [row]);
  return (
    <Dialog
      open={!!row}
      onOpenChange={(v) => {
        if (!v) {
          setError(null);
          onClose();
        }
      }}
      title={row ? `Delete ${row.number}?` : "Delete invoice"}
      description={row ? `This permanently removes invoice ${row.number} (${label}). It cannot be undone, and its number will not be reused.` : undefined}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              if (!row) return;
              setBusy(true);
              const r = await api<{ deleted: string }>(`/api/invoices/${row.id}`, { method: "DELETE" });
              setBusy(false);
              if (!r.ok) return setError(r.error.message);
              onDeleted(r.data.deleted);
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete permanently
          </Button>
        </>
      }
    >
      <p className="text-[13.5px] leading-relaxed text-ink-3">
        To keep the GST number series unbroken, <span className="font-medium text-ink">cancel</span> a real bill instead. Delete is meant for test bills.
      </p>
      {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}
    </Dialog>
  );
}

