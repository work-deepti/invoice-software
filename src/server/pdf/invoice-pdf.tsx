import "server-only";
import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
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
import type { InvoiceDTO } from "../invoices";
import type { SettingsDTO } from "../settings";

/* Fonts ship inside the repo (DEP-07: no CDN at runtime). Figtree (OFL) carries the ₹ glyph. */
const FONT_DIR = path.join(process.cwd(), "src/fonts/figtree");
let registered = false;
function registerFonts() {
  if (registered) return;
  const f = (w: number, name: string) => ({ src: path.join(FONT_DIR, `Figtree_${name}.ttf`), fontWeight: w });
  Font.register({ family: "Figtree", fonts: [f(400, "400Regular"), f(500, "500Medium"), f(600, "600SemiBold"), f(700, "700Bold"), f(800, "800ExtraBold")] });
  // Figtree with tabular figures frozen in (react-pdf can't switch OpenType features) so PDF columns align
  Font.register({
    family: "FigtreeTab",
    fonts: [
      { src: path.join(FONT_DIR, "FigtreeTab_400Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "FigtreeTab_600SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]);
  registered = true;
}

const C = {
  ink: "#0f172a",
  ink3: "#334155",
  muted: "#64748b",
  line: "#e2e8f0",
  lineStrong: "#cbd5e1",
  sunken: "#f1f5f9",
  gold: "#d97706",
  goldDeep: "#b45309",
  danger: "#b91c1c",
  dangerFill: "#fef2f2",
};

const s = StyleSheet.create({
  // No lineHeight on Page: react-pdf drops absolutely positioned fixed text (the page footer) when the page sets one.
  page: { paddingTop: 34, paddingBottom: 44, paddingHorizontal: 34, fontFamily: "Figtree", fontSize: 8, color: C.ink },
  // fontSize must sit beside lineHeight: react-pdf resolves a unitless lineHeight against the same node's font size (default 18).
  body: { lineHeight: 1.4, fontSize: 8 },
  mono: { fontFamily: "FigtreeTab" },
  row: { flexDirection: "row" },
  label: { fontSize: 6.5, fontWeight: 600, letterSpacing: 0.8, color: C.muted },
  th: { fontSize: 6.3, fontWeight: 600, color: C.ink3, letterSpacing: 0.3, textTransform: "uppercase" },
  td: { paddingVertical: 3.5, paddingRight: 3 },
  sub: { fontSize: 6.3, color: C.muted },
});

const money = (v: NumLike) => formatIndianNumber(v, 2);
const grams = (v: NumLike) => formatIndianNumber(v, 3);
const isZero = (v: NumLike) => toDec(v ?? 0).isZero();

type Inv = InvoiceDTO;

function InvoicePdf({ inv, copyLabel }: { inv: Inv; copyLabel?: string }) {
  const shop = inv.shopSnapshot as SettingsDTO;
  const heading = invoiceHeading(inv.gstOn, shop);
  const lines = inv.lines;
  const showWst = lines.some((l) => !isZero(l.wastagePct));
  const metals = [...new Set(lines.map((l) => l.metal))] as Metal[];
  const oneMetal = metals.length === 1;
  const totalPcs = lines.reduce((a, l) => a + (l.pcs || 0), 0);
  const sum = (pick: (l: (typeof lines)[number]) => string, m?: Metal) => lines.filter((l) => !m || l.metal === m).reduce((a, l) => a.plus(toDec(pick(l))), toDec(0));
  const rows = taxRows(inv.gstOn, inv.interState, inv);
  const grand = toDec(inv.grandTotal);

  // column widths (% of content width)
  const cols: { key: string; label: string; w: number; right?: boolean }[] = [
    { key: "n", label: "#", w: 3.5 },
    { key: "desc", label: "Description", w: showWst ? 13.5 : 17 },
    { key: "hsn", label: "HSN", w: 6 },
    { key: "pur", label: "Purity", w: showWst ? 12 : 13 },
    { key: "pcs", label: "Pcs", w: 4, right: true },
    { key: "gross", label: "Gross wt", w: 7.5, right: true },
    { key: "net", label: "Net wt", w: 7.5, right: true },
    ...(showWst ? [{ key: "wst", label: "Wst", w: 8, right: true }] : []),
    { key: "rate", label: "Rate/g", w: 8, right: true },
    { key: "mv", label: "Metal value", w: 9, right: true },
    { key: "mk", label: "Making", w: showWst ? 8.5 : 9, right: true },
    { key: "st", label: "Stone/other", w: 7, right: true },
    { key: "amt", label: "Amount", w: showWst ? 9.5 : 10, right: true },
  ];
  const W = (k: string) => `${cols.find((c) => c.key === k)!.w}%`;

  const header = (
    <View style={[s.row, { borderTopWidth: 0.8, borderBottomWidth: 0.8, borderColor: C.lineStrong, backgroundColor: C.sunken, paddingVertical: 4 }]}>
      {cols.map((c) => (
        <Text key={c.key} style={[s.th, { width: `${c.w}%`, textAlign: c.right ? "right" : "left", paddingRight: 3, paddingLeft: c.key === "n" ? 3 : 0 }]}>
          {c.label}
        </Text>
      ))}
    </View>
  );

  return (
    <Document title={inv.number} author={shop.name} subject={heading.title} creator="Gold & Silver Billing" producer="Gold & Silver Billing">
      <Page size="A4" style={s.page}>
        {/* repeated column header on pages 2+ (PRT-01) */}
        <View fixed render={({ pageNumber }) => (pageNumber > 1 ? <View style={{ marginBottom: 2 }}>{header}</View> : null)} />

        {inv.status === "cancelled" ? (
          <Text fixed style={{ position: "absolute", top: 330, left: 150, fontSize: 48, fontWeight: 700, color: "#dc2626", opacity: 0.25, transform: "rotate(-12deg)", letterSpacing: 6 }}>
            CANCELLED
          </Text>
        ) : null}

        <View style={s.body}>
        {/* header */}
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <View style={{ maxWidth: "62%" }}>
            <Text style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.25 }}>{shop.name || "—"}</Text>
            {shop.address ? <Text style={{ color: C.ink3, marginTop: 2 }}>{shop.address}</Text> : null}
            {shop.phone || shop.email ? <Text style={{ color: C.ink3 }}>{[shop.phone && `Ph: ${shop.phone}`, shop.email].filter(Boolean).join(" · ")}</Text> : null}
            {shop.gstin || shop.state ? (
              <Text style={{ color: C.ink3 }}>
                {[shop.gstin && `GSTIN: ${shop.gstin}`, shop.state && `State: ${shop.state}${shop.stateCode ? ` (${shop.stateCode})` : ""}`].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.6, lineHeight: 1.3 }}>{heading.title}</Text>
            {heading.subtitle || copyLabel ? <Text style={[s.label, { marginTop: 1 }]}>{copyLabel ?? heading.subtitle}</Text> : null}
            <View style={{ marginTop: 6 }}>
              {[
                ["Invoice no.", inv.number, true],
                ["Date", formatDateDMY(inv.invoiceDate), true],
                ["Payment", inv.payDetails ? `${inv.payMode} · ${inv.payDetails}` : inv.payMode, false],
              ].map(([k, v, mono]) => (
                <View key={String(k)} style={[s.row, { justifyContent: "flex-end" }]}>
                  <Text style={{ color: C.muted, marginRight: 8 }}>{k}</Text>
                  <Text style={[mono ? s.mono : {}, { fontWeight: k === "Invoice no." ? 600 : 400 }]}>{String(v)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={{ height: 1.6, backgroundColor: C.goldDeep, marginTop: 10 }} />

        {/* bill to / place of supply */}
        <View style={[s.row, { justifyContent: "space-between", marginTop: 8 }]}>
          <View style={{ maxWidth: "62%" }}>
            <Text style={s.label}>BILL TO</Text>
            <Text style={{ fontSize: 9.5, fontWeight: 600, marginTop: 1, lineHeight: 1.35 }}>{inv.customerName || "Cash customer"}</Text>
            {inv.customerAddress ? <Text style={{ color: C.ink3 }}>{inv.customerAddress}</Text> : null}
            {inv.customerPhone ? <Text style={{ color: C.ink3 }}>Ph: {inv.customerPhone}</Text> : null}
            {inv.customerGstin ? <Text style={{ color: C.ink3 }}>GSTIN: {inv.customerGstin}</Text> : null}
            {inv.customerPan ? <Text style={{ color: C.ink3 }}>PAN: {inv.customerPan}</Text> : null}
            {!inv.customerPan && inv.panDeclaration ? <Text style={{ color: C.ink3 }}>No-PAN declaration (Form 60) received</Text> : null}
          </View>
          {inv.gstOn ? (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.label}>PLACE OF SUPPLY</Text>
              <Text style={{ fontSize: 9, fontWeight: 500, marginTop: 1, lineHeight: 1.35 }}>{inv.placeOfSupply || "—"}</Text>
            </View>
          ) : null}
        </View>

        {/* items */}
        <View style={{ marginTop: 10 }}>
          {header}
          {lines.map((l) => (
            <View key={l.id} wrap={false} style={[s.row, { borderBottomWidth: 0.6, borderColor: C.line }]}>
              <Text style={[s.td, s.mono, { width: W("n"), paddingLeft: 3, color: C.muted }]}>{l.lineNo}</Text>
              <Text style={[s.td, { width: W("desc"), fontWeight: 500 }]}>{l.description || "—"}</Text>
              <Text style={[s.td, s.mono, { width: W("hsn") }]}>{l.hsn}</Text>
              <Text style={[s.td, { width: W("pur") }]}>{l.purityLabel}</Text>
              <Text style={[s.td, s.mono, { width: W("pcs"), textAlign: "right" }]}>{l.pcs || "—"}</Text>
              <Text style={[s.td, s.mono, { width: W("gross"), textAlign: "right" }]}>{isZero(l.grossG) ? "—" : grams(l.grossG)}</Text>
              <Text style={[s.td, s.mono, { width: W("net"), textAlign: "right" }]}>{isZero(l.netG) ? "—" : grams(l.netG)}</Text>
              {showWst ? (
                <View style={[s.td, { width: W("wst"), alignItems: "flex-end" }]}>
                  <Text style={s.mono}>{isZero(l.wastagePct) ? "—" : `${formatPct(l.wastagePct)}%`}</Text>
                  {!isZero(l.wastagePct) ? <Text style={[s.sub, s.mono]}>= {grams(l.chargeableG)} g</Text> : null}
                </View>
              ) : null}
              <Text style={[s.td, s.mono, { width: W("rate"), textAlign: "right" }]}>{isZero(l.ratePerG) ? "—" : money(l.ratePerG)}</Text>
              <Text style={[s.td, s.mono, { width: W("mv"), textAlign: "right" }]}>{isZero(l.metalValue) ? "—" : money(l.metalValue)}</Text>
              <View style={[s.td, { width: W("mk"), alignItems: "flex-end" }]}>
                <Text style={s.mono}>{isZero(l.makingAmt) ? "—" : money(l.makingAmt)}</Text>
                {!isZero(l.makingAmt) && l.makingType !== "flat" ? (
                  <Text style={s.sub}>
                    {l.makingType === "per_g" ? `@ ₹${formatIndianNumber(l.makingInput, toDec(l.makingInput).isInteger() ? 0 : 2)}/g` : `${formatPct(l.makingInput)}% of value`}
                  </Text>
                ) : null}
              </View>
              <Text style={[s.td, s.mono, { width: W("st"), textAlign: "right" }]}>{isZero(l.stoneAmt) ? "—" : money(l.stoneAmt)}</Text>
              <Text style={[s.td, s.mono, { width: W("amt"), textAlign: "right", fontWeight: 600 }]}>{money(l.amount)}</Text>
            </View>
          ))}
          <View wrap={false} style={[s.row, { borderBottomWidth: 0.8, borderColor: C.lineStrong, fontWeight: 600 }]}>
            <Text style={[s.td, { width: `${cols.slice(0, 4).reduce((a, c) => a + c.w, 0)}%`, paddingLeft: 3 }]}>Total</Text>
            <Text style={[s.td, s.mono, { width: W("pcs"), textAlign: "right" }]}>{totalPcs || "—"}</Text>
            <Text style={[s.td, s.mono, { width: W("gross"), textAlign: "right" }]}>{oneMetal ? grams(sum((l) => l.grossG)) : ""}</Text>
            <Text style={[s.td, s.mono, { width: W("net"), textAlign: "right" }]}>{oneMetal ? grams(sum((l) => l.netG)) : ""}</Text>
            <Text style={[s.td, { width: `${cols.slice(7, -1).reduce((a, c) => a + c.w, 0)}%` }]} />
            <Text style={[s.td, s.mono, { width: W("amt"), textAlign: "right" }]}>{money(inv.itemsTotal)}</Text>
          </View>
          {!oneMetal && lines.length ? (
            <Text style={{ marginTop: 3, color: C.ink3, fontSize: 7.5 }}>
              {metals.map((m) => `${m} — gross ${formatWeight(sum((l) => l.grossG, m))}, net ${formatWeight(sum((l) => l.netG, m))}`).join(" · ")}
            </Text>
          ) : null}
        </View>

        {/* exchange */}
        {inv.exchange.length ? (
          <View wrap={false} style={{ marginTop: 10 }}>
            <Text style={[s.label, { marginBottom: 3 }]}>OLD GOLD / SILVER TAKEN IN EXCHANGE</Text>
            <View style={[s.row, { borderTopWidth: 0.8, borderBottomWidth: 0.8, borderColor: C.lineStrong, backgroundColor: C.sunken, paddingVertical: 4 }]}>
              {[
                ["Description", 28, false],
                ["Metal", 12, false],
                ["Weight", 12, true],
                ["Touch %", 11, true],
                ["Fine wt", 12, true],
                ["Rate/g", 12, true],
                ["Value", 13, true],
              ].map(([l, w, r]) => (
                <Text key={String(l)} style={[s.th, { width: `${w}%`, textAlign: r ? "right" : "left", paddingRight: 3, paddingLeft: l === "Description" ? 3 : 0 }]}>
                  {String(l)}
                </Text>
              ))}
            </View>
            {inv.exchange.map((x) => (
              <View key={x.id} style={[s.row, { borderBottomWidth: 0.6, borderColor: C.line }]}>
                <Text style={[s.td, { width: "28%", paddingLeft: 3 }]}>{x.description}</Text>
                <Text style={[s.td, { width: "12%" }]}>{x.metal}</Text>
                <Text style={[s.td, s.mono, { width: "12%", textAlign: "right" }]}>{grams(x.weightG)}</Text>
                <Text style={[s.td, s.mono, { width: "11%", textAlign: "right" }]}>{formatPct(x.touchPct)}</Text>
                <Text style={[s.td, s.mono, { width: "12%", textAlign: "right" }]}>{grams(x.fineG)}</Text>
                <Text style={[s.td, s.mono, { width: "12%", textAlign: "right" }]}>{money(x.fineRate)}</Text>
                <Text style={[s.td, s.mono, { width: "13%", textAlign: "right", fontWeight: 600 }]}>{money(x.value)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* words / notes / totals — kept together (PRT-01) */}
        <View wrap={false} style={[s.row, { marginTop: 14, justifyContent: "space-between" }]}>
          <View style={{ width: "55%" }}>
            <Text style={s.label}>AMOUNT IN WORDS</Text>
            <Text style={{ fontSize: 8.5, fontWeight: 600, marginTop: 1 }}>{amountInWords(grand.abs())}</Text>
            {inv.notes ? (
              <View style={{ marginTop: 8 }}>
                <Text style={s.label}>NOTES</Text>
                <Text style={{ color: C.ink3, marginTop: 1 }}>{inv.notes}</Text>
              </View>
            ) : null}
            {shop.bankDetails ? (
              <View style={{ marginTop: 8 }}>
                <Text style={s.label}>BANK / UPI</Text>
                <Text style={{ color: C.ink3, marginTop: 1 }}>{shop.bankDetails}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ width: "38%", borderWidth: 0.8, borderColor: C.line, borderRadius: 4 }}>
            <TRow label="Items total" value={money(inv.itemsTotal)} />
            {!isZero(inv.discount) ? <TRow label="Discount" value={`−${money(inv.discount)}`} /> : null}
            <TRow label={inv.gstOn ? "Taxable value" : "Net amount"} value={money(inv.taxable)} strong={inv.gstOn} />
            {rows.map((r) => (
              <TRow key={r.key} label={r.label} value={money(r.amount)} />
            ))}
            {!isZero(inv.exchangeTotal) ? <TRow label="Less old gold / silver" value={`−${money(inv.exchangeTotal)}`} /> : null}
            {!isZero(inv.roundOff) ? <TRow label="Round off" value={`${toDec(inv.roundOff).isNeg() ? "−" : "+"}${money(toDec(inv.roundOff).abs())}`} /> : null}
            <View style={[s.row, { justifyContent: "space-between", backgroundColor: C.ink, paddingHorizontal: 7, paddingVertical: 5 }]}>
              <Text style={{ color: "#fff", fontWeight: 500 }}>{grand.lt(0) ? "Payable to customer" : "Grand total"}</Text>
              <Text style={[s.mono, { color: "#fff", fontSize: 10.5, fontWeight: 600, lineHeight: 1.3 }]}>{formatINR(grand.abs())}</Text>
            </View>
            <TRow label={`Received (${inv.payMode})`} value={money(toDec(inv.paid).abs())} />
            {!isZero(inv.changeReturned) ? <TRow label="Change returned" value={money(inv.changeReturned)} /> : null}
            {toDec(inv.balance).gt(0) ? <TRow label="Balance due" value={formatINR(inv.balance)} danger /> : null}
          </View>
        </View>

        {/* footer */}
        <View wrap={false} style={[s.row, { marginTop: 22, paddingTop: 8, borderTopWidth: 0.6, borderColor: C.line, justifyContent: "space-between", alignItems: "flex-end" }]}>
          <View style={{ width: "58%" }}>
            {shop.terms ? (
              <>
                <Text style={s.label}>TERMS</Text>
                <Text style={{ color: C.muted, fontSize: 7, marginTop: 1 }}>{shop.terms}</Text>
              </>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: C.ink3 }}>For {shop.name || "the shop"}</Text>
            <View style={{ width: 130, borderTopWidth: 0.8, borderColor: C.ink3, marginTop: 28 }} />
            <Text style={{ color: C.muted, fontSize: 7.5, marginTop: 2 }}>{shop.signatoryLabel || "Authorised Signatory"}</Text>
          </View>
        </View>

        </View>

        {/* page footer on every page */}
        <Text
          fixed
          style={[s.mono, { position: "absolute", bottom: 18, right: 34, fontSize: 6.8, color: C.muted }]}
          render={({ pageNumber, totalPages }) => `${inv.number} · Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

function TRow({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <View style={[s.row, { justifyContent: "space-between", paddingHorizontal: 7, paddingVertical: 3.5, borderBottomWidth: 0.6, borderColor: C.line }, danger ? { backgroundColor: C.dangerFill } : {}]}>
      <Text style={{ color: danger ? C.danger : strong ? C.ink : C.ink3, fontWeight: strong || danger ? 600 : 400 }}>{label}</Text>
      <Text style={[s.mono, { fontWeight: strong || danger ? 600 : 400, color: danger ? C.danger : C.ink }]}>{value}</Text>
    </View>
  );
}

/** PRT-05: a true vector/text PDF, rendered on the server from the saved snapshot. */
export async function renderInvoicePdf(inv: Inv, opts: { duplicate?: boolean } = {}): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<InvoicePdf inv={inv} copyLabel={opts.duplicate ? "DUPLICATE FOR SUPPLIER" : undefined} />);
}
