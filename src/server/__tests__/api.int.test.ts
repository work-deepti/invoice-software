/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeAll, describe, expect, it } from "vitest";
import { financialYear, todayIST } from "@/lib/calc-engine";
import * as invoiceById from "@/app/api/invoices/[id]/route";
import * as cancelRoute from "@/app/api/invoices/[id]/cancel/route";
import * as invoicesRoute from "@/app/api/invoices/route";
import * as previewRoute from "@/app/api/invoices/preview/route";
import * as customersRoute from "@/app/api/customers/route";
import * as loginRoute from "@/app/api/auth/login/route";
import * as meRoute from "@/app/api/auth/me/route";
import * as setupRoute from "@/app/api/auth/setup/route";
import * as historyRoute from "@/app/api/rates/history/route";
import * as ratesRoute from "@/app/api/rates/route";
import * as settingsRoute from "@/app/api/settings/route";
import * as usersRoute from "@/app/api/users/route";
import { call, tokenFrom } from "./helpers";

const run = !!process.env.TEST_DATABASE_URL;
const TODAY = todayIST();
const FY = financialYear(TODAY);

async function sql<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const { getDb } = await import("@/server/db");
  const pool = (getDb() as any).$client;
  const res = await pool.query(text, params);
  return res.rows as T[];
}

const SHOP = {
  name: "Shree Jewellers",
  phone: "9876543210",
  email: "shop@example.com",
  gstin: "27ABCDE1234F1Z5",
  state: "Maharashtra",
  stateCode: "27",
  address: "Main Road, Pune",
  gstRate: "3",
  gstDefault: true,
  prefixGst: "INV",
  prefixNoGst: "BILL",
  noGstTitle: "INVOICE",
  hsnGold: "7113",
  hsnSilver: "7113",
  fyNumbering: true,
  terms: "Goods once sold will not be taken back.",
  bankDetails: "",
  signatoryLabel: "Authorised Signatory",
  staffCanSeeDashboard: false,
};

const line = (p: Record<string, unknown>) => ({
  description: "Item",
  metal: "Gold",
  purityLabel: "Gold 22K (916)",
  pcs: "1",
  makingType: "per_g",
  ...p,
});

const body = (p: Record<string, unknown> = {}) => ({
  date: TODAY,
  payMode: "UPI",
  gstOn: true,
  interState: false,
  customer: { name: "Kiran Shah", phone: "9800000000", state: "Maharashtra" },
  lines: [],
  exchange: [],
  ...p,
});

const WORKED = () =>
  body({
    payMode: "Mixed",
    received: "150000",
    discount: "1500",
    customer: { name: "Asha Patil", phone: "9123456780", state: "Maharashtra", pan: "abcde1234f", address: "Kothrud" },
    lines: [
      line({ description: "Necklace", gross: "25.450", less: "1.200", wastagePct: "8", rate: "7150", makingValue: "600", stone: "4500" }),
      line({ description: "Diamond ring", purityLabel: "Gold 18K (750)", gross: "4.120", less: "0.180", rate: "5860", makingType: "pct", makingValue: "15", stone: "18500" }),
      line({ description: "Anklets", metal: "Silver", purityLabel: "Silver 925", pcs: "2", gross: "62.300", rate: "91", makingType: "flat", makingValue: "1200" }),
    ],
    exchange: [{ description: "Old gold", metal: "Gold", weight: "8.500", touchPct: "91.6", fineRate: "7800" }],
    // API-01: client-sent totals are ignored
    grandTotal: "1",
    totals: { grandTotal: "1" },
  });

const T02 = (p: Record<string, unknown> = {}) => body({ lines: [line({ gross: "10", rate: "7150", makingValue: "450" })], ...p });
const T04 = () =>
  body({
    interState: true,
    customer: { name: "Ravi", phone: "9988776655", state: "Karnataka", gstin: "29ABCDE1234F1Z5" },
    lines: [line({ gross: "12", rate: "7150", makingValue: "500" })],
  });

describe.skipIf(!run)("API (PostgreSQL integration)", () => {
  let owner = "";
  let staff = "";
  let viewer = "";
  let staffId = "";

  beforeAll(async () => {
    // First-run owner setup
    const needs = await call(setupRoute.GET);
    expect(needs.body).toEqual({ needsSetup: true });
    const setup = await call(setupRoute.POST, { method: "POST", body: { name: "Owner", login: "owner", password: "owner-pass-1" } });
    expect(setup.status).toBe(201);
    owner = tokenFrom(setup);

    for (const role of ["staff", "viewer"] as const) {
      const u = await call(usersRoute.POST, { method: "POST", token: owner, body: { name: role, login: role, password: `${role}-pass-1`, role } });
      expect(u.status).toBe(201);
      if (role === "staff") staffId = u.body.user.id;
      const l = await call(loginRoute.POST, { method: "POST", body: { login: role, password: `${role}-pass-1` } });
      expect(l.status).toBe(200);
      if (role === "staff") staff = tokenFrom(l);
      else viewer = tokenFrom(l);
    }

    expect((await call(settingsRoute.PUT, { method: "PUT", token: owner, body: SHOP })).status).toBe(200);
  });

  /* ── auth & roles ─────────────────────────────────────────────────────── */

  describe("auth & roles (ROLE-01/02, NFR-03)", () => {
    it("setup can only run once", async () => {
      const again = await call(setupRoute.POST, { method: "POST", body: { name: "X", login: "xx1", password: "password-1" } });
      expect(again.status).toBe(409);
    });

    it("rejects wrong passwords and missing sessions", async () => {
      expect((await call(loginRoute.POST, { method: "POST", body: { login: "owner", password: "nope" } })).status).toBe(401);
      expect((await call(settingsRoute.GET)).status).toBe(401);
      expect((await call(invoicesRoute.GET, { token: "garbage" })).status).toBe(401);
    });

    it("/me reports the role and dashboard access (ROLE-03)", async () => {
      expect((await call(meRoute.GET, { token: owner })).body.capabilities).toEqual({ canBill: true, isOwner: true, canSeeDashboard: true });
      expect((await call(meRoute.GET, { token: staff })).body.capabilities).toEqual({ canBill: true, isOwner: false, canSeeDashboard: false });
      expect((await call(meRoute.GET, { token: viewer })).body.capabilities.canBill).toBe(false);
    });

    it("enforces roles on the server", async () => {
      expect((await call(settingsRoute.PUT, { method: "PUT", token: staff, body: SHOP })).status).toBe(403);
      expect((await call(ratesRoute.PUT, { method: "PUT", token: staff, body: { rows: [] } })).status).toBe(403);
      expect((await call(invoicesRoute.POST, { method: "POST", token: viewer, body: T02() })).status).toBe(403);
      expect((await call(usersRoute.GET, { token: staff })).status).toBe(403);
      expect((await call(invoicesRoute.GET, { token: viewer })).status).toBe(200);
    });

    it("rejects malformed bodies with 400", async () => {
      const r = await call(invoicesRoute.POST, { method: "POST", token: owner, body: { lines: "x" } });
      expect(r.status).toBe(400);
      expect(r.body.issues.length).toBeGreaterThan(0);
    });
  });

  /* ── settings ─────────────────────────────────────────────────────────── */

  describe("settings (§5.1, §8.4)", () => {
    it("T-27 S-09 returns 422 with field ids", async () => {
      const r = await call(settingsRoute.PUT, { method: "PUT", token: owner, body: { ...SHOP, prefixGst: "SHREELAXMI" } });
      expect(r.status).toBe(422);
      expect(r.body.errors).toEqual([
        {
          id: "S-09",
          field: "prefixGst",
          message: "Invoice numbers can be at most 16 characters under GST rules — shorten this prefix to 4 characters or less.",
        },
      ]);
    });

    it("normalises GSTIN to upper case and audits the change", async () => {
      const r = await call(settingsRoute.PUT, { method: "PUT", token: owner, body: { ...SHOP, gstin: "27abcde1234f1z5" } });
      expect(r.status).toBe(200);
      expect(r.body.settings.gstin).toBe("27ABCDE1234F1Z5");
      const rows = await sql(`select action from audit_log where entity = 'shop_settings'`);
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });
  });

  /* ── rates ────────────────────────────────────────────────────────────── */

  describe("rate master (§5.2)", () => {
    it("RATE-01 seeds default purities with blank rates; status 'none'", async () => {
      const r = await call(ratesRoute.GET, { token: staff });
      expect(r.status).toBe(200);
      expect(r.body.rows.map((x: any) => x.label)).toEqual(["Gold 24K (999)", "Gold 22K (916)", "Gold 18K (750)", "Silver 999", "Silver 925"]);
      expect(r.body.rows.every((x: any) => x.rate === "")).toBe(true);
      expect(r.body.status).toBe("none");
    });

    it("R-02 → 422; R-05 → 409 until acceptWarnings", async () => {
      const g = (await call(ratesRoute.GET, { token: owner })).body.rows;
      const dup = await call(ratesRoute.PUT, {
        method: "PUT",
        token: owner,
        body: { rows: [...g.map((x: any) => ({ ...x, rate: "100" })), { metal: "Gold", label: "gold 24k (999)", purityPct: "99.9", rate: "1" }] },
      });
      expect(dup.status).toBe(422);
      expect(dup.body.errors[0].id).toBe("R-02");

      const inverted = g.map((x: any) => ({ ...x, rate: x.label === "Gold 18K (750)" ? "9000" : "7000" }));
      const w = await call(ratesRoute.PUT, { method: "PUT", token: owner, body: { rows: inverted } });
      expect(w.status).toBe(409);
      expect(w.body.warnings.map((x: any) => x.id)).toContain("R-05");
    });

    it("T-31 saving twice in one day keeps ONE history row per purity with the latest values", async () => {
      const g = (await call(ratesRoute.GET, { token: owner })).body.rows;
      const rates: Record<string, string> = {
        "Gold 24K (999)": "7700",
        "Gold 22K (916)": "7100",
        "Gold 18K (750)": "5800",
        "Silver 999": "97",
        "Silver 925": "90",
      };
      const first = await call(ratesRoute.PUT, { method: "PUT", token: owner, body: { rows: g.map((x: any) => ({ ...x, rate: rates[x.label] })) } });
      expect(first.status).toBe(200);
      const latest: Record<string, string> = { ...rates, "Gold 24K (999)": "7800", "Gold 22K (916)": "7150", "Gold 18K (750)": "5860", "Silver 925": "91", "Silver 999": "98" };
      const second = await call(ratesRoute.PUT, { method: "PUT", token: owner, body: { rows: g.map((x: any) => ({ ...x, rate: latest[x.label] })) } });
      expect(second.status).toBe(200);
      expect(second.body.status).toBe("current");
      expect(second.body.effectiveDate).toBe(TODAY);
      expect(second.body.fineRates).toEqual({ Gold: "7800.00", Silver: "98.00" });
      expect(second.body.rows.find((x: any) => x.label === "Gold 22K (916)").equivalent).toEqual({ amount: "71500.00", unit: "10 g" });

      const hist = await sql(`select label, rate_per_g from rate_history where date = $1 order by label`, [TODAY]);
      expect(hist).toHaveLength(5);
      expect(Object.fromEntries(hist.map((h: any) => [h.label, h.rate_per_g]))).toEqual({
        "Gold 18K (750)": "5860.00",
        "Gold 22K (916)": "7150.00",
        "Gold 24K (999)": "7800.00",
        "Silver 925": "91.00",
        "Silver 999": "98.00",
      });

      const h = await call(historyRoute.GET, { token: viewer, path: "/api/rates/history?days=30" });
      expect(h.body.dates).toEqual([TODAY]);
      expect(h.body.columns).toHaveLength(5);
    });

    it("RATE-07 history shows saved days newest first", async () => {
      const p = (await sql(`select id, label, metal, purity_pct from purities where active`))[0] as any;
      await sql(`insert into rate_history (date, purity_id, label, metal, purity_pct, rate_per_g) values ('2026-01-05', $1, $2, $3, $4, '7000')`, [
        p.id,
        p.label,
        p.metal,
        p.purity_pct,
      ]);
      const h = await call(historyRoute.GET, { token: viewer, path: "/api/rates/history?days=30" });
      expect(h.body.dates).toEqual([TODAY, "2026-01-05"]);
      expect(h.body.values["2026-01-05"][p.id]).toBe("7000.00");
    });
  });

  /* ── invoices ─────────────────────────────────────────────────────────── */

  describe("invoices (§6, §7, §12.2)", () => {
    let workedId = "";

    it("preview returns totals, errors and the next number without saving", async () => {
      const r = await call(previewRoute.POST, { method: "POST", token: staff, body: WORKED() });
      expect(r.status).toBe(200);
      expect(r.body.number).toBe(`INV/${FY}/001`);
      expect(r.body.totals.grandTotal).toBe("203701.00");
      expect(r.body.errors).toEqual([]);
      expect((await sql(`select count(*)::int n from invoices`))[0].n).toBe(0);
      const noGst = await call(previewRoute.POST, { method: "POST", token: staff, body: { ...WORKED(), gstOn: false } });
      expect(noGst.body.number).toBe(`BILL/${FY}/001`); // NUM-07
    });

    it("T-01 saves the worked example; server recomputes every total (API-01)", async () => {
      const r = await call(invoicesRoute.POST, { method: "POST", token: staff, body: WORKED() });
      expect(r.status).toBe(201);
      const inv = r.body.invoice;
      workedId = inv.id;
      expect(inv.number).toBe(`INV/${FY}/001`);
      expect(inv).toMatchObject({
        itemsTotal: "258229.46",
        discount: "1500.00",
        taxable: "256729.46",
        cgst: "3850.94",
        sgst: "3850.94",
        igst: "0.00",
        exchangeTotal: "60730.80",
        roundOff: "0.46",
        grandTotal: "203701.00",
        received: "150000.00",
        paid: "150000.00",
        balance: "53701.00",
        goldNetG: "28.190",
        silverNetG: "62.300",
        gstRate: "3.00",
        customerPan: "ABCDE1234F",
        placeOfSupply: "Maharashtra (27)",
        createdByName: "staff",
        status: "active",
      });
      expect(inv.lines.map((l: any) => l.amount)).toEqual(["206308.50", "45051.66", "6869.30"]);
      expect(inv.lines[0]).toMatchObject({ netG: "24.250", chargeableG: "26.190", makingInput: "600.00", makingAmt: "14550.00", hsn: "7113" });
      expect(inv.exchange[0]).toMatchObject({ fineG: "7.786", value: "60730.80" });
      expect(inv.shopSnapshot.name).toBe("Shree Jewellers");
      const audit = await sql(`select action from audit_log where entity = 'invoice' and entity_id = $1`, [inv.id]);
      expect(audit.map((a: any) => a.action)).toEqual(["create"]);
    });

    it("INV-07/08 customer recall by phone", async () => {
      const exact = await call(customersRoute.GET, { token: staff, path: "/api/customers?phone=9123456780" });
      expect(exact.body.customer).toMatchObject({ name: "Asha Patil", pan: "ABCDE1234F", address: "Kothrud", state: "Maharashtra" });
      const sugg = await call(customersRoute.GET, { token: staff, path: "/api/customers?q=9123" });
      expect(sugg.body.suggestions.map((s: any) => s.phone)).toEqual(["9123456780"]);
      const byName = await call(customersRoute.GET, { token: staff, path: "/api/customers?q=asha" });
      expect(byName.body.suggestions).toHaveLength(1);
    });

    it("T-23 errors return 422 with {id, field, message}", async () => {
      const r = await call(invoicesRoute.POST, { method: "POST", token: staff, body: T02({ customer: { name: "A", phone: "98765" } }) });
      expect(r.status).toBe(422);
      expect(r.body.errors).toEqual([{ id: "E-01", field: "customer.phone", message: "Phone number must be exactly 10 digits." }]);
    });

    it("D-02 ₹2 lakh+ without PAN is blocked (E-20) unless Form 60 is ticked", async () => {
      const big = body({ customer: { name: "B", phone: "9000000001" }, lines: [line({ gross: "30", rate: "7150" })] });
      const r = await call(previewRoute.POST, { method: "POST", token: staff, body: big });
      expect(r.body.errors.map((e: any) => e.id)).toEqual(["E-20"]);
      const ok = await call(previewRoute.POST, { method: "POST", token: staff, body: { ...big, customer: { ...big.customer, panDeclaration: true } } });
      expect(ok.body.errors).toEqual([]);
    });

    it("T-24 Cash ≥ ₹2 lakh is blocked (E-19)", async () => {
      const big = body({ payMode: "Cash", customer: { name: "B", phone: "9000000001", pan: "ABCDE1234F" }, lines: [line({ gross: "30", rate: "7150" })] });
      const r = await call(invoicesRoute.POST, { method: "POST", token: staff, body: big });
      expect(r.status).toBe(422);
      expect(r.body.errors.map((e: any) => e.id)).toEqual(["E-19"]);
    });

    it("W-06 rate far from today's master rate → 409", async () => {
      const r = await call(invoicesRoute.POST, { method: "POST", token: staff, body: body({ lines: [line({ gross: "1", rate: "6000" })] }) });
      expect(r.status).toBe(409);
      expect(r.body.warnings.map((w: any) => w.id)).toEqual(["W-06"]);
    });

    it("T-26 duplicate → 409 naming the first number; acceptWarnings saves it", async () => {
      const first = await call(invoicesRoute.POST, { method: "POST", token: staff, body: T02() });
      expect(first.status).toBe(201);
      expect(first.body.invoice.number).toBe(`INV/${FY}/002`);
      expect(first.body.invoice.grandTotal).toBe("78280.00"); // T-02

      const dup = await call(invoicesRoute.POST, { method: "POST", token: staff, body: T02() });
      expect(dup.status).toBe(409);
      expect(dup.body.warnings).toEqual([
        {
          id: "W-08",
          field: "customer.name",
          message: `A bill for the same customer and amount was already saved today (INV/${FY}/002). Is this a duplicate?`,
        },
      ]);
      expect(dup.body.totals.grandTotal).toBe("78280.00");

      const accepted = await call(invoicesRoute.POST, { method: "POST", token: staff, body: { ...T02(), acceptWarnings: true } });
      expect(accepted.status).toBe(201);
      expect(accepted.body.invoice.number).toBe(`INV/${FY}/003`);
    });

    it("T-03 GST off → BILL series, no tax", async () => {
      const r = await call(invoicesRoute.POST, { method: "POST", token: staff, body: T02({ gstOn: false, customer: { name: "C", phone: "9000000003" } }) });
      expect(r.status).toBe(201);
      expect(r.body.invoice).toMatchObject({ number: `BILL/${FY}/001`, grandTotal: "76000.00", cgst: "0.00", sgst: "0.00", igst: "0.00", gstOn: false });
    });

    it("T-04 IGST bill → 94,554, place of supply 'Karnataka (29)'", async () => {
      const r = await call(invoicesRoute.POST, { method: "POST", token: staff, body: T04() });
      expect(r.status).toBe(201);
      expect(r.body.invoice).toMatchObject({ igst: "2754.00", grandTotal: "94554.00", placeOfSupply: "Karnataka (29)", placeCode: "29", interState: true });
    });

    it("T-28 parallel saves get distinct consecutive numbers", async () => {
      const before = (await sql(`select last_seq from invoice_series where series_key = $1`, [`INV|${FY}`]))[0].last_seq;
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          call(invoicesRoute.POST, {
            method: "POST",
            token: i % 2 ? staff : owner,
            body: body({ customer: { name: `P${i}`, phone: `90000001${String(i).padStart(2, "0")}` }, lines: [line({ gross: String(1 + i), rate: "7150" })] }),
          }),
        ),
      );
      expect(results.map((r) => r.status)).toEqual(Array(10).fill(201));
      const seqs = results.map((r) => Number(r.body.invoice.number.split("/")[2])).sort((a, b) => a - b);
      expect(seqs).toEqual(Array.from({ length: 10 }, (_, i) => before + 1 + i));
      expect(new Set(results.map((r) => r.body.invoice.number)).size).toBe(10);
    });

    it("NFR-05 a save that fails after allocating rolls the number back", async () => {
      await sql(`update shop_settings set prefix_gst = 'INVX'`);
      await sql(`insert into invoice_series (series_key, prefix, fy, last_seq) values ($1, 'INVX', $2, 9999)`, [`INVX|${FY}`, FY]);
      const r = await call(invoicesRoute.POST, { method: "POST", token: owner, body: T02({ customer: { name: "Z", phone: "9000000099" } }) });
      expect(r.status).toBe(422);
      expect(r.body.errors[0].id).toBe("NUM-06");
      expect((await sql(`select last_seq from invoice_series where series_key = $1`, [`INVX|${FY}`]))[0].last_seq).toBe(9999);
      await sql(`update shop_settings set prefix_gst = 'INV'`);
    });

    it("T-29 / INV-20/21 edit a fully paid 3 g bill to 4 g: same number, 29,458, still fully paid", async () => {
      const created = await call(invoicesRoute.POST, {
        method: "POST",
        token: staff,
        body: body({ customer: { name: "D", phone: "9000000004" }, lines: [line({ gross: "3", rate: "7150" })] }),
      });
      const inv = created.body.invoice;
      expect(inv.grandTotal).toBe("22094.00");

      // GST-04: changing today's GST setting must not affect the edit
      await sql(`update shop_settings set gst_rate = 5`);
      const upd = await call(invoiceById.PUT, {
        method: "PUT",
        token: staff,
        params: { id: inv.id },
        body: body({ customer: { name: "D", phone: "9000000004" }, lines: [line({ gross: "4", rate: "7150" })] }),
      });
      await sql(`update shop_settings set gst_rate = 3`);
      expect(upd.status).toBe(200);
      expect(upd.body.invoice).toMatchObject({ number: inv.number, grandTotal: "29458.00", balance: "0.00", receivedFull: true, gstRate: "3.00" });
      expect(new Date(upd.body.invoice.createdAt).getTime()).toBe(new Date(inv.createdAt).getTime());
      const audit = await sql(`select action, before->>'grandTotal' b, after->>'grandTotal' a from audit_log where entity_id = $1 order by id`, [inv.id]);
      expect(audit).toEqual([
        { action: "create", b: null, a: "22094.00" },
        { action: "update", b: "22094.00", a: "29458.00" },
      ]);
    });

    it("D-03 staff may edit only invoices created today; owner may edit any", async () => {
      const created = await call(invoicesRoute.POST, { method: "POST", token: staff, body: body({ customer: { name: "E", phone: "9000000005" }, lines: [line({ gross: "2", rate: "7150" })] }) });
      const id = created.body.invoice.id;
      expect(created.body.invoice.permissions).toEqual({ canEdit: true, canCancel: false, canDelete: false });
      await sql(`update invoices set created_at = now() - interval '2 days' where id = $1`, [id]);
      const edit = body({ customer: { name: "E", phone: "9000000005" }, lines: [line({ gross: "2.5", rate: "7150" })] });
      const s = await call(invoiceById.PUT, { method: "PUT", token: staff, params: { id }, body: edit });
      expect(s.status).toBe(403);
      expect((await call(invoiceById.GET, { token: staff, params: { id } })).body.invoice.permissions.canEdit).toBe(false);
      const o = await call(invoiceById.PUT, { method: "PUT", token: owner, params: { id }, body: edit });
      expect(o.status).toBe(200);
      expect((await call(invoiceById.PUT, { method: "PUT", token: viewer, params: { id }, body: edit })).status).toBe(403);
    });

    it("an edit may not move the bill into another FY", async () => {
      const r = await call(invoiceById.PUT, { method: "PUT", token: owner, params: { id: workedId }, body: { ...WORKED(), date: "2020-01-01" } });
      expect(r.status).toBe(422);
      expect(r.body.errors.map((e: any) => e.id)).toContain("NUM-03");
    });

    it("T-30 / D-01 cancel keeps the bill, excludes it from totals; numbers are never reused", async () => {
      const c = await call(invoicesRoute.POST, { method: "POST", token: owner, body: body({ customer: { name: "F", phone: "9000000006" }, lines: [line({ gross: "5", rate: "7150" })] }) });
      const { id, number } = c.body.invoice;
      expect((await call(cancelRoute.POST, { method: "POST", token: staff, params: { id }, body: { reason: "x" } })).status).toBe(403);
      expect((await call(cancelRoute.POST, { method: "POST", token: owner, params: { id }, body: { reason: "" } })).status).toBe(400);
      const cancelled = await call(cancelRoute.POST, { method: "POST", token: owner, params: { id }, body: { reason: "Customer returned the item" } });
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.invoice).toMatchObject({ status: "cancelled", cancelledReason: "Customer returned the item", number });
      expect((await call(cancelRoute.POST, { method: "POST", token: owner, params: { id }, body: { reason: "again" } })).status).toBe(409);
      expect((await call(invoiceById.PUT, { method: "PUT", token: owner, params: { id }, body: T02() })).status).toBe(409);

      // hard delete: owner only, number still not reused
      const d = await call(invoicesRoute.POST, { method: "POST", token: owner, body: body({ customer: { name: "G", phone: "9000000007" }, lines: [line({ gross: "6", rate: "7150" })] }) });
      expect((await call(invoiceById.DELETE, { method: "DELETE", token: staff, params: { id: d.body.invoice.id } })).status).toBe(403);
      const del = await call(invoiceById.DELETE, { method: "DELETE", token: owner, params: { id: d.body.invoice.id } });
      expect(del.body).toEqual({ deleted: d.body.invoice.number });
      expect((await call(invoiceById.GET, { token: owner, params: { id: d.body.invoice.id } })).status).toBe(404);

      const next = await call(invoicesRoute.POST, { method: "POST", token: owner, body: body({ customer: { name: "H", phone: "9000000008" }, lines: [line({ gross: "7", rate: "7150" })] }) });
      const seq = (n: string) => Number(n.split("/")[2]);
      expect(seq(next.body.invoice.number)).toBe(seq(d.body.invoice.number) + 1);
      const actions = await sql(`select action from audit_log where entity_id in ($1, $2) order by id`, [id, d.body.invoice.id]);
      expect(actions.map((a: any) => a.action)).toEqual(["create", "cancel", "create", "delete"]);
    });

    it("TXN-01..05 ledger: search, filters, paging and summary tiles", async () => {
      const all = await call(invoicesRoute.GET, { token: viewer, path: "/api/invoices" });
      expect(all.status).toBe(200);
      expect(all.body.pageSize).toBe(50);
      expect(all.body.summary.cancelled).toBe(1);
      expect(all.body.summary.invoices).toBe(all.body.total - 1);
      expect(all.body.rows[0].invoiceDate).toBe(TODAY);

      const byPhone = await call(invoicesRoute.GET, { token: viewer, path: "/api/invoices?q=9123456780" });
      expect(byPhone.body.rows.map((r: any) => r.number)).toEqual([`INV/${FY}/001`]);
      const byItem = await call(invoicesRoute.GET, { token: viewer, path: "/api/invoices?q=diamond" });
      expect(byItem.body.total).toBe(1);
      const byNumber = await call(invoicesRoute.GET, { token: viewer, path: `/api/invoices?q=${encodeURIComponent(`BILL/${FY}`)}` });
      expect(byNumber.body.total).toBe(1);

      const silver = await call(invoicesRoute.GET, { token: viewer, path: "/api/invoices?metal=silver" });
      expect(silver.body.total).toBe(1);
      expect(silver.body.summary.silverG).toBe("62.300");
      const due = await call(invoicesRoute.GET, { token: viewer, path: "/api/invoices?due=1" });
      expect(due.body.rows.map((r: any) => r.number)).toEqual([`INV/${FY}/001`]);
      expect(due.body.summary.balanceDue).toBe("53701.00");
      const noGst = await call(invoicesRoute.GET, { token: viewer, path: "/api/invoices?gst=without" });
      expect(noGst.body.rows.map((r: any) => r.number)).toEqual([`BILL/${FY}/001`]);
      const purity = await call(invoicesRoute.GET, { token: viewer, path: "/api/invoices?purity=Gold%2018K%20(750)" });
      expect(purity.body.total).toBe(1); // T-41 drill-down
      const range = await call(invoicesRoute.GET, { token: viewer, path: "/api/invoices?from=2020-01-01&to=2020-12-31" });
      expect(range.body.total).toBe(0);
      expect(range.body.summary.totalBilled).toBe("0.00");

      // paging past 50
      const seed = Array.from({ length: 45 }, (_, i) =>
        call(invoicesRoute.POST, {
          method: "POST",
          token: owner,
          body: body({ gstOn: false, customer: { name: `Bulk ${i}`, phone: `91000000${String(i).padStart(2, "0")}` }, lines: [line({ gross: "1", rate: "7150" })] }),
        }),
      );
      expect((await Promise.all(seed)).every((r) => r.status === 201)).toBe(true);
      const p1 = await call(invoicesRoute.GET, { token: viewer, path: "/api/invoices" });
      const p2 = await call(invoicesRoute.GET, { token: viewer, path: "/api/invoices?page=2" });
      expect(p1.body.rows).toHaveLength(50);
      expect(p2.body.rows.length).toBe(p1.body.total - 50);
      expect(new Set([...p1.body.rows, ...p2.body.rows].map((r: any) => r.id)).size).toBe(p1.body.total);
    });
  });

  /* ── daily summary ────────────────────────────────────────────────────── */

  describe("daily_summary (DSH-08, T-40, T-42)", () => {
    const D = "2026-04-15";
    const sum = async () =>
      (
        await sql(
          `select
             (select coalesce(sum(sales),0)::text from daily_summary where date = $1 and metal = 'ALL') sales,
             (select coalesce(sum(invoices),0)::int from daily_summary where date = $1 and metal = 'ALL') invoices,
             (select coalesce(sum(net_g),0)::text from daily_summary where date = $1 and metal = 'Gold' and purity_key <> '~exchange') gold,
             (select coalesce(sum(net_g),0)::text from daily_summary where date = $1 and metal = 'Silver' and purity_key <> '~exchange') silver,
             (select coalesce(sum(cgst + sgst + igst),0)::text from daily_summary where date = $1 and metal = 'ALL') gst,
             (select coalesce(sum(exchange_value),0)::text from daily_summary where date = $1 and metal = 'Gold' and purity_key = '~exchange') xchg`,
          [D],
        )
      )[0];

    it("T-40 seeding T-01, T-02, T-04 on one day", async () => {
      const ids: string[] = [];
      for (const b of [WORKED(), T02({ customer: { name: "T02", phone: "9200000002" } }), T04()]) {
        const r = await call(invoicesRoute.POST, { method: "POST", token: owner, body: { ...b, date: D, acceptWarnings: true } });
        expect(r.status).toBe(201);
        ids.push(r.body.invoice.id);
      }
      expect(await sum()).toEqual({
        sales: "376535.00", // 2,03,701 + 78,280 + 94,554
        invoices: 3,
        gold: "50.190", // 28.190 + 10 + 12
        silver: "62.300",
        gst: "12735.88", // 7,701.88 + 2,280 + 2,754
        xchg: "60730.80",
      });
      // purity grain: 22K split by (gst_on, pay_mode) — T-01 is Mixed, T-02 and T-04 are UPI
      const purity = await sql(
        `select pay_mode, net_g, invoices from daily_summary where date = $1 and metal = 'Gold' and purity_key = 'Gold 22K (916)' order by pay_mode`,
        [D],
      );
      expect(purity).toEqual([
        { pay_mode: "Mixed", net_g: "24.250", invoices: 1 },
        { pay_mode: "UPI", net_g: "22.000", invoices: 2 },
      ]);

      // T-42: edit and cancel update the summary in the same transaction
      const t02 = ids[1];
      const upd = await call(invoiceById.PUT, {
        method: "PUT",
        token: owner,
        params: { id: t02 },
        body: { ...T02({ customer: { name: "T02", phone: "9200000002" }, lines: [line({ gross: "20", rate: "7150", makingValue: "450" })] }), date: D, acceptWarnings: true },
      });
      expect(upd.body.invoice.grandTotal).toBe("156560.00");
      expect((await sum()).sales).toBe("454815.00");
      await call(cancelRoute.POST, { method: "POST", token: owner, params: { id: ids[2] }, body: { reason: "test" } });
      expect(await sum()).toMatchObject({ sales: "360261.00", invoices: 2, gold: "48.190" });
      await call(invoiceById.DELETE, { method: "DELETE", token: owner, params: { id: ids[0] } });
      expect(await sum()).toMatchObject({ sales: "156560.00", invoices: 1, gold: "20.000", silver: "0", xchg: "0" });
    });
  });

  /* ── users ────────────────────────────────────────────────────────────── */

  describe("users", () => {
    it("deactivating a user ends their session; the last owner can't be removed", async () => {
      const { users: list } = (await call(usersRoute.GET, { token: owner })).body;
      const ownerRow = list.find((u: any) => u.login === "owner");
      const { PATCH } = await import("@/app/api/users/[id]/route");
      expect((await call(PATCH, { method: "PATCH", token: owner, params: { id: ownerRow.id }, body: { role: "staff" } })).status).toBe(409);
      expect((await call(PATCH, { method: "PATCH", token: owner, params: { id: staffId }, body: { active: false } })).status).toBe(200);
      expect((await call(meRoute.GET, { token: staff })).status).toBe(401);
    });
  });
});
