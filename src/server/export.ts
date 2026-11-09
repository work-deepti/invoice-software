import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { formatDateDMY, todayIST } from "@/lib/calc-engine";
import type { SessionUser } from "./auth";
import { getDb } from "./db";
import { invoices } from "./db/schema";
import { ledgerWhere, type LedgerFilters } from "./invoices";

/** TXN-12 columns, plus Payment Details and Status. */
const HEADER = [
  "Invoice No",
  "Date",
  "Customer",
  "Phone",
  "GSTIN",
  "PAN",
  "State",
  "Items",
  "Gold Net Wt (g)",
  "Silver Net Wt (g)",
  "GST Added",
  "Items Total",
  "Discount",
  "Taxable / Net",
  "CGST",
  "SGST",
  "IGST",
  "Exchange",
  "Round Off",
  "Grand Total",
  "Received",
  "Balance",
  "Payment Mode",
  "Payment Details",
  "Status",
];

function cell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote when needed; neutralise spreadsheet formulas (=, +, -, @ at the start of text).
  const safe = /^[=+@\t\r]/.test(s) || (/^-/.test(s) && !/^-\d/.test(s)) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** NFR-09: phone and PAN are masked unless the owner asks for full values. */
const maskPhone = (p: string) => (p ? `${"*".repeat(Math.max(0, p.length - 4))}${p.slice(-4)}` : "");
const maskPan = (p: string) => (p ? `${"*".repeat(Math.max(0, p.length - 5))}${p.slice(-5)}` : "");

export function csvFileName(f: LedgerFilters): string {
  const range = f.from || f.to ? `${f.from ?? "start"}_to_${f.to ?? todayIST()}` : `all_${todayIST()}`;
  return `transactions_${range}.csv`;
}

/** GET /api/export/csv — the filtered ledger as UTF-8 CSV with a BOM (opens correctly in Excel). */
export async function exportCsv(f: LedgerFilters, user: SessionUser, full: boolean): Promise<string> {
  const unmask = full && user.role === "owner";
  const status = f.status ?? "all";
  const rows = await getDb()
    .select({
      number: invoices.number,
      date: invoices.invoiceDate,
      name: invoices.customerName,
      phone: invoices.customerPhone,
      gstin: invoices.customerGstin,
      pan: invoices.customerPan,
      state: invoices.customerState,
      items: sql<string>`coalesce((select string_agg(
          coalesce(nullif(l.description, ''), 'Item') || ' (' || coalesce(nullif(l.purity_label, ''), l.metal::text) || ', ' || l.net_g::text || ' g)',
          '; ' order by l.line_no) from invoice_lines l where l.invoice_id = "invoices"."id"), '')`,
      gold: invoices.goldNetG,
      silver: invoices.silverNetG,
      gstOn: invoices.gstOn,
      itemsTotal: invoices.itemsTotal,
      discount: invoices.discount,
      taxable: invoices.taxable,
      cgst: invoices.cgst,
      sgst: invoices.sgst,
      igst: invoices.igst,
      exchange: invoices.exchangeTotal,
      roundOff: invoices.roundOff,
      grand: invoices.grandTotal,
      paid: invoices.paid,
      balance: invoices.balance,
      mode: invoices.payMode,
      details: invoices.payDetails,
      status: invoices.status,
    })
    .from(invoices)
    .where(and(ledgerWhere(f), status === "all" ? undefined : eq(invoices.status, status)))
    .orderBy(desc(invoices.invoiceDate), desc(invoices.createdAt), asc(invoices.number));

  const lines = [HEADER.map(cell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.number,
        formatDateDMY(r.date),
        r.name || "Cash customer",
        unmask ? r.phone : maskPhone(r.phone),
        r.gstin,
        unmask ? r.pan : maskPan(r.pan),
        r.state,
        r.items,
        r.gold,
        r.silver,
        r.gstOn ? "Yes" : "No",
        r.itemsTotal,
        r.discount,
        r.taxable,
        r.cgst,
        r.sgst,
        r.igst,
        r.exchange,
        r.roundOff,
        r.grand,
        r.paid,
        r.balance,
        r.mode,
        r.details,
        r.status === "cancelled" ? "Cancelled" : "Active",
      ]
        .map(cell)
        .join(","),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
