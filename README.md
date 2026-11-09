# Gold & Silver Billing

GST-compliant billing for an Indian gold & silver jewellery shop. The full spec is in [`docs/PRD.md`](docs/PRD.md).

**Stack:** Next.js (App Router, TypeScript) · Tailwind CSS · PostgreSQL (Supabase / Neon) · `decimal.js` for all money and weight math.

## Build status

| Step | Scope | Status |
| --- | --- | --- |
| 1 | Calculation & validation engine + unit tests (T-01 – T-11, T-20 – T-27) | ✅ Done |
| 2 | Database schema & atomic API routes | ⏳ Next |
| 3 | Core screens: rate master, settings, invoice, print/PDF | — |
| 4 | Transactions ledger, backup/restore, dashboards | — |

## Calculation engine

`src/lib/calc-engine.ts` is pure TypeScript with no framework dependencies. The browser uses it for live totals and the server uses it to recompute every invoice before saving (API-01). It covers:

- §7.1 all 18 formulas (`computeLine`, `computeExchangeRow`, `computeInvoice`, `amountInWords`)
- §7.3 GST / IGST auto-detection and place of supply
- §7.4 invoice numbering, FY series and the 16-character limit
- §8 input sanitisers (VAL-01 – 07) and every validation: E-01 – E-19, W-01 – W-08, S-01 – S-10, R-01 – R-05
- §5.2 rate master auto-fill, equivalents, and rate following (RATE-09)
- §13 compliance limits, kept as configuration (`DEFAULT_LIMITS`)

Every computed value is returned as a fixed-decimal string (money 2 dp, grams 3 dp), so the client and the server serialise identically.

## Scripts

```bash
npm install
npm test           # Vitest: calculation + validation suite
npm run typecheck
npm run dev
```
