# Gold & Silver Billing

GST-compliant billing for an Indian gold & silver jewellery shop. Full spec: [`docs/PRD.md`](docs/PRD.md). Product record for design work: [`PRODUCT.md`](PRODUCT.md).

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS · PostgreSQL (Supabase / Neon) via Drizzle ORM · `decimal.js` for all money and weight math.

## Build status

| Step | Scope | Status |
| --- | --- | --- |
| 1 | Calculation & validation engine + unit tests (T-01 – T-11, T-20 – T-27) | ✅ Done |
| 2 | Database schema, auth & roles, atomic REST API + integration tests | ✅ Done |
| 3 | Core screens: sign-in, rate master, settings, invoice, print/PDF | ✅ Done |
| 4 | Transactions ledger UI, CSV, backup/restore, dashboards | ⏳ Next |

## Owner decisions recorded (9 Nov 2026)

| ID | Decision | Implemented as |
| --- | --- | --- |
| D-01 | Cancel with reason instead of delete | `POST /api/invoices/{id}/cancel` (owner); bill stays, excluded from totals. Hard `DELETE` is owner-only. |
| D-02 | ₹2 lakh+ bill without PAN is blocked unless Form 60 is ticked | Error **E-20**; `customer.panDeclaration`. Configurable back to the W-01 warning in settings (`panMissingPolicy`). |
| D-03 | Staff edit only invoices created today | Enforced in `PUT /api/invoices/{id}`; `permissions.canEdit` returned with every invoice. |

## Run it on your Mac

You need **Node 22+** and **PostgreSQL 16** (Homebrew, or a free Supabase / Neon database).

**1. Local Postgres (one time):**

```bash
brew install postgresql@16
```
```bash
brew services start postgresql@16
```
```bash
/opt/homebrew/opt/postgresql@16/bin/createdb gsb_dev && /opt/homebrew/opt/postgresql@16/bin/createdb gsb_test
```

**2. Configure:** copy `.env.example` to `.env` and set:

```
DATABASE_URL=postgresql://localhost:5432/gsb_dev
TEST_DATABASE_URL=postgresql://localhost:5432/gsb_test
AUTH_SECRET=<output of: openssl rand -base64 32>
```

(Homebrew Postgres signs you in as your Mac user with no password, so no user name is needed in the URL.)

**3. Install, migrate, test, run:**

```bash
npm install
```
```bash
npm run db:migrate
```
```bash
npm test
```
```bash
npm run dev
```

`npm test` runs the unit suite and, when `TEST_DATABASE_URL` is set, the PostgreSQL integration suite. The integration suite **drops and re-creates** the test database's schema, so it refuses to run unless the database name contains `test` and differs from `DATABASE_URL`.

### First run

Open http://localhost:3000. The first visit asks you to create the owner account, then takes you to Shop settings. After that: Rate master → enter today's rates → New invoice.

Design system: [`DESIGN.md`](DESIGN.md) ("The Trading Desk").

## Architecture

```
src/lib/calc-engine.ts        Pure engine: §7 formulas, GST, numbering, §8 validations (browser + server)
src/server/db/schema.ts       12 tables of §12.1 (NUMERIC(14,2) money, (12,3) grams, (6,2) %)
drizzle/                      SQL migrations (pg_trgm + schema)
src/server/auth.ts            scrypt passwords, 12 h signed session cookie, role checks
src/server/settings.ts        Shop settings + §13 compliance limits
src/server/rates.ts           Rate master, same-day history overwrite, 30-day matrix
src/server/invoices.ts        Preview / create / update / cancel / delete, numbering, daily_summary, ledger, recall
src/app/api/**/route.ts       REST endpoints (§12.2)
```

**How a save works:** a single database transaction does all of this, or none of it:

1. Re-run the engine on the typed inputs (client totals are ignored, API-01).
2. Validate. Errors return **422** `{errors:[{id, field, message}]}`; unconfirmed warnings return **409** `{warnings:[…]}` until the body includes `acceptWarnings: true`.
3. Allocate the number with one `INSERT … ON CONFLICT DO UPDATE … RETURNING` on `invoice_series`. This row-locks the series, so two counters can never get the same number. On rollback the number is not consumed.
4. Write the header, lines, exchange rows and customer record.
5. Rebuild that day's `daily_summary`. An advisory lock serialises rebuilds of the same date.
6. Write `audit_log` with before/after JSON.

## API

| Method & path | Who | Purpose |
| --- | --- | --- |
| `GET/POST /api/auth/setup` | first run | Needs-setup check / create the first owner |
| `POST /api/auth/login`, `/logout`, `GET /api/auth/me` | all | Session (12 h), role and capabilities |
| `GET/POST /api/users`, `PATCH /api/users/{id}` | owner | Manage staff / viewers |
| `GET/PUT /api/settings` | all / owner | Shop settings + compliance limits |
| `GET/PUT /api/rates` | all / owner | Current rates; save writes today's history |
| `GET /api/rates/history?days=30` | all | History matrix |
| `POST /api/invoices/preview[?editing=id]` | owner, staff | Totals, errors, warnings, next number, no save |
| `GET /api/invoices?q=&from=&to=&metal=&gst=&due=&status=&purity=&mode=&phone=&page=` | all | Ledger page (50) + summary tiles |
| `POST /api/invoices` | owner, staff | Validate, number, save |
| `GET/PUT/DELETE /api/invoices/{id}` | all / owner+staff (D-03) / owner | View, update (same number), hard delete |
| `POST /api/invoices/{id}/cancel` | owner | Cancel with reason (D-01) |
| `GET /api/customers?phone=` or `?q=` | all | Customer recall / autocomplete |

| `GET /api/invoices/{id}/pdf` | all | Vector A4 PDF, e.g. INV-2026-27-001.pdf |

Still to come: `/api/export/csv`, `/api/backup`, `/api/restore`, `/api/dashboard/*` (Step 4).
