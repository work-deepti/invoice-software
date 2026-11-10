import {
  amountInWords,
  formatDateDMY,
  formatINR,
  formatIndianNumber,
  formatPct,
  formatWeight,
  invoiceHeading,
  taxRows,
  toDec,
  type Metal,
  type NumLike,
} from "@/lib/calc-engine";
import { cn } from "@/lib/cn";
import { snapshotOf, type SavedInvoice } from "./types";

const money = (v: NumLike) => formatIndianNumber(v, 2);
const grams = (v: NumLike) => formatIndianNumber(v, 3);
const isZero = (v: NumLike) => toDec(v ?? 0).isZero();

/**
 * The printed invoice (§10.1), A4 portrait. One template for the screen
 * preview and direct print; it reads only the saved snapshot (PRT-03).
 */
export function InvoiceDocument({
  invoice: inv,
  copyLabel,
  className,
}: {
  invoice: SavedInvoice;
  copyLabel?: string;
  className?: string;
}) {
  const shop = snapshotOf(inv);
  const heading = invoiceHeading(inv.gstOn, shop);
  const lines = inv.lines;
  const showWastage = lines.some((l) => !isZero(l.wastagePct));
  const metals = [...new Set(lines.map((l) => l.metal))] as Metal[];
  const oneMetal = metals.length === 1;
  const totalPcs = lines.reduce((s, l) => s + (l.pcs || 0), 0);
  const sum = (pick: (l: (typeof lines)[number]) => string, metal?: Metal) =>
    lines.filter((l) => !metal || l.metal === metal).reduce((s, l) => s.plus(toDec(pick(l))), toDec(0));
  const rows = taxRows(inv.gstOn, inv.interState, inv);
  const grand = toDec(inv.grandTotal);
  const payable = grand.lt(0);
  const shopCode = shop.stateCode ? ` (${shop.stateCode})` : "";
  const cols = showWastage ? 13 : 12;

  return (
    <article
      className={cn(
        "light-scope print-doc relative mx-auto w-[794px] bg-white px-[44px] pt-[40px] pb-[36px] text-[10.5px] leading-[1.45] text-ink",
        className,
      )}
      style={{ fontFeatureSettings: '"tnum"' }}
    >
      {inv.status === "cancelled" ? (
        <div
          aria-label="Cancelled"
          className="pointer-events-none absolute top-[38%] left-1/2 -translate-x-1/2 -rotate-12 rounded-lg border-[3px] border-danger/70 px-6 py-2 text-[44px] font-bold tracking-[0.12em] text-danger/70"
        >
          CANCELLED
        </div>
      ) : null}

      {/* 1–2. Header */}
      <header className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          <h1 className="tight text-[22px] leading-tight font-semibold">{shop.name || "—"}</h1>
          {shop.address ? <p className="mt-1 whitespace-pre-line text-ink-3">{shop.address}</p> : null}
          {shop.phone || shop.email ? (
            <p className="text-ink-3">{[shop.phone && `Ph: ${shop.phone}`, shop.email].filter(Boolean).join(" · ")}</p>
          ) : null}
          {shop.gstin || shop.state ? (
            <p className="text-ink-3">
              {[shop.gstin && `GSTIN: ${shop.gstin}`, shop.state && `State: ${shop.state}${shopCode}`].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="tight text-[15px] font-semibold tracking-[0.04em]">{heading.title}</p>
          {heading.subtitle || copyLabel ? (
            <p className="text-[9px] font-medium tracking-[0.12em] text-muted">{copyLabel ?? heading.subtitle}</p>
          ) : null}
          <dl className="mt-2 grid grid-cols-[auto_auto] justify-end gap-x-3 gap-y-0.5 text-[10.5px]">
            <dt className="text-muted">Invoice no.</dt>
            <dd className="font-mono font-semibold">{inv.number}</dd>
            <dt className="text-muted">Date</dt>
            <dd className="font-mono">{formatDateDMY(inv.invoiceDate)}</dd>
            <dt className="text-muted">Payment</dt>
            <dd className="max-w-[200px]">{inv.payDetails ? `${inv.payMode} · ${inv.payDetails}` : inv.payMode}</dd>
          </dl>
        </div>
      </header>

      {/* 3. Gold rule */}
      <div aria-hidden className="mt-4 h-[2px] bg-gradient-to-r from-gold-deep via-gold to-gold-deep/30" />

      {/* 4. Bill to / place of supply */}
      <section className="mt-3 flex justify-between gap-8">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold tracking-[0.1em] text-muted">BILL TO</p>
          <p className="mt-0.5 text-[12px] font-semibold">{inv.customerName || "Cash customer"}</p>
          {inv.customerAddress ? <p className="whitespace-pre-line text-ink-3">{inv.customerAddress}</p> : null}
          {inv.customerPhone ? <p className="text-ink-3">Ph: {inv.customerPhone}</p> : null}
          {inv.customerGstin ? <p className="text-ink-3">GSTIN: {inv.customerGstin}</p> : null}
          {inv.customerPan ? <p className="text-ink-3">PAN: {inv.customerPan}</p> : null}
          {!inv.customerPan && inv.panDeclaration ? <p className="text-ink-3">No-PAN declaration (Form 60) received</p> : null}
        </div>
        {inv.gstOn ? (
          <div className="shrink-0 text-right">
            <p className="text-[9px] font-semibold tracking-[0.1em] text-muted">PLACE OF SUPPLY</p>
            <p className="mt-0.5 text-[11.5px] font-medium">{inv.placeOfSupply || "—"}</p>
          </div>
        ) : null}
      </section>

      {/* 5–7. Items */}
      <table className="mt-4 w-full border-collapse text-[9.5px]">
        <thead>
          <tr className="border-y border-line-strong bg-sunken/70 text-left text-[8.5px] font-semibold tracking-[0.04em] text-ink-3 uppercase">
            <th className="py-1.5 pr-1 pl-1.5 font-semibold">#</th>
            <th className="py-1.5 pr-1 font-semibold">Description</th>
            <th className="py-1.5 pr-1 font-semibold">HSN</th>
            <th className="py-1.5 pr-1 font-semibold">Purity</th>
            <th className="py-1.5 pr-1 text-right font-semibold">Pcs</th>
            <th className="py-1.5 pr-1 text-right font-semibold">Gross wt</th>
            <th className="py-1.5 pr-1 text-right font-semibold">Net wt</th>
            {showWastage ? <th className="py-1.5 pr-1 text-right font-semibold">Wst</th> : null}
            <th className="py-1.5 pr-1 text-right font-semibold">Rate/g</th>
            <th className="py-1.5 pr-1 text-right font-semibold">Metal value</th>
            <th className="py-1.5 pr-1 text-right font-semibold">Making</th>
            <th className="py-1.5 pr-1 text-right font-semibold">Stone/other</th>
            <th className="py-1.5 pr-1.5 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="border-b border-line align-top">
              <td className="py-1.5 pr-1 pl-1.5 font-mono text-muted">{l.lineNo}</td>
              <td className="py-1.5 pr-1 font-medium">{l.description || "—"}</td>
              <td className="py-1.5 pr-1 font-mono">{l.hsn}</td>
              <td className="py-1.5 pr-1 whitespace-nowrap">{l.purityLabel}</td>
              <td className="py-1.5 pr-1 text-right font-mono">{l.pcs || "—"}</td>
              <td className="py-1.5 pr-1 text-right font-mono">{isZero(l.grossG) ? "—" : grams(l.grossG)}</td>
              <td className="py-1.5 pr-1 text-right font-mono">{isZero(l.netG) ? "—" : grams(l.netG)}</td>
              {showWastage ? (
                <td className="py-1.5 pr-1 text-right font-mono">
                  {isZero(l.wastagePct) ? (
                    "—"
                  ) : (
                    <>
                      {formatPct(l.wastagePct)}%<span className="block text-[8.5px] text-muted">= {grams(l.chargeableG)} g</span>
                    </>
                  )}
                </td>
              ) : null}
              <td className="py-1.5 pr-1 text-right font-mono">{isZero(l.ratePerG) ? "—" : money(l.ratePerG)}</td>
              <td className="py-1.5 pr-1 text-right font-mono">{isZero(l.metalValue) ? "—" : money(l.metalValue)}</td>
              <td className="py-1.5 pr-1 text-right font-mono">
                {isZero(l.makingAmt) ? (
                  "—"
                ) : (
                  <>
                    {money(l.makingAmt)}
                    {l.makingType !== "flat" ? (
                      <span className="block text-[8.5px] text-muted">
                        {l.makingType === "per_g" ? `@ ₹${formatIndianNumber(l.makingInput, toDec(l.makingInput).isInteger() ? 0 : 2)}/g` : `${formatPct(l.makingInput)}% of value`}
                      </span>
                    ) : null}
                  </>
                )}
              </td>
              <td className="py-1.5 pr-1 text-right font-mono">{isZero(l.stoneAmt) ? "—" : money(l.stoneAmt)}</td>
              <td className="py-1.5 pr-1.5 text-right font-mono font-semibold">{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="print-keep border-b border-line-strong font-semibold">
            <td className="py-1.5 pl-1.5" colSpan={4}>
              Total
            </td>
            <td className="py-1.5 pr-1 text-right font-mono">{totalPcs || "—"}</td>
            <td className="py-1.5 pr-1 text-right font-mono">{oneMetal ? grams(sum((l) => l.grossG)) : ""}</td>
            <td className="py-1.5 pr-1 text-right font-mono">{oneMetal ? grams(sum((l) => l.netG)) : ""}</td>
            <td colSpan={cols - 8} />
            <td className="py-1.5 pr-1.5 text-right font-mono">{money(inv.itemsTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {!oneMetal && lines.length ? (
        <p className="print-keep mt-1.5 text-[9.5px] text-ink-3">
          {metals
            .map((m) => `${m} — gross ${formatWeight(sum((l) => l.grossG, m))}, net ${formatWeight(sum((l) => l.netG, m))}`)
            .join(" · ")}
        </p>
      ) : null}

      {/* 8. Exchange */}
      {inv.exchange.length ? (
        <table className="print-keep mt-4 w-full border-collapse text-[9.5px]">
          <caption className="pb-1 text-left text-[9px] font-semibold tracking-[0.1em] text-muted">OLD GOLD / SILVER TAKEN IN EXCHANGE</caption>
          <thead>
            <tr className="border-y border-line-strong bg-sunken/70 text-left text-[8.5px] font-semibold tracking-[0.04em] text-ink-3 uppercase">
              <th className="py-1.5 pl-1.5">Description</th>
              <th className="py-1.5">Metal</th>
              <th className="py-1.5 text-right">Weight</th>
              <th className="py-1.5 text-right">Touch %</th>
              <th className="py-1.5 text-right">Fine wt</th>
              <th className="py-1.5 text-right">Rate/g</th>
              <th className="py-1.5 pr-1.5 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {inv.exchange.map((x) => (
              <tr key={x.id} className="border-b border-line">
                <td className="py-1.5 pl-1.5">{x.description}</td>
                <td className="py-1.5">{x.metal}</td>
                <td className="py-1.5 text-right font-mono">{grams(x.weightG)}</td>
                <td className="py-1.5 text-right font-mono">{formatPct(x.touchPct)}</td>
                <td className="py-1.5 text-right font-mono">{grams(x.fineG)}</td>
                <td className="py-1.5 text-right font-mono">{money(x.fineRate)}</td>
                <td className="py-1.5 pr-1.5 text-right font-mono font-semibold">{money(x.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {/* 9. Words / notes / bank + totals */}
      <section className="print-keep mt-5 grid grid-cols-[1fr_270px] gap-8">
        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-[9px] font-semibold tracking-[0.1em] text-muted">AMOUNT IN WORDS</p>
            <p className="mt-0.5 text-[11px] font-semibold">{amountInWords(grand.abs())}</p>
          </div>
          {inv.notes ? (
            <div>
              <p className="text-[9px] font-semibold tracking-[0.1em] text-muted">NOTES</p>
              <p className="mt-0.5 whitespace-pre-line text-ink-3">{inv.notes}</p>
            </div>
          ) : null}
          {shop.bankDetails ? (
            <div>
              <p className="text-[9px] font-semibold tracking-[0.1em] text-muted">BANK / UPI</p>
              <p className="mt-0.5 whitespace-pre-line text-ink-3">{shop.bankDetails}</p>
            </div>
          ) : null}
        </div>
        <dl className="self-start overflow-hidden rounded-lg border border-line text-[10.5px]">
          <Row label="Items total" value={money(inv.itemsTotal)} />
          {!isZero(inv.discount) ? <Row label="Discount" value={`−${money(inv.discount)}`} /> : null}
          <Row label={inv.gstOn ? "Taxable value" : "Net amount"} value={money(inv.taxable)} strong={inv.gstOn} />
          {rows.map((r) => (
            <Row key={r.key} label={r.label} value={money(r.amount)} />
          ))}
          {!isZero(inv.exchangeTotal) ? <Row label="Less old gold / silver" value={`−${money(inv.exchangeTotal)}`} /> : null}
          {!isZero(inv.roundOff) ? (
            <Row label="Round off" value={`${toDec(inv.roundOff).isNeg() ? "−" : "+"}${money(toDec(inv.roundOff).abs())}`} />
          ) : null}
          <div className="flex items-baseline justify-between gap-3 bg-ink px-3 py-2 text-white">
            <dt className="text-[10.5px] font-medium">{payable ? "Payable to customer" : "Grand total"}</dt>
            <dd className="font-mono text-[14px] font-semibold">{formatINR(grand.abs())}</dd>
          </div>
          <Row label={`Received (${inv.payMode})`} value={money(toDec(inv.paid).abs())} />
          {!isZero(inv.changeReturned) ? <Row label="Change returned" value={money(inv.changeReturned)} /> : null}
          {toDec(inv.balance).gt(0) ? <Row label="Balance due" value={formatINR(inv.balance)} danger /> : null}
        </dl>
      </section>

      {/* 10. Footer */}
      <footer className="print-keep mt-8 flex items-end justify-between gap-8 border-t border-line pt-3">
        <div className="max-w-[60%] text-[9px] text-muted">
          {shop.terms ? (
            <>
              <p className="font-semibold tracking-[0.1em]">TERMS</p>
              <p className="mt-0.5 whitespace-pre-line">{shop.terms}</p>
            </>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-[10px] text-ink-3">For {shop.name || "the shop"}</p>
          <div className="mt-9 ml-auto w-44 border-t border-ink-3" />
          <p className="mt-1 text-[9.5px] text-muted">{shop.signatoryLabel || "Authorised Signatory"}</p>
        </div>
      </footer>
    </article>
  );
}

function Row({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 border-b border-line px-3 py-1.5 last:border-b-0", danger && "bg-danger-fill")}>
      <dt className={cn("text-ink-3", strong && "font-semibold text-ink", danger && "font-semibold text-danger-deep")}>{label}</dt>
      <dd className={cn("font-mono", strong && "font-semibold", danger && "font-semibold text-danger-deep")}>{value}</dd>
    </div>
  );
}
