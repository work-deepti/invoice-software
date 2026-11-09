"use client";
import { ArrowDown, ArrowUp, Plus, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  autoFillFromFineRate,
  formatDateDMY,
  formatIndianNumber,
  rateEquivalent,
  sanitizeDecimalText,
  todayIST,
  validateRates,
  type Issue,
  type Metal,
} from "@/lib/calc-engine";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { RateHistoryDTO, RatesDTO } from "@/server/rates";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, TextInput } from "@/components/ui/field";
import { NumInput } from "@/components/ui/num-input";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/shell/session";
import { newKey } from "@/components/invoice/form-state";

interface Row {
  key: string;
  id: string | null;
  metal: Metal;
  label: string;
  purityPct: string;
  rate: string;
}

const GRID = "desk:grid-cols-[minmax(0,9fr)_minmax(0,18fr)_minmax(0,8fr)_minmax(0,12fr)_minmax(0,14fr)_32px]";

const toRows = (r: RatesDTO): Row[] => r.rows.map((x) => ({ key: newKey(), id: x.id, metal: x.metal, label: x.label, purityPct: x.purityPct, rate: x.rate }));

export function RateMaster() {
  const { rates, setRates, capabilities } = useSession();
  const toast = useToast();
  const canEdit = capabilities.isOwner;
  const [rows, setRows] = useState<Row[]>(() => toRows(rates));
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Issue[] | null>(null);
  const [pending, setPending] = useState<Issue[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<RateHistoryDTO | null>(null);

  const loadHistory = useCallback(async () => {
    const r = await api<RateHistoryDTO>("/api/rates/history?days=30");
    if (r.ok) setHistory(r.data);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHistory();
  }, [loadHistory]);

  const validation = useMemo(() => validateRates(rows), [rows]);
  const errors = submitted ? [...validation.errors, ...(serverErrors ?? [])] : [];
  const errorFor = (field: string) => errors.find((e) => e.field === field)?.message ?? null;
  const dirty = useMemo(() => {
    const sig = (rs: Row[]) => JSON.stringify(rs.map((r) => [r.id, r.metal, r.label, r.purityPct, r.rate]));
    return sig(rows) !== sig(toRows(rates));
  }, [rows, rates]);

  const set = (i: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setServerErrors(null);
  };

  async function save(acceptWarnings = false) {
    setSubmitted(true);
    if (validation.errors.length) return;
    setBusy(true);
    const r = await api<RatesDTO>("/api/rates", {
      method: "PUT",
      body: { rows: rows.map((x) => ({ id: x.id, metal: x.metal, label: x.label, purityPct: x.purityPct, rate: x.rate })), acceptWarnings },
    });
    setBusy(false);
    if (!r.ok) {
      if (r.status === 422 && r.error.errors) setServerErrors(r.error.errors);
      else if (r.status === 409 && r.error.warnings) setPending(r.error.warnings);
      else toast(r.error.message, "error");
      return;
    }
    setPending(null);
    setSubmitted(false);
    setRates(r.data);
    setRows(toRows(r.data));
    toast(`Rates saved for ${formatDateDMY(r.data.effectiveDate ?? todayIST())}`);
    void loadHistory();
  }

  const statusLine =
    rates.status === "current"
      ? "Saved today. New bills use these rates."
      : rates.status === "stale" && rates.effectiveDate
        ? `Last saved ${formatDateDMY(rates.effectiveDate)}. Update before the first bill of the day.`
        : "No rates yet. Enter today's rates before billing.";

  return (
    <div className="flex flex-col gap-4 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="tight text-[22px] font-semibold text-ink">Rate master</h1>
          <p className={cn("mt-0.5 text-[13.5px]", rates.status === "current" ? "text-muted" : "font-medium text-gold-deep")}>{statusLine}</p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setRows((rs) => autoFillFromFineRate(rs) as Row[]);
                toast("Filled from each metal's highest-purity rate. Adjust any value before saving.");
              }}
              disabled={!rows.some((r) => r.rate)}
              title="Every other purity of a metal = fine rate × its purity % ÷ fine purity %"
            >
              <Sparkles className="size-4 text-gold-deep" aria-hidden />
              Auto-fill from fine rate
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void save()} disabled={!dirty && rates.status === "current"}>
              Save rates
            </Button>
          </div>
        ) : null}
      </div>

      <Card aria-labelledby="rates-h">
        <CardHeader
          title={<span id="rates-h">Today&apos;s rates</span>}
          description={canEdit ? "Rate per gram for each purity. Gold shows the 10 g price, silver the 1 kg price." : "Only the owner can change rates."}
          actions={
            canEdit ? (
              <Button size="sm" onClick={() => setRows((rs) => [...rs, { key: newKey(), id: null, metal: "Gold", label: "", purityPct: "", rate: "" }])}>
                <Plus className="size-4" aria-hidden />
                Add purity
              </Button>
            ) : null
          }
        />
        <div className="px-3 pt-3 pb-4 tab:px-5">
          <div aria-hidden className={cn("hidden border-b border-line pb-2 text-[11.5px] font-medium text-muted desk:grid desk:gap-x-2", GRID)}>
            <span className="pl-2">Metal</span>
            <span className="pl-2">Purity name (printed)</span>
            <span className="pr-2 text-right">Purity %</span>
            <span className="pr-2 text-right">Rate / g ₹</span>
            <span className="pr-2 text-right">Equivalent</span>
            <span />
          </div>
          <ol className="flex flex-col desk:gap-0">
            {rows.map((r, i) => {
              const eq = rateEquivalent(r.metal, r.rate);
              const f = (k: string) => `rates.${i}.${k}`;
              return (
                <li
                  key={r.key}
                  className={cn(
                    "relative grid animate-enter grid-cols-2 gap-3 border-b border-line pt-4 pb-5 first:pt-1 last:border-b-0 last:pb-1 tab:grid-cols-4",
                    "desk:items-center desk:gap-x-2 desk:gap-y-0 desk:border-b desk:last:border-b desk:bg-transparent desk:p-0 desk:py-1.5",
                    GRID,
                  )}
                >
                  <Field label="Metal" labelClassName="desk:sr-only">
                    {(p) => (
                      <Select {...p} disabled={!canEdit} value={r.metal} onChange={(e) => set(i, { metal: e.target.value as Metal })} className="desk:h-8">
                        <option>Gold</option>
                        <option>Silver</option>
                        <option>Platinum</option>
                        <option>Other</option>
                      </Select>
                    )}
                  </Field>
                  <Field label="Purity name" field={f("label")} error={errorFor(f("label"))} labelClassName="desk:sr-only" messageClassName="desk:hidden" className="col-span-2 tab:col-span-1 desk:col-span-1">
                    {(p) => <TextInput {...p} disabled={!canEdit} value={r.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="e.g. Gold 22K (916)" className="desk:h-8" />}
                  </Field>
                  <Field label="Purity %" field={f("purityPct")} error={errorFor(f("purityPct"))} labelClassName="desk:sr-only" messageClassName="desk:hidden">
                    {(p) => (
                      <TextInput
                        {...p}
                        disabled={!canEdit}
                        inputMode="decimal"
                        value={r.purityPct}
                        onChange={(e) => set(i, { purityPct: sanitizeDecimalText(e.target.value) })}
                        className="num text-right desk:h-8"
                      />
                    )}
                  </Field>
                  <Field label="Rate / g ₹" field={f("rate")} labelClassName="desk:sr-only">
                    {(p) => (
                      <NumInput
                        {...p}
                        disabled={!canEdit}
                        kind="rate"
                        value={r.rate}
                        onValueChange={(v) => set(i, { rate: v })}
                        placeholder="Not set"
                        className={cn("font-medium desk:h-8", r.metal === "Gold" && r.rate && "text-gold-deep")}
                      />
                    )}
                  </Field>
                  <div className="flex min-w-0 flex-col gap-1.5 desk:items-end">
                    <span className="text-[12.5px] font-medium text-ink-3 desk:sr-only">Equivalent</span>
                    <span className="num flex h-9 items-center text-[13.5px] text-ink-3 desk:h-8 desk:pr-2">
                      {eq ? (
                        <>
                          ₹{formatIndianNumber(eq.amount, 2)}
                          <span className="ml-1 font-sans text-[12px] text-muted">/ {eq.unit}</span>
                        </>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </span>
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                      aria-label={`Remove ${r.label || `row ${i + 1}`}`}
                      className="absolute top-3 right-0 grid size-8 place-items-center rounded-md text-faint transition-colors hover:bg-danger-fill hover:text-danger desk:static desk:size-7 desk:justify-self-center"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  ) : (
                    <span className="hidden desk:block" />
                  )}
                </li>
              );
            })}
          </ol>
          {errors.length ? (
            <ul role="alert" className="mt-3 space-y-1 rounded-lg bg-danger-fill px-3.5 py-2.5 text-[13px] text-danger-deep">
              {errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </Card>

      <Card aria-labelledby="hist-h">
        <CardHeader title={<span id="hist-h">Rate history</span>} description="Last 30 saved days, newest first. Saving twice in a day keeps the latest." />
        <div className="px-3 pt-3 pb-4 tab:px-5">
          {!history ? (
            <div className="h-32 animate-pulse rounded-lg bg-line/40" />
          ) : history.dates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13.5px] text-muted">
              No saved rates yet. Each time you save, that day&apos;s rates are kept here.
            </p>
          ) : (
            // UX-05: wide reference tables scroll inside their own box only
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-max border-collapse text-[13px]">
                <thead>
                  <tr className="bg-sunken/70 text-left text-[11.5px] font-medium text-muted">
                    <th className="sticky left-0 bg-sunken px-3 py-2 font-medium">Date</th>
                    {history.columns.map((c) => (
                      <th key={c.purityId} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.dates.map((d, di) => {
                    const prev = history.dates[di + 1];
                    return (
                      <tr key={d} className={cn("border-t border-line", d === todayIST() && "bg-gold-soft")}>
                        <td className={cn("num sticky left-0 px-3 py-2 whitespace-nowrap", d === todayIST() ? "bg-gold-soft font-medium" : "bg-surface")}>
                          {formatDateDMY(d)}
                        </td>
                        {history.columns.map((c) => {
                          const v = history.values[d]?.[c.purityId];
                          const pv = prev ? history.values[prev]?.[c.purityId] : undefined;
                          const delta = v && pv ? Number(v) - Number(pv) : 0;
                          return (
                            <td key={c.purityId} className="num px-3 py-2 text-right whitespace-nowrap">
                              {v ? formatIndianNumber(v, 2) : <span className="text-faint">—</span>}
                              {delta ? (
                                delta > 0 ? (
                                  <ArrowUp className="ml-1 inline size-3 align-[-1px] text-ok-deep" aria-label="up from the day before" />
                                ) : (
                                  <ArrowDown className="ml-1 inline size-3 align-[-1px] text-danger" aria-label="down from the day before" />
                                )
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Dialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title="Check the rates"
        footer={
          <>
            <Button onClick={() => setPending(null)}>Go back</Button>
            <Button variant="primary" loading={busy} onClick={() => void save(true)}>
              Save anyway
            </Button>
          </>
        }
      >
        <ul className="space-y-2">
          {pending?.map((w, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] text-ink">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
              {w.message}
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}
