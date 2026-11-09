"use client";
import { DropdownMenu } from "radix-ui";
import { AlertCircle, ChevronDown, ChevronUp, Eye, Printer } from "lucide-react";
import { useState } from "react";
import { formatINR, formatIndianNumber, formatWeight, taxRows, toDec, type InvoiceTotals, type Issue } from "@/lib/calc-engine";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { NumInput } from "@/components/ui/num-input";
import { Flash, Ticker } from "./ticker";
import type { FormState } from "./form-state";
import type { ErrorFor } from "./line-items";

const money = (v: string) => formatIndianNumber(v, 2);

/* ── 6.5 Summary (INV-15/16) ─────────────────────────────────────────── */

export function SummaryCard({
  form,
  totals,
  errorFor,
  onChange,
}: {
  form: FormState;
  totals: InvoiceTotals;
  errorFor: ErrorFor;
  onChange: (patch: Partial<FormState>) => void;
}) {
  const rows = taxRows(form.gstOn, form.interState, totals);
  const grand = toDec(totals.grandTotal);
  const balance = toDec(totals.balance);
  const change = toDec(totals.changeReturned);
  const roundOff = toDec(totals.roundOff);

  return (
    <Card aria-labelledby="sum-h" className="pb-4">
      <CardHeader title={<span id="sum-h">Summary</span>} />
      <dl className="mt-2 px-4 text-[13.5px] tab:px-5">
        <Line label="Items total" value={<Flash value={totals.itemsTotal}>{money(totals.itemsTotal)}</Flash>} />
        <div className="flex items-center justify-between gap-4 py-1.5">
          <dt className="text-ink-3">
            <label htmlFor="sum-discount">Discount</label>
          </dt>
          <dd className="w-40">
            <Field label="Discount" srLabel field="discount" error={errorFor("discount")}>
              {(p) => <NumInput {...p} id="sum-discount" kind="money" value={form.discount} onValueChange={(v) => onChange({ discount: v })} placeholder="0.00" className="h-8" />}
            </Field>
          </dd>
        </div>
        <Line label={form.gstOn ? "Taxable value" : "Net amount"} value={<Flash value={totals.taxable}>{money(totals.taxable)}</Flash>} strong />
        {rows.length ? (
          rows.map((r) => <Line key={r.key} label={r.label} value={<Flash value={r.amount}>{money(r.amount)}</Flash>} />)
        ) : (
          <Line label="GST" value={<span className="font-sans text-muted">Not added</span>} />
        )}
        {totals.exchangeTotal !== "0.00" ? (
          <Line label="Less old gold / silver" value={<Flash value={totals.exchangeTotal}>−{money(totals.exchangeTotal)}</Flash>} />
        ) : null}
        {!roundOff.isZero() ? (
          <Line label="Round off" value={`${roundOff.isNeg() ? "−" : "+"}${money(roundOff.abs().toFixed(2))}`} muted />
        ) : null}
      </dl>

      <div className="mx-4 mt-3 rounded-xl bg-ink px-4 py-3.5 text-white tab:mx-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-medium text-white/70">{totals.payableToCustomer ? "Payable to customer" : "Grand total"}</span>
          <Ticker value={formatINR(grand.abs())} className="text-[26px] font-semibold tracking-[-0.02em]" />
        </div>
        <p className="mt-1.5 text-right text-[12.5px] leading-snug text-white/60">{totals.amountInWords}</p>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 tab:px-5">
        <label htmlFor="sum-received" className="text-[13.5px] text-ink-3">
          Amount received
        </label>
        <div className="w-44">
          <Field label="Amount received" srLabel field="received" error={errorFor("received")}>
            {(p) => (
              <NumInput
                {...p}
                id="sum-received"
                kind="money"
                value={form.received}
                onValueChange={(v) => onChange({ received: v })}
                placeholder={`Full: ${formatINR(grand.abs())}`}
                className="h-9"
              />
            )}
          </Field>
        </div>
        {balance.gt(0) ? (
          <>
            <span className="text-[13.5px] font-medium text-danger-deep">Balance due</span>
            <span className="num text-right text-[15px] font-semibold text-danger-deep">
              <Flash value={totals.balance}>{formatINR(balance)}</Flash>
            </span>
          </>
        ) : change.gt(0) ? (
          <>
            <span className="text-[13.5px] font-medium text-ok-deep">Change to return</span>
            <span className="num text-right text-[15px] font-semibold text-ok-deep">
              <Flash value={totals.changeReturned}>{formatINR(change)}</Flash>
            </span>
          </>
        ) : (
          <>
            <span className="text-[13.5px] text-muted">Balance</span>
            <span className="text-right text-[14px] text-muted">Paid in full</span>
          </>
        )}
      </div>
    </Card>
  );
}

function Line({ label, value, strong, muted }: { label: string; value: React.ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", strong && "border-t border-line pt-2")}>
      <dt className={cn("text-ink-3", strong && "font-medium text-ink", muted && "text-muted")}>{label}</dt>
      <dd className={cn("num text-ink", strong && "font-semibold", muted && "text-muted")}>{value}</dd>
    </div>
  );
}

/* ── Bottom dock: always-visible totals + actions (INV-17, INV-18) ────── */

export type SaveAction = "view" | "print" | "save";

export function Dock({
  totals,
  editing,
  busy,
  chips,
  onChip,
  onSave,
}: {
  totals: InvoiceTotals;
  editing: boolean;
  busy: SaveAction | null;
  chips: Issue[];
  onChip: (field: string) => void;
  onSave: (a: SaveAction) => void;
}) {
  const [chipsOpen, setChipsOpen] = useState(true);
  const grand = toDec(totals.grandTotal);
  const balance = toDec(totals.balance);
  const verb = editing ? "Update" : "Save";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-2 pb-[max(8px,env(safe-area-inset-bottom))] tab:px-6 tab:pb-4">
      <div className="pointer-events-auto mx-auto max-w-[1680px]">
        {chips.length ? (
          <div role="alert" className="mb-2 animate-enter rounded-xl border border-danger/25 bg-surface shadow-pop">
            <button
              type="button"
              onClick={() => setChipsOpen((o) => !o)}
              className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] font-medium text-danger-deep"
              aria-expanded={chipsOpen}
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              {chips.length === 1 ? "1 thing to fix before saving" : `${chips.length} things to fix before saving`}
              <span className="ml-auto text-muted">{chipsOpen ? <ChevronDown className="size-4" aria-hidden /> : <ChevronUp className="size-4" aria-hidden />}</span>
            </button>
            {chipsOpen ? (
              <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto px-3 pb-3">
                {chips.map((e, i) => (
                  <li key={`${e.id}-${e.field}-${i}`}>
                    <button
                      type="button"
                      onClick={() => onChip(e.field)}
                      className="max-w-full rounded-lg border border-danger/20 bg-danger-fill px-2.5 py-1.5 text-left text-[12.5px] leading-snug text-danger-deep transition-colors hover:border-danger/45 hover:bg-[#fee2e2]"
                    >
                      {e.message}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-3 rounded-2xl bg-ink px-3 py-2.5 text-white shadow-dock tab:gap-5 tab:px-5 tab:py-3">
          <dl className="hidden items-center gap-5 text-[12.5px] lg:flex">
            <Metric dot="bg-gold" tone="text-gold" label="Gold" value={formatWeight(totals.goldNetG)} dim={totals.goldNetG === "0.000"} />
            <Metric dot="bg-slate-300" label="Silver" value={formatWeight(totals.silverNetG)} dim={totals.silverNetG === "0.000"} />
            {balance.gt(0) ? <Metric dot="bg-danger" label="Balance due" value={formatINR(balance)} danger /> : null}
          </dl>

          <div className="ml-auto flex min-w-0 flex-col items-end leading-none">
            <span className="text-[11.5px] font-medium text-white/55">{totals.payableToCustomer ? "Payable to customer" : "Grand total"}</span>
            <Ticker value={formatINR(grand.abs())} className="mt-1 text-[20px] font-semibold tracking-[-0.02em] tab:text-[24px]" />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="dock" size="md" className="hidden tab:inline-flex" loading={busy === "view"} disabled={!!busy} onClick={() => onSave("view")}>
              <Eye className="size-4" aria-hidden />
              {verb} &amp; view
            </Button>
            <Button variant="dock" size="md" className="hidden tab:inline-flex" loading={busy === "print"} disabled={!!busy} onClick={() => onSave("print")} title="Ctrl+P">
              <Printer className="size-4" aria-hidden />
              {verb} &amp; print
            </Button>
            <div className="flex">
              <Button
                size="md"
                loading={busy === "save"}
                disabled={!!busy}
                onClick={() => onSave("save")}
                title="Ctrl+S"
                className="rounded-r-none bg-white text-ink hover:bg-slate-100 tab:rounded-r-lg"
              >
                {verb}
              </Button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  aria-label="More save options"
                  className="grid h-9 w-8 place-items-center rounded-r-lg border-l border-ink/10 bg-white text-ink hover:bg-slate-100 tab:hidden"
                >
                  <ChevronUp className="size-4" aria-hidden />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content side="top" align="end" sideOffset={8} className="z-50 min-w-44 animate-enter rounded-xl border border-line bg-surface p-1 text-ink shadow-pop">
                    <DropdownMenu.Item onSelect={() => onSave("view")} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2.5 text-[14px] outline-none data-[highlighted]:bg-sunken">
                      <Eye className="size-4 text-muted" aria-hidden />
                      {verb} &amp; view
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => onSave("print")} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2.5 text-[14px] outline-none data-[highlighted]:bg-sunken">
                      <Printer className="size-4 text-muted" aria-hidden />
                      {verb} &amp; print
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ dot, tone, label, value, dim, danger }: { dot: string; tone?: string; label: string; value: string; dim?: boolean; danger?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", dim && "opacity-45")}>
      <span aria-hidden className={cn("size-1.5 rounded-full", dot)} />
      <dt className="text-white/55">{label}</dt>
      <dd className={cn("num font-medium", danger ? "text-red-300" : (tone ?? "text-white"))}>
        <Flash value={value}>{value}</Flash>
      </dd>
    </div>
  );
}
