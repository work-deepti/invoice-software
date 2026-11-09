/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeAll, describe, expect, it } from "vitest";
import { financialYear, todayIST } from "@/lib/calc-engine";
import * as setupRoute from "@/app/api/auth/setup/route";
import * as loginRoute from "@/app/api/auth/login/route";
import * as usersRoute from "@/app/api/users/route";
import * as settingsRoute from "@/app/api/settings/route";
import * as ratesRoute from "@/app/api/rates/route";
import * as invoicesRoute from "@/app/api/invoices/route";
import * as invoiceById from "@/app/api/invoices/[id]/route";
import * as csvRoute from "@/app/api/export/csv/route";
import * as backupRoute from "@/app/api/backup/route";
import * as restoreRoute from "@/app/api/restore/route";
import * as dashRoute from "@/app/api/dashboard/[page]/route";
import { call, tokenFrom } from "./helpers";

const run = !!process.env.TEST_DATABASE_URL;
const TODAY = todayIST();
const FY = financialYear(TODAY);

async function sql<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const { getDb } = await import("@/server/db");
  return ((await (getDb() as any).$client.query(text, params)).rows) as T[];
}

async function raw(handler: unknown, path: string, token: string) {
  const req = new Request(`http://test.local${path}`, { headers: { authorization: `Bearer ${token}` } });
  const res = await (handler as any)(req, { params: Promise.resolve({}) });
  const bytes = new Uint8Array(await res.arrayBuffer());
  // decode with ignoreBOM so the byte-order mark stays visible to the assertions
  return { status: res.status, bytes, text: new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes), headers: res.headers as Headers };
}

const line = (p: Record<string, unknown>) => ({ description: "Item", metal: "Gold", purityLabel: "Gold 22K (916)", pcs: "1", makingType: "per_g", ...p });
const body = (p: Record<string, unknown> = {}) => ({
  date: TODAY,
  payMode: "UPI",
  gstOn: true,
  customer: { name: "Kiran Shah", phone: "9800000000", state: "Maharashtra" },
  lines: [],
  exchange: [],
  acceptWarnings: true,
  ...p,
});
const T01 = () =>
  body({
    payMode: "Mixed",
    payDetails: "HDFC Bank",
    received: "150000",
    discount: "1500",
    customer: { name: "Asha Patil", phone: "9123456780", state: "Maharashtra", pan: "ABCDE1234F" },
    lines: [
      line({ description: "Necklace", gross: "25.450", less: "1.200", wastagePct: "8", rate: "7150", makingValue: "600", stone: "4500" }),
      line({ description: "Diamond ring", purityLabel: "Gold 18K (750)", gross: "4.120", less: "0.180", rate: "5860", makingType: "pct", makingValue: "15", stone: "18500" }),
      line({ description: "Anklets", metal: "Silver", purityLabel: "Silver 925", pcs: "2", gross: "62.300", rate: "91", makingType: "flat", makingValue: "1200" }),
    ],
    exchange: [{ description: "Old gold", metal: "Gold", weight: "8.500", touchPct: "91.6", fineRate: "7800" }],
  });
const T02 = () => body({ customer: { name: "Mehul", phone: "9200000002" }, lines: [line({ gross: "10", rate: "7150", makingValue: "450" })] });
const T04 = () =>
  body({ interState: true, customer: { name: "Ravi", phone: "9988776655", state: "Karnataka", gstin: "29ABCDE1234F1Z5" }, lines: [line({ gross: "12", rate: "7150", makingValue: "500" })] });

describe.skipIf(!run)("Step 4: ledger export, backup/restore, dashboards", () => {
  let owner = "";
  let staff = "";
  let viewer = "";
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    owner = tokenFrom(await call(setupRoute.POST, { method: "POST", body: { name: "Owner", login: "owner", password: "owner-pass-1" } }));
    for (const role of ["staff", "viewer"] as const) {
      await call(usersRoute.POST, { method: "POST", token: owner, body: { name: role, login: role, password: `${role}-pass-1`, role } });
      const t = tokenFrom(await call(loginRoute.POST, { method: "POST", body: { login: role, password: `${role}-pass-1` } }));
      if (role === "staff") staff = t;
      else viewer = t;
    }
    await call(settingsRoute.PUT, {
      method: "PUT",
      token: owner,
      body: {
        name: "Shree Jewellers", phone: "9876543210", email: "", gstin: "27ABCDE1234F1Z5", state: "Maharashtra", stateCode: "27",
        address: "Pune", gstRate: "3", gstDefault: true, prefixGst: "INV", prefixNoGst: "BILL", noGstTitle: "INVOICE",
        hsnGold: "7113", hsnSilver: "7113", fyNumbering: true, terms: "", bankDetails: "", signatoryLabel: "Authorised Signatory",
        staffCanSeeDashboard: false,
      },
    });
    const g = (await call(ratesRoute.GET, { token: owner })).body.rows;
    const rates: Record<string, string> = { "Gold 24K (999)": "7800", "Gold 22K (916)": "7150", "Gold 18K (750)": "5860", "Silver 999": "98", "Silver 925": "91" };
    await call(ratesRoute.PUT, { method: "PUT", token: owner, body: { rows: g.map((x: any) => ({ ...x, rate: rates[x.label] })) } });
    for (const [k, b] of [["t01", T01()], ["t02", T02()], ["t04", T04()]] as const) {
      const r = await call(invoicesRoute.POST, { method: "POST", token: owner, body: b });
      expect(r.status).toBe(201);
      ids[k] = r.body.invoice.id;
    }
  });

  /* ── dashboards ──────────────────────────────────────────────────── */

  it("T-40 overview: 3 bills → sales 3,76,535; gold 50.190 g; silver 62.300 g", async () => {
    const r = await call(dashRoute.GET, { token: owner, path: "/api/dashboard/overview?period=month", params: { page: "overview" } });
    expect(r.status).toBe(200);
    const k = r.body.data.kpis;
    expect(k.sales.value).toBe("376535.00");
    expect(k.invoices.value).toBe("3");
    expect(k.goldG.value).toBe("50.190");
    expect(k.silverG.value).toBe("62.300");
    expect(k.gst.value).toBe("12735.88");
    expect(k.dues.value).toBe("53701.00");
    expect(k.avgBill.value).toBe("125511.67");
    const sum = r.body.data.trend.reduce((a: number, t: any) => a + Number(t.sales), 0);
    expect(sum.toFixed(2)).toBe("376535.00");
    expect(r.body.data.topCustomers[0]).toMatchObject({ phone: "9123456780", sales: "203701.00" });
    expect(r.body.data.rates.rows.find((x: any) => x.label === "Gold 22K (916)").rate).toBe("7150.00");
  });

  it("metal / GST / mode filters use the pre-aggregated table", async () => {
    const silver = await call(dashRoute.GET, { token: owner, path: "/api/dashboard/overview?period=month&metal=silver", params: { page: "overview" } });
    expect(silver.body.data.kpis.invoices.value).toBe("1");
    expect(silver.body.data.kpis.goldG.value).toBe("0.000");
    const igst = await call(dashRoute.GET, { token: owner, path: "/api/dashboard/overview?period=month&mode=UPI", params: { page: "overview" } });
    expect(igst.body.data.kpis.sales.value).toBe("172834.00"); // 78,280 + 94,554
    const noGst = await call(dashRoute.GET, { token: owner, path: "/api/dashboard/overview?period=month&gst=without", params: { page: "overview" } });
    expect(noGst.body.data.kpis.sales.value).toBe("0.00");
  });

  it("T-43 monthly GST table equals the invoice sums", async () => {
    const r = await call(dashRoute.GET, { token: viewer, path: "/api/dashboard/gst?period=fy", params: { page: "gst" } });
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.fy).toBe(FY);
    expect(d.monthly).toHaveLength(12);
    const tot = (k: string) => d.monthly.reduce((a: number, m: any) => a + Number(m[k]), 0).toFixed(2);
    const [inv] = await sql(`select sum(cgst)::text c, sum(sgst)::text s, sum(igst)::text i, sum(taxable)::text t from invoices where gst_on and status='active'`);
    expect([tot("cgst"), tot("sgst"), tot("igst"), tot("taxable")]).toEqual([Number(inv.c).toFixed(2), Number(inv.s).toFixed(2), Number(inv.i).toFixed(2), Number(inv.t).toFixed(2)]);
    const month = d.monthly.find((m: any) => m.invoices > 0);
    expect(month.first).toBe(`INV/${FY}/001`);
    expect(month.last).toBe(`INV/${FY}/003`);
    expect(d.b2b).toEqual([expect.objectContaining({ gstin: "29ABCDE1234F1Z5", invoices: 1, taxable: "91800.00" })]);
    expect(d.hsn).toEqual([expect.objectContaining({ hsn: "7113" })]);
    const hsnTax = (Number(d.hsn[0].cgst) + Number(d.hsn[0].sgst) + Number(d.hsn[0].igst)).toFixed(2);
    expect(hsnTax).toBe("12735.88");
  });

  it("sales, customers, payments and rates pages return data", async () => {
    const s = await call(dashRoute.GET, { token: owner, path: "/api/dashboard/sales?period=month", params: { page: "sales" } });
    expect(s.body.data.byPurity.find((x: any) => x.purity === "Gold 22K (916)")).toMatchObject({ grams: "46.250" });
    expect(s.body.data.billSize.reduce((a: number, b: any) => a + b.count, 0)).toBe(3);
    expect(s.body.data.heatmap.reduce((a: number, b: any) => a + b.count, 0)).toBe(3);
    const c = await call(dashRoute.GET, { token: owner, path: "/api/dashboard/customers?period=month", params: { page: "customers" } });
    expect(c.body.data.kpis.unique.value).toBe("3");
    expect(c.body.data.dues).toEqual([expect.objectContaining({ phone: "9123456780", balance: "53701.00" })]);
    const lookup = await call(dashRoute.GET, { token: owner, path: "/api/dashboard/customers?lookup=9123456780", params: { page: "customers" } });
    expect(lookup.body.data.lookup).toMatchObject({ invoices: 1, sales: "203701.00", gold: "28.190", dues: "53701.00" });
    const p = await call(dashRoute.GET, { token: owner, path: "/api/dashboard/payments?period=month", params: { page: "payments" } });
    expect(p.body.data.byMode.map((m: any) => m.mode).sort()).toEqual(["Mixed", "UPI"]);
    expect(p.body.data.kpis.received.value).toBe("322834.00"); // 1,50,000 + 78,280 + 94,554
    const r = await call(dashRoute.GET, { token: owner, path: "/api/dashboard/rates?period=month", params: { page: "rates" } });
    expect(r.body.data.intake[0]).toMatchObject({ grams: "8.500", fine: "7.786", value: "60730.80", avgTouch: "91.60" });
    expect(r.body.data.realised.find((x: any) => x.purity === "Gold 22K (916)")).toMatchObject({ charged: "7150.00", master: "7150.00" });
  });

  it("T-44 an empty period returns zeros and empty lists, no errors", async () => {
    for (const page of ["overview", "sales", "customers", "payments", "gst", "rates"]) {
      const r = await call(dashRoute.GET, { token: owner, path: `/api/dashboard/${page}?period=custom&from=2020-01-01&to=2020-01-31`, params: { page } });
      expect(r.status, page).toBe(200);
    }
    const o = await call(dashRoute.GET, { token: owner, path: "/api/dashboard/overview?period=custom&from=2020-01-01&to=2020-01-31", params: { page: "overview" } });
    expect(o.body.data.kpis.sales.value).toBe("0.00");
    expect(o.body.data.trend).toHaveLength(31);
    expect(o.body.data.topCustomers).toEqual([]);
  });

  it("DSH-11 staff need the owner's permission; viewers may look", async () => {
    expect((await call(dashRoute.GET, { token: staff, path: "/api/dashboard/overview", params: { page: "overview" } })).status).toBe(403);
    expect((await call(dashRoute.GET, { token: viewer, path: "/api/dashboard/overview", params: { page: "overview" } })).status).toBe(200);
    expect((await call(dashRoute.GET, { token: viewer, path: "/api/dashboard/nope", params: { page: "nope" } })).status).toBe(404);
  });

  /* ── CSV ─────────────────────────────────────────────────────────── */

  it("TXN-12 CSV: UTF-8 BOM, columns, masked phone / PAN unless the owner asks", async () => {
    const r = await raw(csvRoute.GET, "/api/export/csv?q=asha", viewer);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/csv");
    expect([...r.bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM so Excel opens it correctly
    expect(r.text.charCodeAt(0)).toBe(0xfeff);
    const [header, row] = r.text.slice(1).trim().split("\r\n");
    expect(header.split(",")).toEqual([
      "Invoice No", "Date", "Customer", "Phone", "GSTIN", "PAN", "State", "Items", "Gold Net Wt (g)", "Silver Net Wt (g)", "GST Added",
      "Items Total", "Discount", "Taxable / Net", "CGST", "SGST", "IGST", "Exchange", "Round Off", "Grand Total", "Received", "Balance",
      "Payment Mode", "Payment Details", "Status",
    ]);
    expect(row).toContain(`INV/${FY}/001`);
    expect(row).toContain("******6780");
    expect(row).toContain("*****1234F");
    expect(row).toContain('"Necklace (Gold 22K (916), 24.250 g); Diamond ring (Gold 18K (750), 3.940 g); Anklets (Silver 925, 62.300 g)"');
    expect(row).toContain("203701.00,150000.00,53701.00,Mixed,HDFC Bank,Active");
    expect((await raw(csvRoute.GET, "/api/export/csv?q=asha&full=1", viewer)).text).not.toContain("9123456780");
    expect((await raw(csvRoute.GET, "/api/export/csv?q=asha&full=1", owner)).text).toContain("9123456780");
  });

  /* ── gaps (T-30) ─────────────────────────────────────────────────── */

  it("T-30 a deleted number shows as a gap with who deleted it", async () => {
    const extra = await call(invoicesRoute.POST, { method: "POST", token: owner, body: body({ customer: { name: "Temp", phone: "9300000003" }, lines: [line({ gross: "1", rate: "7150" })] }) });
    expect(extra.body.invoice.number).toBe(`INV/${FY}/004`);
    await call(invoiceById.DELETE, { method: "DELETE", token: owner, params: { id: extra.body.invoice.id } });
    const g = await call(dashRoute.GET, { token: owner, path: "/api/dashboard/gst?period=fy", params: { page: "gst" } });
    expect(g.body.data.gaps).toEqual([expect.objectContaining({ number: `INV/${FY}/004`, deletedBy: "Owner" })]);
  });

  /* ── backup / restore (T-33) ─────────────────────────────────────── */

  it("TXN-13/14 + T-33: backup, restore into an empty install, numbering continues", async () => {
    expect((await raw(backupRoute.GET, "/api/backup", staff)).status).toBe(403);
    const b = await raw(backupRoute.GET, "/api/backup", owner);
    expect(b.headers.get("content-disposition")).toContain(".json");
    const backup = JSON.parse(b.text);
    expect(backup).toMatchObject({ format: "gold-silver-billing-backup", version: 1 });
    expect(backup.invoices).toHaveLength(3);
    expect(backup.series.find((s: any) => s.seriesKey === `INV|${FY}`).lastSeq).toBe(4);

    // a fresh local install: no invoices, rates, history or counters
    await sql(`truncate invoices, invoice_lines, invoice_exchange, invoice_series, rate_history, rates_current, customers, daily_summary cascade`);
    await sql(`update shop_settings set name = 'Blank'`);

    const restore = (b: unknown) => call(restoreRoute.POST, { method: "POST", token: owner, body: b });
    expect((await call(restoreRoute.POST, { method: "POST", token: staff, body: { phase: "finish", total: 0 } })).status).toBe(403);
    expect((await restore({ phase: "start", meta: { ...backup, format: "something-else" } })).status).toBe(400);
    expect((await restore({ phase: "start", meta: backup })).status).toBe(200);
    for (let i = 0; i < backup.invoices.length; i += 2) {
      const r = await restore({ phase: "invoices", invoices: backup.invoices.slice(i, i + 2) });
      expect(r.status).toBe(200);
    }
    expect((await restore({ phase: "finish", total: backup.invoices.length, exportedAt: backup.exportedAt })).status).toBe(200);

    const list = await call(invoicesRoute.GET, { token: owner, path: "/api/invoices" });
    expect(list.body.total).toBe(3);
    expect(list.body.summary.totalBilled).toBe("376535.00");
    expect((await call(settingsRoute.GET, { token: owner })).body.settings.name).toBe("Shree Jewellers");
    expect((await call(ratesRoute.GET, { token: owner })).body.status).toBe("current");
    const t01 = (await call(invoicesRoute.GET, { token: owner, path: "/api/invoices?q=asha" })).body.rows[0];
    const full = (await call(invoiceById.GET, { token: owner, params: { id: t01.id } })).body.invoice;
    expect(full.lines.map((l: any) => l.amount)).toEqual(["206308.50", "45051.66", "6869.30"]);
    expect(full.payDetails).toBe("HDFC Bank");
    // daily summary rebuilt → dashboard identical
    const o = await call(dashRoute.GET, { token: owner, path: "/api/dashboard/overview?period=month", params: { page: "overview" } });
    expect(o.body.data.kpis.sales.value).toBe("376535.00");
    // numbering continues after the highest number ever issued (004 was deleted, never reused)
    const next = await call(invoicesRoute.POST, { method: "POST", token: owner, body: body({ customer: { name: "New", phone: "9400000004" }, lines: [line({ gross: "2", rate: "7150" })] }) });
    expect(next.body.invoice.number).toBe(`INV/${FY}/005`);
    // restoring the same file again replaces by number — no duplicates
    await restore({ phase: "invoices", invoices: backup.invoices });
    expect((await call(invoicesRoute.GET, { token: owner, path: "/api/invoices" })).body.total).toBe(4);
    const audit = await sql(`select action, after from audit_log where action = 'restore'`);
    expect(audit).toHaveLength(1);
  });
});
