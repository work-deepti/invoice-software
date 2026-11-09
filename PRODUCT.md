# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Billing staff** at the counter of an Indian gold & silver jewellery shop. They make bills all day, often while a customer is waiting. Their job is to turn a set of articles (weights, purities, making charges, stones, old gold traded in) into a correct, printed GST invoice in under 2 minutes.
- **Owner (admin)**: sets the daily rate master and shop settings, edits and cancels bills, restores backups, and reads the dashboards to see sales, metal sold, GST due and outstanding dues.
- **Viewer** (accountant / family member): read-only access to invoices, the ledger and dashboards; exports CSV for GST filing.

Billing happens on a **mix of devices with equal priority**: desktop/laptop with a keyboard, a tablet at the counter, and phones (confirmed 9 Nov 2026). Keyboard-speed entry and touch entry are both first-class.

## Product Purpose

Produce GST-compliant jewellery invoices from one daily rate master with zero arithmetic errors, keep every bill in a searchable ledger, block or warn on compliance risks at billing time, and give the owner analytics over all invoices. Success: median bill ≤ 2 min, 0 calculation corrections after printing, rates saved before the first bill on ≥ 95% of days, owner opens the dashboard ≥ 3 days a week. Source of truth: `docs/PRD.md`.

## Positioning

A billing tool built around how jewellery is actually priced in India: gross / less / net weight, wastage, making charges quoted three ways, old-gold exchange deducted after GST, the 16-character FY invoice series, and income-tax cash/PAN limits enforced as you type. It is not a generic invoicing SaaS with jewellery bolted on.

## Operating Context

- Rates change daily; the owner enters them every morning in the Rate master, and every new bill picks them up.
- A bill is: invoice details → customer (recalled by phone) → item lines (14 columns) → old gold / silver exchange → notes and summary → save and print on A4.
- Printed A4 invoice (and vector PDF) is handed to the customer; reprints must match the saved bill exactly.
- The accountant uses CSV exports and the monthly GST tables to prepare GSTR-1 / 3B outside the system.
- Deployed to Vercel with serverless PostgreSQL (Supabase / Neon); English UI at launch, labels ready for Hindi / Gujarati / Marathi.

## Capabilities and Constraints

- All money and weights use decimal arithmetic (`src/lib/calc-engine.ts`), money 2 dp, weights 3 dp, grand total to the rupee. The server recomputes every total.
- Indian number formatting everywhere (₹2,03,701.00, lakh / crore); dates DD-MM-YYYY; Asia/Kolkata calendar; FY April–March.
- Layout rules UX-01 to UX-08 are mandatory: no sideways page scroll from 360 px to 1920 px; all 14 item columns on one row at ≥ 1200 px; cards below 1200 px.
- Roles: owner / staff / viewer, enforced on the server.
- Owner decisions (9 Nov 2026):
  - **D-01:** issued invoices are **cancelled with a reason** (stamped CANCELLED, excluded from totals, number series unbroken). Hard delete is owner-only.
  - **D-02:** a ₹2 lakh+ bill with no customer PAN is **blocked** unless "No-PAN declaration (Form 60) received" is ticked.
  - **D-03:** billing staff may edit **only invoices created today**.
- Still open: D-04 (landline shop phone), D-05 (local install + sync), D-06 (dashboard order), D-07 (rate rounding, currently 2 dp), D-08 (credit notes / returns). Compliance limits must be confirmed by the shop's CA.
- Out of scope: inventory, supplier purchases, e-invoicing / IRN, accounting ledgers, online payments, HUID capture.

## Brand Commitments

Binding visual constraints from the owner's brief (these override PRD §15.1's ivory / serif look):

- Modern, high-craft financial / POS software. Named references: Vercel, Apple, Stripe Billing, Linear, Ramp, Square POS.
- No serif fonts, no beige / paper backgrounds, no neon purple-blue gradients, no 3D blobs, no glowing dark-mode gimmicks.
- Palette: canvas `#F8FAFC`; surfaces `#FFFFFF` with `1px #E2E8F0` hairlines and `0 1px 2px rgba(15,23,42,.04)` elevation; ink / top bar / primary buttons `#0F172A`; muted `#64748B`; gold accent `#D97706` / `#B45309` (fill `#FEF3C7`), used on purpose for gold metrics, active states and key highlights; silver `#475569` (fill `#F1F5F9`); error `#DC2626` / `#FEF2F2`, success `#16A34A` / `#F0FDF4`, warning `#D97706` / `#FFFBEB`.
- Type: Geist Sans or Plus Jakarta Sans (500/600/700, `-0.02em` on headers and KPIs); every number, weight, rate, input and total in Geist Mono / JetBrains Mono or tabular figures so decimals line up.
- Motion: sleek and modern but fast. `150ms cubic-bezier(0.16, 1, 0.3, 1)` on row additions, tab switches, drawers and live total updates. Visible focus rings (`ring-2 ring-slate-900/10`, `border-slate-900`).
- Product name (working): "Gold & Silver Billing". The shop's own name, address and GSTIN come from Shop settings and print on every invoice.

## Evidence on Hand

- `docs/PRD.md`: full specification with worked example and test vectors.
- Prototype link and *Sample invoice - INV-2026-27-001.pdf* are referenced in the PRD but are not in this repo.
- No real shop name, logo, customer data or testimonials are in the repo; do not invent them. Empty states must never show sample data (DSH-07).

## Product Principles

1. **Correct before fast, fast right after.** Every figure is computed by the engine; the UI never lets a wrong bill look finished.
2. **The counter is the moment of truth.** Compliance limits (cash ≥ ₹2 lakh, PAN, FY series) are enforced while the customer is still there, with plain-language messages that point at the exact field.
3. **Numbers are the interface.** Weights, rates and totals must read like a trading desk: aligned, unambiguous, never clipped.
4. **What prints is what was saved.** Invoices print from their snapshot; reprints never drift.
5. **Every device is a counter.** The same bill can be made on a desktop, a tablet or a phone without losing speed or accuracy.

## Accessibility & Inclusion

- Keyboard-only billing must be possible: Tab order follows the line, shortcuts Alt+N / Ctrl+S / Ctrl+P / Esc (NFR-07, UX-08).
- Labels on all fields; WCAG AA contrast.
- 16 px inputs on phones (no iOS zoom), numeric keypads for numbers.
- All messages in-page (no browser alerts); toasts auto-hide after about 3 s.
