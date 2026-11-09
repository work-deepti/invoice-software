"use client";
import { Plus, RotateCcw, X } from "lucide-react";
import { formatIndianNumber, type ExchangeResult, type LineResult, type MakingType, type Metal } from "@/lib/calc-engine";
import { cn } from "@/lib/cn";
import type { RatesDTO } from "@/server/rates";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Select, TextInput } from "@/components/ui/field";
import { NumInput } from "@/components/ui/num-input";
import { Flash } from "./ticker";
import type { ExchangeForm, LineForm } from "./form-state";

/* UX-02 column plan (≈ %): Description 15.5, Purity 12.5, HSN 5.5, Pcs 4, Gross 7, Less 6.5,
   Net 6.5, Wst 5, Rate 7.5, Making 11, Stone 6.5, Amount 10.5 — plus # and × */
// Weights get a little more than the PRD's approximate plan (taken from Description) so
// "145000.000" and "₹11,38,323.42" both fit at exactly 1200 px.
const LINE_GRID =
  "desk:grid-cols-[22px_minmax(0,14.5fr)_minmax(0,12.5fr)_minmax(0,5.5fr)_minmax(0,4fr)_minmax(0,8fr)_minmax(0,7fr)_minmax(0,7fr)_minmax(0,5fr)_minmax(0,7.5fr)_minmax(0,11fr)_minmax(0,6.5fr)_minmax(0,10.5fr)_26px]";

/** Compact cell styling at ≥ 1200 px; full-size labelled fields below. */
const cell = "desk:h-8 desk:rounded-md desk:px-1.5 desk:text-[13px]";
const label = "desk:sr-only";
const msg = "desk:hidden";

const money = (v: string) => formatIndianNumber(v, 2);

export type ErrorFor = (field: string) => string | null;

export function ItemsCard({
  lines,
  results,
  rates,
  errorFor,
  onLine,
  onPurity,
  onAdd,
  onRemove,
  onResetRate,
}: {
  lines: LineForm[];
  results: LineResult[];
  rates: RatesDTO;
  errorFor: ErrorFor;
  onLine: (i: number, patch: Partial<LineForm>) => void;
  onPurity: (i: number, purityId: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onResetRate: (i: number) => void;
}) {
  return (
    <Card aria-labelledby="items-h">
      <CardHeader
        title={<span id="items-h">Items</span>}
        description="Rates come from today's rate master. A rate you type stays fixed for that line."
        actions={
          <Button size="sm" onClick={onAdd} title="Add item (Alt+N)">
            <Plus className="size-4" aria-hidden />
            Add item
            <kbd className="ml-1 hidden rounded border border-line px-1 font-sans text-[11px] text-muted desk:inline">Alt N</kbd>
          </Button>
        }
      />
      <div className="px-3 pt-3 pb-4 tab:px-5">
        {/* column header — one-row layout only */}
        <div
          aria-hidden
          className={cn(
            "hidden border-b border-line pb-2 text-[11.5px] font-medium text-muted desk:grid desk:gap-x-1",
            LINE_GRID,
          )}
        >
          <span className="text-center">#</span>
          <span className="pl-2">Description</span>
          <span className="pl-2">Metal / purity</span>
          <span className="pl-2">HSN</span>
          <span className="pr-2 text-right">Pcs</span>
          <span className="pr-2 text-right">Gross g</span>
          <span className="pr-2 text-right">Less g</span>
          <span className="pr-2 text-right">Net g</span>
          <span className="pr-2 text-right">Wst %</span>
          <span className="pr-2 text-right">Rate/g ₹</span>
          <span className="pl-2">Making</span>
          <span className="pr-2 text-right">Stone ₹</span>
          <span className="pr-2 text-right">Amount ₹</span>
          <span />
        </div>
        <ol className="flex flex-col gap-3 desk:gap-0">
          {lines.map((l, i) => (
            <LineRow
              key={l.key}
              i={i}
              line={l}
              r={results[i]}
              rates={rates}
              errorFor={errorFor}
              onLine={onLine}
              onPurity={onPurity}
              onRemove={onRemove}
              onResetRate={onResetRate}
              only={lines.length === 1}
            />
          ))}
        </ol>
      </div>
    </Card>
  );
}

function LineRow({
  i,
  line: l,
  r,
  rates,
  errorFor,
  onLine,
  onPurity,
  onRemove,
  onResetRate,
  only,
}: {
  i: number;
  line: LineForm;
  r: LineResult | undefined;
  rates: RatesDTO;
  errorFor: ErrorFor;
  onLine: (i: number, patch: Partial<LineForm>) => void;
  onPurity: (i: number, purityId: string) => void;
  onRemove: (i: number) => void;
  onResetRate: (i: number) => void;
  only: boolean;
}) {
  const f = (k: string) => `lines.${i}.${k}`;
  const set = (patch: Partial<LineForm>) => onLine(i, patch);
  const knownPurity = rates.rows.some((p) => p.id === l.purityId);
  const removeLabel = only ? "Clear this line" : `Remove item ${i + 1}`;

  return (
    <li
      className={cn(
        "relative grid animate-enter grid-cols-2 gap-x-3 gap-y-3 rounded-xl border border-line bg-canvas/50 p-3.5 tab:grid-cols-4 lg:grid-cols-6",
        "desk:items-center desk:gap-x-1 desk:gap-y-0 desk:rounded-none desk:border-0 desk:border-b desk:border-line desk:bg-transparent desk:p-0 desk:py-1.5",
        "desk:hover:bg-canvas/70",
        LINE_GRID,
      )}
    >
      {/* # + card header */}
      <div className="col-span-full flex items-center justify-between desk:col-span-1 desk:justify-center">
        <span className="num text-[12.5px] font-medium text-muted">
          <span className="desk:hidden">Item </span>
          {i + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(i)}
          aria-label={removeLabel}
          title={removeLabel}
          className="grid size-8 place-items-center rounded-md text-faint transition-colors hover:bg-danger-fill hover:text-danger desk:hidden"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <Field label="Description" field={f("description")} error={errorFor(f("description"))} className="col-span-2 desk:col-span-1" labelClassName={label} messageClassName={msg}>
        {(p) => (
          <TextInput
            {...p}
            value={l.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="e.g. Necklace"
            className={cell}
            autoComplete="off"
          />
        )}
      </Field>

      <Field label="Metal / purity" field={f("purity")} className="col-span-2 desk:col-span-1" labelClassName={label}>
        {(p) => (
          <Select {...p} value={knownPurity ? (l.purityId ?? "") : ""} onChange={(e) => onPurity(i, e.target.value)} className={cn(cell, "desk:pr-6 desk:bg-position-[right_4px_center]")}>
            {!knownPurity ? <option value="">{l.purityLabel || "Choose…"}</option> : null}
            {(["Gold", "Silver", "Platinum", "Other"] as Metal[]).map((m) => {
              const rows = rates.rows.filter((p) => p.metal === m);
              return rows.length ? (
                <optgroup key={m} label={m}>
                  {rows.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </Select>
        )}
      </Field>

      <Field label="HSN" field={f("hsn")} labelClassName={label} messageClassName={msg}>
        {(p) => (
          <TextInput
            {...p}
            value={l.hsn}
            inputMode="numeric"
            maxLength={8}
            onChange={(e) => set({ hsn: e.target.value.replace(/\D/g, "").slice(0, 8) })}
            className={cn(cell, "num")}
          />
        )}
      </Field>

      <Field label="Pcs" field={f("pcs")} error={errorFor(f("pcs"))} labelClassName={label} messageClassName={msg}>
        {(p) => <NumInput {...p} kind="pcs" value={l.pcs} onValueChange={(v) => set({ pcs: v })} className={cell} />}
      </Field>

      <Field label="Gross wt (g)" field={f("gross")} error={errorFor(f("gross"))} labelClassName={label} messageClassName={msg}>
        {(p) => <NumInput {...p} kind="weight" value={l.gross} onValueChange={(v) => set({ gross: v })} placeholder="0.000" className={cell} />}
      </Field>

      <Field label="Less wt (g)" field={f("less")} error={errorFor(f("less"))} labelClassName={label} messageClassName={msg}>
        {(p) => <NumInput {...p} kind="weight" value={l.less} onValueChange={(v) => set({ less: v })} placeholder="0.000" className={cell} />}
      </Field>

      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-ink-3 desk:sr-only">Net wt (g)</span>
        <output
          className={cn(
            "num flex h-9 items-center justify-end overflow-hidden rounded-lg bg-sunken px-3 text-[14px] text-ink-3 desk:h-8 desk:rounded-md desk:bg-transparent desk:px-1.5 desk:text-[13px]",
            r && r.net.length >= 10 && "desk:text-[11.5px]",
          )}
        >
          {r && r.net !== "0.000" ? <span className="desk:hidden">{formatIndianNumber(r.net, 3)}</span> : null}
          {r && r.net !== "0.000" ? <span className="hidden desk:inline">{r.net}</span> : <span className="text-faint">—</span>}
        </output>
      </div>

      <Field label="Wastage %" field={f("wastagePct")} error={errorFor(f("wastagePct"))} labelClassName={label} messageClassName={msg}>
        {(p) => <NumInput {...p} kind="pct" value={l.wastagePct} onValueChange={(v) => set({ wastagePct: v })} placeholder="0" className={cell} />}
      </Field>

      <Field label="Rate / g ₹" field={f("rate")} error={errorFor(f("rate"))} labelClassName={label} messageClassName={msg}>
        {(p) => (
          <div className="relative">
            <NumInput
              {...p}
              kind="rate"
              value={l.rate}
              onValueChange={(v) => set({ rate: v, rateManual: true })}
              className={cn(cell, l.rateManual && "border-gold/50 bg-gold-soft desk:pl-6")}
            />
            {l.rateManual ? (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => onResetRate(i)}
                title="Typed by hand — click to use today's rate again"
                aria-label="Use today's rate"
                className="absolute top-1/2 left-1.5 hidden size-5 -translate-y-1/2 place-items-center rounded text-gold-deep transition-colors hover:bg-gold-fill desk:grid"
              >
                <RotateCcw className="size-3" aria-hidden />
              </button>
            ) : null}
            {l.rateManual ? (
              <button type="button" onClick={() => onResetRate(i)} className="mt-1 text-[12px] font-medium text-gold-deep desk:hidden">
                Typed by hand · use today&apos;s rate
              </button>
            ) : null}
          </div>
        )}
      </Field>

      <Field label="Making" field={f("makingValue")} error={errorFor(f("makingValue"))} className="col-span-2 desk:col-span-1" labelClassName={label} messageClassName={msg}>
        {(p) => (
          <div className="flex min-w-0 gap-1">
            <Select
              aria-label={`Item ${i + 1} making type`}
              value={l.makingType}
              onChange={(e) => set({ makingType: e.target.value as MakingType })}
              className={cn(cell, "w-[46%] shrink-0 pr-6 desk:w-[52px] desk:bg-position-[right_2px_center] desk:pr-4 desk:pl-1.5")}
            >
              <option value="per_g">₹/g</option>
              <option value="pct">%</option>
              <option value="flat">Flat</option>
            </Select>
            <NumInput {...p} kind={l.makingType === "pct" ? "pct" : "money"} value={l.makingValue} onValueChange={(v) => set({ makingValue: v })} placeholder="0" className={cell} />
          </div>
        )}
      </Field>

      <Field label="Stone / other ₹" field={f("stone")} error={errorFor(f("stone"))} labelClassName={label} messageClassName={msg}>
        {(p) => <NumInput {...p} kind="money" value={l.stone} onValueChange={(v) => set({ stone: v })} placeholder="0" className={cell} />}
      </Field>

      {/* Amount — bottom of the card in bold; a column in the one-row layout */}
      <div className="col-span-full flex items-baseline justify-between border-t border-line pt-3 desk:col-span-1 desk:block desk:border-0 desk:pt-0 desk:text-right">
        <span className="text-[12.5px] font-medium text-muted desk:sr-only">Amount</span>
        <span className={cn("num text-[15px] font-semibold text-ink desk:pr-1.5 desk:text-[13px]", r && r.amount.length >= 13 && "desk:text-[12px]")}>
          {r && r.amount !== "0.00" ? <Flash value={r.amount}>{money(r.amount)}</Flash> : <span className="font-normal text-faint">—</span>}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onRemove(i)}
        aria-label={removeLabel}
        title={removeLabel}
        className="hidden size-7 place-items-center justify-self-center rounded-md text-faint transition-colors hover:bg-danger-fill hover:text-danger desk:grid"
      >
        <X className="size-4" aria-hidden />
      </button>
    </li>
  );
}

/* ── Old gold / silver exchange (INV-12/13) ─────────────────────────────── */

const X_GRID =
  "desk:grid-cols-[minmax(0,22fr)_minmax(0,11fr)_minmax(0,10fr)_minmax(0,9fr)_minmax(0,11fr)_minmax(0,10fr)_minmax(0,12fr)_30px]";

export function ExchangeCard({
  rows,
  results,
  errorFor,
  onRow,
  onMetal,
  onAdd,
  onRemove,
}: {
  rows: ExchangeForm[];
  results: ExchangeResult[];
  errorFor: ErrorFor;
  onRow: (i: number, patch: Partial<ExchangeForm>) => void;
  onMetal: (i: number, metal: Metal) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <Card aria-labelledby="xch-h">
      <CardHeader
        title={<span id="xch-h">Old gold / silver exchange</span>}
        description="Deducted after GST. GST is never reduced by exchange."
        actions={
          <Button size="sm" onClick={onAdd}>
            <Plus className="size-4" aria-hidden />
            Add old metal
          </Button>
        }
      />
      <div className="px-3 pt-3 pb-4 tab:px-5">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-3 text-[13px] text-muted">
            No old metal on this bill. Use <span className="font-medium text-ink-3">Add old metal</span> when the customer trades some in.
          </p>
        ) : (
          <>
            <div aria-hidden className={cn("hidden border-b border-line pb-2 text-[11.5px] font-medium text-muted desk:grid desk:gap-x-1.5", X_GRID)}>
              <span className="pl-2">Description</span>
              <span className="pl-2">Metal</span>
              <span className="pr-2 text-right">Weight g</span>
              <span className="pr-2 text-right">Touch %</span>
              <span className="pr-2 text-right">Fine rate/g ₹</span>
              <span className="pr-2 text-right">Fine wt g</span>
              <span className="pr-2 text-right">Value ₹</span>
              <span />
            </div>
            <ol className="flex flex-col gap-3 desk:gap-0">
              {rows.map((x, i) => {
                const r = results[i];
                const f = (k: string) => `exchange.${i}.${k}`;
                return (
                  <li
                    key={x.key}
                    className={cn(
                      "relative grid animate-enter grid-cols-2 gap-3 rounded-xl border border-line bg-canvas/50 p-3.5 tab:grid-cols-4",
                      "desk:items-center desk:gap-x-1.5 desk:gap-y-0 desk:rounded-none desk:border-0 desk:border-b desk:bg-transparent desk:p-0 desk:py-1.5",
                      X_GRID,
                    )}
                  >
                    <Field label="Description" field={f("description")} className="col-span-2 desk:col-span-1" labelClassName={label}>
                      {(p) => <TextInput {...p} value={x.description} onChange={(e) => onRow(i, { description: e.target.value })} className={cell} />}
                    </Field>
                    <Field label="Metal" field={f("metal")} labelClassName={label}>
                      {(p) => (
                        <Select {...p} value={x.metal} onChange={(e) => onMetal(i, e.target.value as Metal)} className={cn(cell, "desk:pr-6 desk:bg-position-[right_4px_center]")}>
                          <option>Gold</option>
                          <option>Silver</option>
                          <option>Platinum</option>
                          <option>Other</option>
                        </Select>
                      )}
                    </Field>
                    <Field label="Weight (g)" field={f("weight")} labelClassName={label} messageClassName={msg}>
                      {(p) => <NumInput {...p} kind="weight" value={x.weight} onValueChange={(v) => onRow(i, { weight: v })} placeholder="0.000" className={cell} />}
                    </Field>
                    <Field label="Touch %" field={f("touchPct")} error={errorFor(f("touchPct"))} labelClassName={label} messageClassName={msg}>
                      {(p) => <NumInput {...p} kind="pct" value={x.touchPct} onValueChange={(v) => onRow(i, { touchPct: v })} placeholder="0" className={cell} />}
                    </Field>
                    <Field label="Fine rate / g ₹" field={f("fineRate")} error={errorFor(f("fineRate"))} labelClassName={label} messageClassName={msg}>
                      {(p) => (
                        <NumInput {...p} kind="rate" value={x.fineRate} onValueChange={(v) => onRow(i, { fineRate: v, fineRateManual: true })} className={cell} />
                      )}
                    </Field>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-[12.5px] font-medium text-ink-3 desk:sr-only">Fine wt (g)</span>
                      <output className="num flex h-9 items-center justify-end rounded-lg bg-sunken px-3 text-[14px] text-ink-3 desk:h-8 desk:bg-transparent desk:px-2 desk:text-[13px]">
                        {r && r.fine !== "0.000" ? formatIndianNumber(r.fine, 3) : <span className="text-faint">—</span>}
                      </output>
                    </div>
                    <div className="col-span-full flex items-baseline justify-between border-t border-line pt-3 tab:col-span-2 desk:col-span-1 desk:block desk:border-0 desk:pt-0 desk:text-right">
                      <span className="text-[12.5px] font-medium text-muted desk:sr-only">Value</span>
                      <span className="num text-[15px] font-semibold desk:pr-2 desk:text-[13px]">
                        {r && r.value !== "0.00" ? <Flash value={r.value}>−{money(r.value)}</Flash> : <span className="font-normal text-faint">—</span>}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(i)}
                      aria-label={`Remove exchange item ${i + 1}`}
                      className="absolute top-2 right-2 grid size-8 place-items-center rounded-md text-faint transition-colors hover:bg-danger-fill hover:text-danger desk:static desk:size-7 desk:justify-self-center"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </Card>
  );
}
