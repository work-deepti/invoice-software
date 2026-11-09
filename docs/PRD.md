# PRD — Gold & Silver Jewellery Billing System

Nov 9, 2026 · Prepared for @Deepti Jain · Senior BA handoff

## 1. Executive summary

Build a web-based billing system for an Indian gold and silver jewellery shop. It produces GST-compliant invoices from a daily rate master, keeps every transaction in a database, and adds analytics dashboards over all invoices. Every rule in this PRD has already been proven in a working prototype. The developer rebuilds it properly; nothing in the logic may be simplified.

| Item | Detail |
| --- | --- |
| Product | Gold & Silver Billing (working name) |
| Document type | Product Requirements Document + developer handoff |
| Version | 1.0 (baseline for build) |
| Owner | Business owner (shop) |
| Prepared by | Senior BA, from the requirement discussions and prototype iterations of 8–9 Nov 2026 |
| Prototype | [Working prototype (claude.ai)](https://claude.ai/artifact/XAfYjjxU6GzhQYxVKGoaNB) + the local desktop package *Gold-Silver-Billing.zip* |
| Market | India; INR; Indian numbering (lakh, crore); Asia/Kolkata time zone |

**How to use this document**

- Sections 5–11 are the functional specification. Each requirement has an ID (e.g. INV-07) for traceability in tickets and tests.
- Section 7 (Calculation engine) and Section 8 (Validations) are the parts most likely to be implemented wrongly. Treat them as the source of truth over the prototype if they ever disagree.
- Section 11 (Analytics dashboards) is new scope not present in the prototype.
- Section 17 lists decisions the owner still has to take. Do not guess these; raise them.

**Keywords.** MUST = mandatory for release. SHOULD = expected unless agreed otherwise. MAY = optional.

## 2. Background, goals and success metrics

Jewellery billing is calculation-heavy and error-prone when done by hand or in spreadsheets. Rates change daily. Weight has three forms (gross, less, net). Making charges are quoted three different ways. Old gold is taken in exchange, and GST and income-tax rules apply. The shop needs one tool that gets every bill right, prints it cleanly, and keeps a searchable record.

**Problems to solve**

1. Daily rates are re-typed on every bill, causing wrong-rate errors.
2. Manual arithmetic for wastage, making, stones, GST and exchange produces mistakes and disputes.
3. There is no single searchable ledger of past bills, customers and balances due.
4. Compliance limits (cash ≥ ₹2 lakh, PAN for high-value bills, invoice-number format) are easy to miss.
5. The owner has no view of sales trends, metal sold, GST liability or outstanding dues.

**Goals**

- G1. Create a correct, printable invoice in under 2 minutes for a typical 1–3 item bill.
- G2. Zero arithmetic errors: every amount is computed by the system using the rules in Section 6.
- G3. One rate master drives all new bills; rate history is kept per day.
- G4. A complete, searchable, exportable ledger of all invoices, with edit and delete.
- G5. Block or warn on compliance risks at the moment of billing.
- G6. Analytics dashboards that answer: how much did we sell, of what, to whom, how was it paid, and what GST is due.
- G7. Works on a shop computer (including offline on a local machine) and on a phone.

**Non-goals (this release)**

- Inventory or stock management (tag/barcode, stock ledger).
- Purchase bills from suppliers, karigar (job-work) accounts, gold loans or savings schemes.
- e-Invoicing (IRN / QR via the GST portal) and GSTR filing upload. The system supplies the numbers; filing stays outside.
- Full accounting (ledgers, P&L, balance sheet). CSV export feeds the accountant instead.
- Online payments collection.

**Success metrics (measured 60 days after go-live)**

| Metric | Target |
| --- | --- |
| Median time to create and print a bill | ≤ 2 min |
| Bills needing correction after printing (calculation errors) | 0 |
| Days on which rates were saved before the first bill | ≥ 95% |
| Bills blocked or warned on a compliance rule that the owner agrees were correct | ≥ 90% |
| Owner opens the dashboard | ≥ 3 days a week |

## 3. Users, roles and scope

Three roles cover the shop. Permissions are enforced on the server, not only hidden in the UI.

| Role | Who | Can do | Cannot do |
| --- | --- | --- | --- |
| Owner (admin) | Shop owner | Everything: settings, rates, billing, edit, delete, restore backup, dashboards, user management | — |
| Billing staff | Counter staff | Create, view and print invoices; edit invoices created today; view rates; view transactions | Change settings or rates; delete invoices; restore backups; see dashboards (configurable) |
| Viewer | Accountant / family member | View and print invoices, transactions and dashboards; export CSV | Create, edit or delete anything |

- ROLE-01 (MUST): Each user signs in. Every invoice stores who created it and who last changed it.
- ROLE-02 (MUST): Edit and Delete buttons are hidden for roles without that right, and the server rejects the action as well.
- ROLE-03 (SHOULD): The owner can let staff see dashboards (toggle in settings).

**Release scope**

| Release | Contents |
| --- | --- |
| R1 — MVP (parity with prototype) | Shop settings; rate master + history; invoice creation with all calculations; GST on/off; IGST auto-detect; numbering series; all validations; transactions ledger with filters, edit, delete; print + PDF; CSV export; backup/restore; responsive layout; local desktop deployment with icon |
| R2 — Insight | Analytics dashboards (Section 11); user roles and audit trail; cancel-instead-of-delete (if approved, Section 17) |
| R3 — Later (not in this PRD) | Inventory, supplier purchases, e-invoicing, WhatsApp/SMS invoice sharing, barcode tags |

## 4. Glossary

| Term | Meaning in this system |
| --- | --- |
| Gross weight | Total weight of the article in grams, including stones (3 decimals) |
| Less weight | Weight of stones/non-metal parts deducted from gross (3 decimals) |
| Net weight | Gross − Less; the metal weight sold |
| Wastage (VA) % | Percentage added to net weight to get chargeable weight |
| Chargeable weight | Net × (1 + wastage%/100); weight on which metal value is charged |
| Purity / fineness | Metal content in %, e.g. 22K = 91.6, 18K = 75, Silver 925 = 92.5 |
| Rate per gram | Price of 1 g of a given purity on a given day (rate master) |
| Fine rate | Rate of the highest purity of that metal (24K/999), used for exchange |
| Making charge | Labour charge: ₹ per gram of net weight, % of metal value, or a flat ₹ amount |
| Stone / other | Flat ₹ amount for stones, certification, polish etc. |
| Old gold exchange | Customer's old metal taken back and deducted from the bill |
| Touch % | Purity of the old metal as tested, used in exchange value |
| Fine weight | Exchange weight × touch% / 100 |
| HSN | GST goods classification code; 7113 = articles of jewellery |
| CGST / SGST | Central and State GST, each half the GST rate, on intra-state sales |
| IGST | Integrated GST at the full rate, on inter-state sales |
| Place of supply | Customer's state (name + 2-digit code); decides CGST+SGST vs IGST |
| GSTIN | 15-character GST registration number; first 2 digits = state code |
| FY | Indian financial year, 1 April – 31 March, written 2026-27 |
| Tax invoice | Invoice with GST. "Bill without GST" = invoice in a separate series with no tax |

## 5. Shop settings and rate master

### 5.1 Shop settings (owner only)

Settings print on every invoice. Each saved invoice keeps a snapshot of them, so reprints of old bills never change when settings change.

| ID | Field | Rule / default |
| --- | --- | --- |
| SET-01 | Shop / business name | Required |
| SET-02 | Phone | Exactly 10 digits, numbers only |
| SET-03 | Email | Valid email format, optional |
| SET-04 | GSTIN | 15 characters, GSTIN format, auto upper-case |
| SET-05 | State | Text, e.g. Maharashtra |
| SET-06 | State code | 2 digits, 01–38; must equal first 2 digits of GSTIN |
| SET-07 | Address | Multi-line |
| SET-08 | GST % on gold/silver | Default 3; allowed 0–28 |
| SET-09 | Add GST by default on new invoices | Default ON; can be switched per invoice |
| SET-10 | Number prefix – GST invoices | Default INV; letters, digits, "-" only; full number ≤ 16 characters |
| SET-11 | Number prefix – bills without GST | Default BILL; same rules |
| SET-12 | Heading on bills without GST | Default INVOICE |
| SET-13 | Default HSN – gold / silver | Default 7113 / 7113; 4–8 digits |
| SET-14 | Restart numbering each FY (Apr–Mar) | Default ON |
| SET-15 | Terms printed on invoice | Default "Goods once sold will not be taken back. / Subject to local jurisdiction." |
| SET-16 | Bank / UPI details | Multi-line, printed on invoice |
| SET-17 | Signature label | Default "Authorised Signatory" |

### 5.2 Rate master

The rate master is a list of purities, each with a rate per gram. New invoices take their rates from it instantly.

- RATE-01 (MUST): Default rows, editable: Gold 24K (999) 99.9%, Gold 22K (916) 91.6%, Gold 18K (750) 75%, Silver 999 99.9%, Silver 925 92.5%. Rates start blank; never seeded with guessed prices.
- RATE-02 (MUST): Each row has Metal (Gold / Silver / Platinum / Other), Purity name (printed on the invoice), Purity %, Rate per gram ₹.
- RATE-03 (MUST): Show an equivalent beside each rate: gold and others per 10 g, silver per kg.
- RATE-04 (MUST): Add and remove purity rows.
- RATE-05 (MUST): "Auto-fill from fine rate": for each metal, take the highest-purity row that has a rate as the base. Every other row of that metal gets base rate × its purity% ÷ base purity%, rounded to 2 decimals. The user can then override any value.
- RATE-06 (MUST): Saving stores the current rates with the date and also writes one rate-history record for that date (overwritten if saved again the same day).
- RATE-07 (MUST): Rate history table shows the last 30 saved days, newest first, one column per purity.
- RATE-08 (MUST): The header of every screen shows today's rates as chips. If rates were last saved before today, show a warning chip "Rates from DD-MM-YYYY — update". If no rates exist, show "Set today's rates →".
- RATE-09 (MUST): Line items not manually re-priced follow rate changes immediately. Lines whose rate the user typed keep that rate.
- RATE-10: Validations in Section 8.4.

## 6. Invoice creation

One screen, five blocks, top to bottom: Invoice details → Customer → Items → Old gold / silver exchange → Notes + Summary. Totals update live on every keystroke.

### 6.1 Invoice details

- INV-01 (MUST): Invoice no. is read-only and shows the next number of the active series (Section 7.4). In edit mode it shows the invoice's own number.
- INV-02 (MUST): Date defaults to today; cannot be in the future (picker max = today).
- INV-03 (MUST): Payment mode: Cash, UPI, Card, Bank transfer, Cheque, Mixed, Credit.
- INV-04 (MUST): "Add GST" tick box, default from SET-09.
- INV-05 (MUST): "Inter-state (IGST)" tick box; disabled and greyed when GST is off; set automatically per 7.3.

### 6.2 Customer

- INV-06 (MUST): Fields: Phone (10 digits), Name (blank prints as "Cash customer"), GSTIN (optional), PAN (optional, label "needed for ₹2 lakh+"), State, Address.
- INV-07 (MUST): Customer recall: the phone field suggests past customers. Typing a full number that matches a past invoice fills any empty Name, Address, GSTIN, PAN and State from the latest invoice of that phone.
- INV-08 (SHOULD): A customers table (one row per phone) is maintained from invoices, so recall stays fast with thousands of bills.

### 6.3 Items (line table)

Columns in this order. On screens ≥ 1200 px wide they fit on one row with no sideways scrolling (Section 15).

| # | Column | Type | Rule |
| --- | --- | --- | --- |
| 1 | # | Auto | Line number |
| 2 | Description | Text | e.g. Necklace, Ring |
| 3 | Metal / purity | Dropdown from rate master | Changing it sets metal, purity label, HSN default and rate |
| 4 | HSN | Text | Default from SET-13 by metal |
| 5 | Pcs | Whole number | Default 1; ≥ 1 when weight entered |
| 6 | Gross wt (g) | Decimal, 3 dp | Required unless line is stone-only or flat-making only |
| 7 | Less wt (g) | Decimal, 3 dp | ≤ Gross |
| 8 | Net wt (g) | Calculated | Gross − Less |
| 9 | Wastage % | Decimal, 2 dp | 0–100 |
| 10 | Rate / g ₹ | Decimal, 2 dp | From rate master; editable per line |
| 11 | Making | Type (₹/g, %, Flat) + value | % ≤ 100 |
| 12 | Stone / other ₹ | Decimal, 2 dp | Flat amount |
| 13 | Amount | Calculated | Section 7.1 |
| 14 | × | Button | Remove line (last line is replaced by a blank one) |

- INV-09 (MUST): "+ Add item" copies the previous line's purity, rate, HSN and making type/value into the new line and focuses its Description.
- INV-10 (MUST): A line whose rate the user edits is marked "manual"; it no longer follows rate-master changes.
- INV-11: HUID is NOT captured. It was removed at the owner's request (9 Nov 2026).

### 6.4 Old gold / silver exchange

- INV-12 (MUST): Optional rows: Description (default "Old gold"), Metal, Weight (g), Touch %, Fine rate / g (default = that metal's fine rate, per RATE-05 base), Fine wt (calc), Value (calc).
- INV-13 (MUST): Exchange value is deducted after GST (Section 7.1). GST is never reduced by exchange.

### 6.5 Notes, summary and actions

- INV-14 (MUST): Notes field (printed on invoice).
- INV-15 (MUST): Summary shows Items total, Discount ₹ (input), Taxable value ("Net amount" when GST off), CGST x% and SGST x% or IGST x% (or "GST: Not added"), Less exchange, Round off, Grand total (large) with amount in words, Amount received ₹ (placeholder "Full: \<total>"), Balance due / Change to return.
- INV-16 (MUST): Grand total label becomes "Payable to customer" when exchange exceeds the bill.
- INV-17 (MUST): Buttons: Save & view invoice, Save & print, Save, Clear (asks to confirm).
- INV-18 (MUST): Errors list appears above the buttons after a failed save (Section 8); clicking an error scrolls to and focuses its field.

### 6.6 Edit mode

- INV-19 (MUST): Opening Edit (from a transaction row or the invoice view) loads the bill into this screen with heading "Editing \<number>" and a "Cancel editing" button. Buttons read Update & view / Update & print / Update.
- INV-20 (MUST): Update keeps the same invoice number, creation date and series. The GST rate stored on the invoice is used, not today's setting.
- INV-21 (MUST): A bill that was fully paid stays fully paid after editing (Amount received loads as blank = Full). A part payment loads the exact amount previously received.
- INV-22 (MUST): Edit rights per ROLE-01/02; every update is logged (Section 12.3).

## 7. Calculation engine, GST and numbering

All money is computed on the server with decimal arithmetic (never binary floating point). Weights round to 3 decimals, money to 2, and the grand total to the nearest rupee. The same engine runs in the browser for live display; the server result is what gets saved.

### 7.1 Formulas (order of operations)

**Per line**

1. Net weight = max(0, Gross − Less), rounded to 3 dp.
2. Chargeable weight = Net × (1 + Wastage% / 100), rounded to 3 dp.
3. Metal value = Chargeable weight × Rate per gram, rounded to 2 dp.
4. Making:
   1. ₹/g: Making value × Net weight (not chargeable weight).
   2. %: Metal value × Making% / 100.
   3. Flat: the amount entered.
   4. Rounded to 2 dp.
5. Stone / other = amount entered, 2 dp.
6. Line amount = Metal value + Making + Stone.

**Per invoice**

7. Items total = sum of line amounts.
8. Discount = min(entered discount, Items total). It cannot exceed the items total.
9. Taxable value = Items total − Discount.
10. GST (when GST is on): intra-state CGST = SGST = Taxable × GST% / 200, each rounded to 2 dp; inter-state IGST = Taxable × GST% / 100. When GST is off, all three are 0.
11. Exchange per row: Fine weight = Weight × Touch% / 100 (3 dp); Value = Fine weight × Fine rate (2 dp). Exchange total = sum.
12. Before rounding = Taxable + GST − Exchange total.
13. Grand total = round to nearest rupee (half away from zero); Round off = Grand total − Before rounding.
14. Received = Grand total when the field is blank ("Full"), else the amount entered.
15. Change to return = max(0, Received − Grand total) when Grand total ≥ 0; Paid = Received − Change.
16. Balance due = Grand total − Paid.
17. Gold weight and silver weight sold = sum of net weights per metal (used in ledger and dashboards).
18. Amount in words, Indian system: "Rupees Two Lakh Three Thousand Seven Hundred One Only" (crore, lakh, thousand, hundred).

```latex
\text{Grand total} = \operatorname{round}\Big(\big(\textstyle\sum \text{line} - \text{discount}\big)\,(1 + \tfrac{\text{GST\%}}{100}) - \sum \text{exchange}\Big)
```

### 7.2 Worked example (verified in the prototype; use as an automated test)

Rates: Gold 22K ₹7,150/g, Gold 18K ₹5,860/g, Silver 925 ₹91/g, Gold 24K ₹7,800/g. Shop and customer both in Maharashtra, so CGST + SGST.

| Line | Gross | Less | Net | Wst | Chargeable | Rate | Metal value | Making | Stone | Amount |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Necklace, 22K | 25.450 | 1.200 | 24.250 | 8% | 26.190 | 7,150 | 1,87,258.50 | ₹600/g → 14,550.00 | 4,500.00 | 2,06,308.50 |
| Diamond ring, 18K | 4.120 | 0.180 | 3.940 | — | 3.940 | 5,860 | 23,088.40 | 15% → 3,463.26 | 18,500.00 | 45,051.66 |
| Anklets, Silver 925 (2 pcs) | 62.300 | — | 62.300 | — | 62.300 | 91 | 5,669.30 | Flat 1,200.00 | — | 6,869.30 |

| Step | Amount (₹) |
| --- | --- |
| Items total | 2,58,229.46 |
| Discount | −1,500.00 |
| Taxable value | 2,56,729.46 |
| CGST 1.5% | 3,850.94 |
| SGST 1.5% | 3,850.94 |
| Less old gold: 8.500 g × 91.6% = 7.786 g × 7,800 | −60,730.80 |
| Before rounding | 2,03,700.54 |
| Round off | +0.46 |
| Grand total | 2,03,701.00 |
| Received (Mixed) | 1,50,000.00 |
| Balance due | 53,701.00 |

More test vectors (Section 16): IGST bill 12 g × 7,150 + ₹500/g = 91,800 + IGST 3% 2,754 = 94,554; no-GST bill 20 g silver 999 × 98 = 1,960.

### 7.3 GST rules

- GST-01 (MUST): GST on/off per invoice (default SET-09). GST invoices print "TAX INVOICE" + "ORIGINAL FOR RECIPIENT"; bills without GST print the SET-12 heading and no tax lines.
- GST-02 (MUST): IGST is ticked automatically when both the customer's state and the shop's state are filled and differ (case-insensitive). The user can override.
- GST-03 (MUST): Place of supply = customer's state, else the shop's state. Its 2-digit code comes from the customer's GSTIN when valid, else the shop's code when the states match. Printed as "Karnataka (29)".
- GST-04 (MUST): The GST rate used is stored on each invoice. Changing SET-08 later does not change old invoices, including when they are edited.

### 7.4 Invoice numbering

- NUM-01 (MUST): Two independent series: GST invoices use SET-10 prefix; bills without GST use SET-11 prefix.
- NUM-02 (MUST): Format with FY reset ON: PREFIX/FY/NNN, e.g. INV/2026-27/001 (3-digit, grows past 999). With FY reset OFF: PREFIX-NNNN, e.g. INV-0001.
- NUM-03 (MUST): FY is taken from the invoice date: April–March. A bill dated 15-03-2027 belongs to 2026-27.
- NUM-04 (MUST): Next number = 1 + the highest number ever issued in that series and FY. Allocation must be atomic on the server (a database sequence or row lock), so two counters billing at the same moment never get the same number.
- NUM-05 (MUST): Numbers are never reused, including after deletion.
- NUM-06 (MUST): The full number must be ≤ 16 characters (GST invoice rule). Settings block a prefix that would break this; with the FY format the prefix can be at most 4 characters.
- NUM-07 (MUST): Switching GST off on a new bill switches its preview number to the non-GST series immediately. Editing an existing bill never changes its number.

## 8. Input rules and validations

Validation has three layers: input rules stop bad characters as they are typed; errors block saving; warnings ask "Save anyway?". Every rule below is enforced again on the server, so an API call cannot bypass it.

### 8.1 Input rules (as you type)

- VAL-01 (MUST): No negative numbers anywhere. The minus, plus and "e" keys are blocked in number fields; a pasted negative becomes positive; arrow-down stops at 0.
- VAL-02 (MUST): Phone fields (customer and shop) accept digits only, maximum 10. Pasted text is stripped to digits.
- VAL-03 (MUST): GSTIN (max 15) and PAN (max 10) accept letters and digits only and are forced to upper case.
- VAL-04 (MUST): State code accepts digits only, maximum 2. Pieces accept whole numbers only (a decimal is rounded on leaving the field).
- VAL-05 (MUST): On leaving a field, weights round to 3 decimals; rates, money and percentages to 2.
- VAL-06 (MUST): Scrolling the mouse wheel over a focused number field must not change its value.
- VAL-07 (MUST): Date picker max = today.

### 8.2 Invoice: errors (block saving)

The field turns red with the message as a tooltip; all errors are listed above the save buttons. Errors marked "live" turn red while typing; format errors turn red when the user leaves the field or presses Save.

| ID | Condition | Message | Live |
| --- | --- | --- | --- |
| E-01 | Customer phone entered and not exactly 10 digits | Phone number must be exactly 10 digits. | No |
| E-02 | Customer GSTIN entered and fails format ^\\d{2}\[A-Z\]{5}\\d{4}\[A-Z\]\[1-9A-Z\]Z\[0-9A-Z\]$ | Customer GSTIN is not valid — it must be 15 characters, e.g. 27ABCDE1234F1Z5. | No |
| E-03 | PAN entered and fails ^\[A-Z\]{5}\\d{4}\[A-Z\]$ | PAN is not valid — 5 letters, 4 numbers, 1 letter (e.g. ABCDE1234F). | No |
| E-04 | Date missing | Enter the invoice date. | No |
| E-05 | Date after today | Invoice date cannot be in the future. | Yes |
| E-06 | No line with weight, amount or description | Add at least one item with its weight. | No |
| E-07 | Line has no gross weight and is not stone-only or flat-making-only | Item n: enter the gross weight. | No |
| E-08 | Less weight > gross weight | Item n: less (stone) weight cannot be more than gross weight. | Yes |
| E-09 | Pieces not a whole number | Item n: pieces must be a whole number. | Yes |
| E-10 | Weight entered and pieces < 1 | Item n: pieces must be at least 1. | No |
| E-11 | Wastage > 100 | Item n: wastage cannot be more than 100%. | Yes |
| E-12 | Making type % and value > 100 | Item n: making charge cannot be more than 100%. | Yes |
| E-13 | Weight entered and rate ≤ 0 | Item n: enter the rate per gram. | No |
| E-14 | Exchange touch > 100 | Exchange item n: touch cannot be more than 100%. | Yes |
| E-15 | Exchange weight entered and touch ≤ 0 | Exchange item n: enter the touch %. | No |
| E-16 | Exchange weight entered and rate ≤ 0 | Exchange item n: enter the fine rate. | No |
| E-17 | Discount > items total | Discount cannot be more than the items total. | Yes |
| E-18 | Balance due > 0 and name or phone missing | Some amount is still due — enter the customer's name and phone so you know who owes it. | No |
| E-19 | Payment mode Cash and amount received ≥ ₹2,00,000 | Cash of ₹2 lakh or more cannot be accepted against one bill under income-tax law. Take part of it by UPI / card / bank and set payment mode to "Mixed". | Yes |

### 8.3 Invoice: warnings (confirm with "Save anyway")

All warnings are shown together in one confirmation dialog, as bullets.

| ID | Condition | Message |
| --- | --- | --- |
| W-01 | Grand total ≥ ₹2,00,000 and no PAN | This bill is ₹2 lakh or more: the customer's PAN (or the no-PAN declaration form) must be collected. Enter the PAN if you have it. |
| W-02 | Payment Mixed and received ≥ ₹2,00,000 | Make sure the cash part of this payment is below ₹2 lakh. |
| W-03 | Grand total < 0, payment Cash, payout > ₹10,000 | Paying the customer more than ₹10,000 in cash (for old gold) is not allowed as a business expense — pay by bank / UPI. |
| W-04 | Valid GSTIN and valid PAN and GSTIN characters 3–12 ≠ PAN | The PAN does not match the PAN inside the customer's GSTIN. |
| W-05 | New bill dated more than 30 days ago | The invoice date (DD-MM-YYYY) is more than 30 days old. |
| W-06 | Line rate differs from today's rate for that purity by > 10% | Item n: rate ₹X/g is more than 10% away from today's \<purity> rate (₹Y/g). |
| W-07 | Gross > 5,000 g (gold) or > 1,00,000 g (other) | Item n: X g looks unusually heavy — please check the weight. |
| W-08 | New bill, same date, same customer name and phone, same total as a saved bill | A bill for the same customer and amount was already saved today (\<number>). Is this a duplicate? |

### 8.4 Settings and rate master validations (errors)

| ID | Condition | Message |
| --- | --- | --- |
| S-01 | Shop name blank | Enter the shop name. |
| S-02 | Shop phone not 10 digits | Shop phone must be exactly 10 digits. |
| S-03 | Email invalid | Email address is not valid. |
| S-04 | Shop GSTIN invalid | Shop GSTIN is not valid — it must be 15 characters, e.g. 27ABCDE1234F1Z5. |
| S-05 | State code not 01–38 | State code must be 2 digits between 01 and 38. |
| S-06 | State code ≠ GSTIN digits 1–2 | State code should be NN — the first 2 digits of your GSTIN. |
| S-07 | GST % outside 0–28 | GST % must be between 0 and 28. |
| S-08 | Prefix has other than letters, digits, "-" or > 10 chars | Invoice prefix: use only letters, numbers or "-" (max 10). |
| S-09 | Longest possible number > 16 chars | Invoice numbers can be at most 16 characters under GST rules — shorten this prefix to N characters or less. |
| S-10 | HSN not 4–8 digits | HSN code must be 4 to 8 digits. |
| R-01 | Purity row has a rate but no name | Row n: enter a purity name. |
| R-02 | Duplicate purity name (case-insensitive) | "\<name>" is listed twice. |
| R-03 | Purity % not in (0, 100\] | \<name>: purity % must be more than 0 and at most 100. |
| R-04 (warning) | Purity without a rate | \<name> has no rate. |
| R-05 (warning) | Lower purity priced above a higher purity of the same metal | \<lower> rate is higher than \<higher> — please check. |

## 9. Transactions ledger

The ledger lists every saved invoice, newest first, with filters, summary tiles and row actions. It must stay fast with 50,000+ invoices, so filtering, totals and paging run on the server.

### 9.1 Filters and search

- TXN-01 (MUST): Free-text search across invoice number, customer name, phone, GSTIN, PAN, notes and item descriptions.
- TXN-02 (MUST): From / To date, Metal (All / Gold / Silver), GST (All / With GST / Without GST), Payment (All / Balance due).
- TXN-03 (MUST): Quick buttons Today, This month, Clear.
- TXN-04 (SHOULD): Filters are reflected in the URL so a filtered view can be bookmarked.
- TXN-05 (MUST): Paging or infinite scroll, 50 rows per page. The prototype showed only the latest 1,000; the product must reach every invoice.

### 9.2 Summary tiles (for the filtered set)

Invoices (count) · Total billed (₹) · GST collected (₹) · Gold sold (net g) · Silver sold (net g) · Exchange taken (₹) · Balance due (₹).

### 9.3 Table columns and row actions

- TXN-06 (MUST): Columns: Date · Invoice (link opens view) · Customer (name + phone) · Gold (g) · Silver (g) · Taxable · GST ("No GST" tag when off) · Total · Balance (red tag when > 0) · Mode · Actions.
- TXN-07 (MUST): Row actions: View · Print · Edit · Delete, on one line on computers and as four large buttons on phone cards. Edit and Delete appear only for permitted roles.
- TXN-08 (MUST): View opens the invoice preview (scaled to fit the screen) with Print, Download PDF, Edit, Delete and Close.
- TXN-09 (MUST): Delete asks to confirm: "Delete \<number>?" / "This permanently removes invoice \<number> (\<customer>, \<total>). It cannot be undone, and its number will not be reused." Cancel leaves it untouched.
- TXN-10 (MUST): Deleting a bill that is open in edit mode clears the form. Deleting the open preview closes it.
- TXN-11 (SHOULD, decision pending): Cancel instead of delete — see Section 17, D-01.

### 9.4 Export, backup and restore

- TXN-12 (MUST): Export CSV of the filtered set, UTF-8 with BOM (opens correctly in Excel). Columns: Invoice No, Date, Customer, Phone, GSTIN, PAN, State, Items ("desc (purity, net g)" joined by "; "), Gold Net Wt (g), Silver Net Wt (g), GST Added (Yes/No), Items Total, Discount, Taxable / Net, CGST, SGST, IGST, Exchange, Round Off, Grand Total, Received, Balance, Payment Mode.
- TXN-13 (MUST): Full backup (JSON): settings, rates, rate date, numbering counters, rate history and all invoices, with export timestamp.
- TXN-14 (MUST): Restore backup (owner only): validate the file, show "It contains N invoices plus settings and rates. Invoices with the same number here will be replaced; nothing else is deleted.", then write with progress "Restoring… n/N". Used to move data from the cloud version to a local install and back.
- TXN-15 (MUST, local install): automatic daily database copy, last 60 days kept (Section 14).

## 10. Invoice print and PDF

The printed invoice is A4 portrait. It is generated from one template used for the screen preview, direct print and PDF, so all three always match. The verified sample is *Sample invoice - INV-2026-27-001.pdf* from the prototype.

### 10.1 Layout, top to bottom

1. **Header, left:** shop name (large serif), address, "Ph: … · email", "GSTIN: … · State: Maharashtra (27)".
2. **Header, right:** "TAX INVOICE" + small "ORIGINAL FOR RECIPIENT" (GST bills) or the SET-12 heading (non-GST). Then Invoice no., Date (DD-MM-YYYY), Payment mode.
3. **Gold rule** across the page.
4. **Bill to (left):** name (bold), address, "Ph:", "GSTIN:", "PAN:", each only if present. **Place of supply (right):** "State (code)".
5. **Items table:** # · Description · HSN · Purity · Pcs · Gross wt · Net wt · Wst (only if any line has wastage; shows "8%" with "= 26.190 g" beneath) · Rate/g · Metal value · Making (amount, with "@ ₹600/g" or "15% of value" beneath; "—" when zero) · Stone/other ("—" when zero) · Amount (bold). Purity never wraps.
6. **Total row:** pieces and items total. Gross and net weight totals appear only when all lines are one metal.
7. **Weight by metal line** when metals are mixed: "Gold — gross 29.570 g, net 28.190 g · Silver — gross 62.300 g, net 62.300 g". Never add gold and silver grams together.
8. **Exchange table** (if any): Description · Metal · Weight · Touch % · Fine wt · Rate/g · Value.
9. **Bottom left:** amount in words (bold), notes, "Bank / UPI" block. **Bottom right:** totals box — Items total, Discount (if any), Taxable value (or Net amount), CGST/SGST or IGST, Less old gold/silver (if any), Round off (if non-zero), Grand total (or "Payable to customer"), Received (mode), Balance due (if any).
10. **Footer:** Terms (left); "For \<Shop name>", signature line and signature label (right).
11. **Page footer** on every page: "\<Invoice no> · Page x of y", bottom right, small grey.

### 10.2 Print rules

- PRT-01 (MUST): Rows never split across pages; the table header repeats on each page; the totals block and the signature block are kept together.
- PRT-02 (MUST): Indian number format with ₹ throughout (₹2,03,701.00). Weights always 3 decimals.
- PRT-03 (MUST): Invoices print from their saved snapshot (shop details, rates, GST rate, totals). Nothing is recalculated at print time.
- PRT-04 (MUST): Print, Save & print and the row Print button open the browser's print dialog directly with only the invoice on the page.
- PRT-05 (MUST): Download PDF produces a true vector/text PDF (server-side, e.g. headless Chromium or a PDF library) — not a screenshot. File name = invoice number with "/" replaced by "-", e.g. INV-2026-27-001.pdf.
- PRT-06 (SHOULD): Optional duplicate copy ("DUPLICATE FOR SUPPLIER") toggle at print time.
- PRT-07 (MAY): Share PDF via WhatsApp / email (R3).

## 11. Analytics dashboards (new)

A new "Dashboard" tab gives the owner a clear picture of sales, metal sold, customers, dues, payments, GST and rates over any period. Every number is computed from saved invoices using the definitions in 11.2, and every chart drills down to the matching transactions.

### 11.1 Principles

- DSH-01 (MUST): One global filter bar for all dashboard pages: period (Today, Yesterday, This week, This month, Last month, This FY, Last FY, Custom range), Metal, GST (with / without), Payment mode. Default = This month.
- DSH-02 (MUST): Every KPI shows the value for the period, the previous equal period, and the change in % with an up/down arrow. For example, This month vs Last month, and a custom 10-day range vs the 10 days before it.
- DSH-03 (MUST): Clicking a bar, point, slice or table row opens Transactions filtered to exactly those invoices.
- DSH-04 (MUST): Indian formatting everywhere. Large values show as ₹12.4 L and ₹1.2 Cr on axes and tiles, with the exact amount in the tooltip.
- DSH-05 (MUST): Days, weeks and months follow the Asia/Kolkata calendar; FY runs April–March.
- DSH-06 (MUST): Each chart has a title stating what it shows and a "Download CSV" of the rows behind it. The whole page can be exported as PDF.
- DSH-07 (MUST): Each chart and tile has an empty state ("No sales in this period"). Charts never show fake or sample data.
- DSH-08 (MUST): Loads in under 2 seconds for 3 years of data (50,000 invoices). Use pre-aggregated daily summary tables refreshed on every invoice save, edit or delete.
- DSH-09 (MUST): The same visual design system as the app (Section 15). Colours carry meaning: gold for gold, cool grey for silver, red only for dues and risk.
- DSH-10 (MUST): Responsive. KPIs show 4 per row on desktop and 2 on phones; charts stack on phones; no sideways scrolling.

### 11.2 Metric definitions (single source of truth)

Included invoices: all saved invoices whose invoice date falls in the period and matches the filters. Cancelled invoices (if D-01 is approved) are excluded and counted separately.

| Metric | Definition |
| --- | --- |
| Sales (gross billed) | Sum of Grand total |
| Net sales (pre-tax) | Sum of Taxable value |
| Invoices | Count of invoices |
| Average bill value | Sales ÷ Invoices |
| GST collected | Sum of CGST + SGST + IGST (each also shown separately) |
| Gold sold (g) | Sum of net weight of Gold lines; also by purity |
| Silver sold (g) | Sum of net weight of Silver lines; also by purity |
| Metal value | Sum of line Metal value |
| Making earned | Sum of line Making |
| Stone / other | Sum of line Stone / other |
| Making % of sales | Making earned ÷ Net sales |
| Discount given | Sum of Discount |
| Old gold taken (g, ₹) | Sum of exchange Weight, Fine weight and Value, by metal |
| Received | Sum of Paid |
| Outstanding dues | Sum of Balance due for invoices with balance > 0 (as of today, all dates, not only the period) |
| Cash share | Received with mode Cash ÷ total Received |
| Unique customers | Distinct phone numbers (blank phone counted as "Walk-in") |
| Repeat customers | Customers with ≥ 2 invoices in the period |

### 11.3 Pages and charts

**A. Overview** (landing page)

- KPI tiles (8): Sales · Invoices · Average bill · Gold sold (g) · Silver sold (g) · GST collected · Making earned · Outstanding dues.
- Sales trend: line chart of daily Sales for the period (weekly or monthly points when the period exceeds 62 days), with the previous period as a dashed line.
- Sales mix: stacked bars per day/month splitting Net sales into Metal value, Making, Stone/other, plus GST.
- Gold vs silver: two small line charts of grams sold per day/month.
- Top 5 customers by Sales, as a bar list.
- Today's rates strip with change vs yesterday (from rate history).

**B. Sales & products**

- Sales by purity: horizontal bar chart (₹ and grams, toggle), e.g. Gold 22K, 18K, Silver 925.
- Sales by item description: top 15 descriptions (normalised: trimmed, case-insensitive) by ₹ and by count.
- Bill size distribution: histogram of Grand total in buckets (< ₹10k, 10–50k, 50k–1L, 1–2L, 2–5L, > 5L).
- Day-of-week × hour heatmap of invoice count (uses creation time), to plan staff.
- Making charge analysis: average making per gram and making % by purity.
- Discount analysis: total discount and discount as % of net sales, by month.

**C. Customers & dues**

- New vs repeat customers per month (stacked bars).
- Top 20 customers table: name, phone, invoices, sales, last purchase date, outstanding.
- Dues ageing: bars for 0–30, 31–60, 61–90, > 90 days, by invoice date; table of each due invoice with a "Call" link (tel:) and days overdue.
- Customer lookup: search a phone and see lifetime sales, grams bought, invoices and dues.

**D. Payments**

- Received by payment mode: bars per mode for the period, and a stacked monthly trend.
- Cash compliance panel: count of bills with Cash ≥ ₹1.5 lakh (approaching the limit), Mixed bills ≥ ₹2 lakh, and ₹2 lakh+ bills without PAN. Each is a drill-down list.

**E. GST & compliance (accountant view)**

- Monthly GST summary table for the selected FY: month, taxable value, CGST, SGST, IGST, total tax, invoice count, first and last invoice number. Downloadable as CSV for GSTR-1 / GSTR-3B preparation.
- B2B vs B2C split: invoices with customer GSTIN (B2B, listed per GSTIN) vs without (B2C, by place of supply). B2C inter-state above the GST large-invoice threshold flagged separately (threshold configurable).
- HSN summary: per HSN code — quantity (grams), taxable value, CGST, SGST, IGST.
- Invoice number gaps: list of numbers missing in each series (deleted bills), with who deleted them and when.
- Bills without GST: count and value per month.

**F. Rates & old gold**

- Rate trend: line chart per purity from rate history (period selectable up to 1 year).
- Old gold intake: grams and fine grams per month, average touch %, value.
- Realised rate vs master rate: average rate charged per purity vs the master rate that day, to spot discounting.

### 11.4 Access

- DSH-11 (MUST): Owner sees all pages. Viewer sees all pages. Billing staff see none unless ROLE-03 is on.
- DSH-12 (SHOULD): A weekly summary email to the owner every Monday 9:00 (Sales, grams, GST, dues, vs previous week).

## 12. Data model and API

A relational database is recommended (PostgreSQL in the cloud, SQLite for the single-PC install). Money is stored as NUMERIC(14,2), weights as NUMERIC(12,3), percentages as NUMERIC(6,2). Every table has created\_at, updated\_at, created\_by, updated\_by.

### 12.1 Tables

| Table | Key columns |
| --- | --- |
| shop\_settings (1 row) | name, phone, email, gstin, state, state\_code, address, gst\_rate, gst\_default, prefix\_gst, prefix\_nogst, nogst\_title, hsn\_gold, hsn\_silver, fy\_numbering, terms, bank\_details, signatory\_label, staff\_can\_see\_dashboard |
| purities | id, metal (Gold/Silver/Platinum/Other), label (unique), purity\_pct, sort\_order, active |
| rates\_current | purity\_id, rate\_per\_g, effective\_date |
| rate\_history | date, purity\_id, label, metal, purity\_pct, rate\_per\_g — unique (date, purity\_id) |
| customers | id, phone (unique, nullable), name, address, gstin, pan, state, first\_invoice\_at, last\_invoice\_at |
| invoice\_series | series\_key (e.g. "INV" + "2026-27"), prefix, fy, last\_seq — row-locked when issuing |
| invoices | id, number (unique), series\_key, seq, fy, invoice\_date, gst\_on, inter\_state, gst\_rate, customer\_id + customer snapshot (name, phone, address, gstin, pan, state), place\_of\_supply, place\_code, pay\_mode, discount, items\_total, taxable, cgst, sgst, igst, exchange\_total, round\_off, grand\_total, paid, change\_returned, balance, gold\_net\_g, silver\_net\_g, notes, shop\_snapshot (JSON), status (active / cancelled), cancelled\_reason |
| invoice\_lines | id, invoice\_id, line\_no, description, purity\_id, metal, purity\_label, hsn, pcs, gross\_g, less\_g, net\_g, wastage\_pct, chargeable\_g, rate\_per\_g, rate\_manual, making\_type (per\_g / pct / flat), making\_input, making\_amt, stone\_amt, metal\_value, amount |
| invoice\_exchange | id, invoice\_id, description, metal, weight\_g, touch\_pct, fine\_g, fine\_rate, value |
| audit\_log | id, at, user\_id, entity, entity\_id, action (create/update/delete/cancel/restore/settings/rates), before (JSON), after (JSON) |
| users | id, name, login, role (owner/staff/viewer), active |
| daily\_summary | date, metal, purity\_id, gst\_on, pay\_mode → invoices, sales, taxable, cgst, sgst, igst, net\_g, making, stone, discount, exchange\_value, exchange\_g (feeds dashboards) |

- DATA-01 (MUST): Inputs (making\_input, rate, wastage) and computed outputs (making\_amt, metal\_value, amount) are both stored, so an invoice can be re-opened exactly as typed and printed exactly as saved.
- DATA-02 (MUST): Invoice header + lines + exchange + series number + daily\_summary update are written in one database transaction.
- DATA-03 (MUST): Indexes on invoices(invoice\_date), invoices(customer phone), invoices(number), invoice\_lines(invoice\_id), and a full-text index for search.

### 12.2 API (REST, JSON)

| Method & path | Purpose |
| --- | --- |
| GET / PUT /api/settings | Read / save shop settings (owner) |
| GET / PUT /api/rates | Current rates; save writes rate\_history for today |
| GET /api/rates/history?days=30 | Rate history |
| POST /api/invoices/preview | Run the calculation engine and validations without saving; returns totals, errors, warnings, next number |
| POST /api/invoices | Validate, allocate number, save; body carries acceptWarnings: true after the user confirms |
| GET /api/invoices?q=&from=&to=&metal=&gst=&due=&page= | Ledger list + summary tiles for the filter |
| GET / PUT / DELETE /api/invoices/{id} | View, update (same number), delete (owner) |
| POST /api/invoices/{id}/cancel | Cancel with reason (if D-01 approved) |
| GET /api/invoices/{id}/pdf | Server-rendered PDF |
| GET /api/customers?phone= | Recall by phone |
| GET /api/export/csv?… | CSV of the filtered ledger |
| GET /api/backup, POST /api/restore | Full JSON backup / restore (owner) |
| GET /api/dashboard/{page}?period=&metal=&gst=&mode= | Aggregates for each dashboard page |

- API-01 (MUST): The server recomputes every total from inputs; client-sent totals are ignored.
- API-02 (MUST): Errors return HTTP 422 with a list of {id, field, message}; warnings return 409 with the list until acceptWarnings is sent.

### 12.3 Audit trail

- AUD-01 (MUST): Every create, update, delete, cancel, restore, settings change and rate change writes audit\_log with before/after JSON and the user.
- AUD-02 (SHOULD): Invoice view shows "Created by X on … · Last edited by Y on …" and a History link for the owner.

## 13. Compliance rules reference

The system enforces these rules at billing time. All limits are stored as configuration (not hard-coded), because tax law changes; the owner's CA must confirm the values before go-live.

| Rule | What the law says (summary) | How the system applies it | Config key / default |
| --- | --- | --- | --- |
| Cash receipt limit (Income-tax Act, s.269ST) | No one may receive ₹2 lakh or more in cash from one person in a day, for one transaction or one event; the penalty equals the amount received | E-19 blocks a Cash bill with received ≥ limit; W-02 warns on Mixed; dashboard panel D lists near-limit bills | cash\_limit = 200000 |
| PAN for high-value sales (Income-tax Rules, r.114B) | PAN (or the no-PAN declaration form) must be quoted for a sale of goods above ₹2 lakh, in any payment mode | W-01 warns when total ≥ limit and PAN is blank; PAN printed on invoice; dashboard flags such bills | pan\_limit = 200000 |
| Cash payouts as business expense (s.40A(3)) | Cash payments above ₹10,000 in a day to one person are not allowed as a business expense | W-03 warns when an exchange payout in cash exceeds the limit | cash\_payout\_limit = 10000 |
| GST tax invoice contents (CGST Rule 46) | Supplier name, address, GSTIN; consecutive serial number of at most 16 characters, unique per FY; date; recipient details and GSTIN if registered; HSN; description, quantity, value; taxable value; rate and amount of CGST/SGST/IGST; place of supply with state; signature | Section 10 layout; NUM-01–06; GST-01–04; Original for recipient | max\_invoice\_no\_length = 16 |
| GST rate on gold / silver jewellery | 3% (CGST 1.5% + SGST 1.5%, or IGST 3%) | SET-08 default 3; rate stored per invoice | gst\_rate = 3 |
| BIS hallmarking (HUID) | Hallmarked gold jewellery carries a 6-character HUID | Not captured — removed at owner's request. Can be re-added as an optional line field | — |

Disclaimer: this table summarises rules for product design. It is not legal or tax advice. Sources are listed in Section 18.

## 14. Architecture, deployment and non-functional requirements

One codebase serves two deployments: a cloud version used from any device, and a local install on the shop PC that works without internet and can serve phones on the shop Wi-Fi. Both use the same web front end, API and calculation engine; only the database and hosting differ.

&#91;embedded content: Deployment architecture · local install and cloud\]

The highlighted API + calculation engine is identical in both places, so a bill computes the same everywhere; only storage and hosting change.

### 14.1 Recommended stack (developer may propose equivalents)

| Layer | Recommendation | Why |
| --- | --- | --- |
| Front end | React or Vue + TypeScript, responsive CSS; chart library (e.g. ECharts or Recharts) | Live recalculation, dashboards, one UI for desktop and phone |
| API | Node.js (NestJS/Express) or Python (FastAPI) | Simple REST; decimal maths library (decimal.js / Python Decimal) |
| Database | PostgreSQL (cloud); SQLite (local install) | Transactions, numeric types, row locks for numbering |
| PDF | Server-side HTML-to-PDF (headless Chromium) from the same invoice template | Vector, searchable PDF that matches the print |
| Desktop wrapper | Small launcher (Electron, Tauri or a packaged Python/Node server) | One-click icon, runs in background, opens an app window |

### 14.2 Local desktop install (parity with prototype)

- DEP-01 (MUST): A Windows installer (and a Mac build) that installs the app, creates a "Gold Silver Billing" desktop icon and Start-menu entry with the app icon (gold bar + silver rupee coin, supplied as .ico / .icns / .png).
- DEP-02 (MUST): Double-clicking the icon starts the server silently in the background (no console window) if not already running, then opens the app in its own window. A second double-click only opens the window.
- DEP-03 (MUST): All data lives in one database file in the app's data folder; daily automatic copy to a backups folder, last 60 days kept.
- DEP-04 (MUST): Optional "Allow phones on shop Wi-Fi" setting. When on, settings show the address for other devices (e.g. http://192.168.1.5:8000) and access requires a sign-in. When off, only this PC can connect.
- DEP-05 (MUST): "Stop billing server" in settings (owner, this PC only); messages tell users how to restart.
- DEP-06 (SHOULD): Option to start automatically when Windows starts.
- DEP-07 (MUST): Works fully offline, including PDF generation (no CDN dependencies at runtime).

### 14.3 Cloud deployment

- DEP-08 (MUST): HTTPS only; managed PostgreSQL with point-in-time recovery; nightly off-site backup kept 35 days.
- DEP-09 (SHOULD): Optional sync: the local install can push a backup to the cloud account nightly.

### 14.4 Non-functional requirements

| ID | Area | Requirement |
| --- | --- | --- |
| NFR-01 | Performance | Invoice totals update < 100 ms per keystroke; save < 1 s; ledger page < 1 s with 50,000 invoices; dashboard < 2 s |
| NFR-02 | Accuracy | Decimal arithmetic only; the worked example and test vectors in Section 16 pass exactly to the paisa |
| NFR-03 | Security | Hashed passwords; role checks on every API call; session timeout 12 h; owner-only settings, delete, restore |
| NFR-04 | Data retention | Invoices are never auto-deleted; keep at least 8 years. Deletes are logged in the audit trail |
| NFR-05 | Reliability | Saving is atomic; a power cut never leaves a half-saved invoice or a skipped number |
| NFR-06 | Browsers | Latest Chrome, Edge, Safari, Firefox; Android Chrome; iOS Safari |
| NFR-07 | Accessibility | Keyboard-only billing possible (Tab order follows the line); labels on all fields; contrast AA |
| NFR-08 | Localisation | English UI at launch; all labels in a resource file so Hindi/Gujarati/Marathi can be added |
| NFR-09 | Privacy | Customer PAN/phone visible only to signed-in users; masked in CSV export unless the owner opts in |

## 15. UI/UX design system and responsive behaviour

The look is warm, calm and premium, like a good jewellery store: ivory surfaces, charcoal text and a single gold accent. The prototype's look is the reference; a designer may refine it but must keep the layout rules below.

### 15.1 Visual tokens

| Token | Value | Use |
| --- | --- | --- |
| Background | #F5F1E8 (ivory) | Page |
| Surface | #FFFDF8 | Cards |
| Ink | #1D1A16 | Text, header bar |
| Muted | #6F665A | Labels, hints |
| Line | #E3DAC9 | Borders |
| Gold | #A57C1B / dark #7D5C0F / light #F3E7C6 | Primary buttons, amounts, gold metrics |
| Silver | #6F7781 | Silver metrics |
| Error / OK / Warning | #B23A2F / #2F7D4F / #A86412 | Validation, status |
| Headings | Fraunces (serif) 600 | Page titles, shop name, totals |
| Body | Manrope 400–700, tabular numbers | All UI text and numbers |
| Radius | 10 px cards, 7–8 px inputs and buttons | — |

### 15.2 Layout rules

- UX-01 (MUST): Top bar: shop name, today's rate chips, save status ("Saved to cloud" / "Saved on this computer" / errors), tabs: New invoice · Transactions · Dashboard · Rate master · Shop settings.
- UX-02 (MUST): Screens ≥ 1200 px: the item line shows all 13 fields on one row with no sideways scrolling, using a fixed column plan (approx. %: Description 15.5, Purity 12.5, HSN 5.5, Pcs 4, Gross 7, Less 6.5, Net 6.5, Wst 5, Rate 7.5, Making 11, Stone 6.5, Amount 10.5). Number spin arrows are hidden to save space. Tested so that ₹11,38,323.42 and 145000 are not clipped at 1200 px.
- UX-03 (MUST): Screens < 1200 px (small laptops, tablets, phones): each item, exchange row, transaction and rate row becomes a card with labelled fields in an auto-fitting grid; Amount sits at the bottom of the card in bold; × at the top-right.
- UX-04 (MUST): Phones (≤ 700 px): header not sticky; rate chips scroll in one row; inputs 16 px font (prevents iOS zoom); numeric keypad for phone, weight and money fields; invoice preview scales to fit the screen width; dialogs and toasts full-width.
- UX-05 (MUST): No page in the app scrolls sideways at any width from 360 px to 1920 px. Wide reference tables (rate history) may scroll inside their own box only.
- UX-06 (MUST): Transactions table at 1200–1299 px hides the Taxable column to fit; all other columns stay.
- UX-07 (MUST): All confirmations, errors and messages are in-page (no browser alert boxes). Toast messages auto-hide after about 3 s.
- UX-08 (SHOULD): Keyboard shortcuts: Alt+N new item, Ctrl+S save, Ctrl+P save & print, Esc closes dialogs.

### 15.3 Key screens to design (deliverables for the designer)

1. New invoice (desktop, tablet, phone; empty, filled, error states; edit mode).
2. Invoice preview and A4 print (GST, IGST, no-GST, multi-page).
3. Transactions (desktop table, phone cards, empty state, delete confirm).
4. Dashboard pages A–F (desktop and phone).
5. Rate master with history; shop settings with validation states.
6. Desktop launcher icon and window title.

## 16. Acceptance criteria and test cases

Release R1 is accepted when every test below passes on the cloud build and the local install. Calculation tests must match to the paisa and run as automated tests in CI.

### 16.1 Calculation tests

| # | Setup | Expected |
| --- | --- | --- |
| T-01 | Worked example in 7.2 | Items total 2,58,229.46; taxable 2,56,729.46; CGST = SGST 3,850.94; exchange 60,730.80; round off +0.46; grand total 2,03,701; balance 53,701 |
| T-02 | Gold 22K 10 g @ 7,150, making ₹450/g, intra-state | 71,500 + 4,500 = 76,000; GST 2,280; total 78,280 |
| T-03 | T-02 with GST off | Total 76,000; number from BILL series; heading INVOICE; no tax rows |
| T-04 | Customer GSTIN 29…, state Karnataka, shop Maharashtra; 12 g @ 7,150 + ₹500/g | IGST auto-ticked; 91,800 + IGST 2,754 = 94,554; place of supply "Karnataka (29)" |
| T-05 | 10 g, less 0.5 g, wastage 8%, rate 7,150 | Net 9.500; chargeable 10.260; metal value 73,359.00; making ₹/g uses 9.500 g |
| T-06 | Making 15% on metal value 23,088.40 | Making 3,463.26 |
| T-07 | Exchange 3 g, touch 90, fine rate 7,800 | Fine 2.700 g; value 21,060.00; deducted after GST |
| T-08 | Exchange larger than bill | Total negative; label "Payable to customer"; W-03 if cash payout > 10,000 |
| T-09 | Received 70,000 on total 61,427 | Change to return 8,573; balance 0; paid stored 61,427 |
| T-10 | 16-item bill | Spans 2 A4 pages; no split rows; header repeats; footer "INV/… · Page 1 of 2" |
| T-11 | Total ₹5,28,639.26 before rounding | Round off −0.26; words "Rupees Five Lakh Twenty Eight Thousand Six Hundred Thirty Nine Only" |

### 16.2 Validation and behaviour tests

| # | Action | Expected |
| --- | --- | --- |
| T-20 | Type "98-765 abc 43210999" in phone | Field shows 9876543210 (10 digits) |
| T-21 | Type −12.34567 in gross weight, leave field | Minus blocked; shows 12.346 |
| T-22 | Less 20 g, gross 10 g | Less field red immediately; save blocked with E-08 |
| T-23 | Phone 98765, Save | E-01 listed; field red; focus moves to it |
| T-24 | Cash bill with received ≥ 2,00,000 | E-19 blocks; switching to UPI allows save |
| T-25 | UPI bill ≥ 2,00,000 without PAN | W-01 dialog; Save anyway saves |
| T-26 | Same customer, same total, same day, second save | W-08 duplicate warning naming the first number |
| T-27 | Settings prefix "SHREELAXMI" with FY numbering | S-09: shorten to 4 characters or less |
| T-28 | Two users save at the same instant | Two different consecutive numbers; no duplicate |
| T-29 | Edit a fully paid 3 g bill to 4 g | Same number; total 29,458; balance 0 |
| T-30 | Delete a bill, then create a new one | Deleted number not reused; gap listed in dashboard E |
| T-31 | Save rates twice in one day | One history row for that day with the latest values |
| T-32 | Change a line's rate by hand, then update the rate master | That line keeps its typed rate; other lines update |
| T-33 | Restore a backup made in the cloud into the local install | All invoices, settings, rates and history present; numbering continues correctly |
| T-34 | Resize from 360 to 1920 px on every screen | No sideways page scroll; at ≥ 1200 px the item row is one line with nothing clipped |
| T-35 | Double-click desktop icon twice | First starts server + opens window; second only opens window |

### 16.3 Dashboard tests

| # | Action | Expected |
| --- | --- | --- |
| T-40 | Seed 3 invoices (T-01, T-02, T-04) in one month | Sales = 2,03,701 + 78,280 + 94,554 = 3,76,535; invoices 3; gold net = 28.190 + 10 + 12 = 50.190 g; silver 62.300 g |
| T-41 | Click the Gold 22K bar | Transactions opens filtered to the bills containing 22K lines |
| T-42 | Edit or delete an invoice | Dashboard numbers update within 5 s |
| T-43 | Monthly GST table for FY | Sums of CGST/SGST/IGST equal the sums of the invoices; CSV matches screen |
| T-44 | Period with no invoices | Empty states shown; no errors |

## 17. Open decisions, risks and handoff

### 17.1 Decisions the owner must take before build

| ID | Question | Options | BA recommendation |
| --- | --- | --- | --- |
| D-01 | Delete or cancel issued invoices? | (a) Delete only, as in prototype; (b) Cancel with reason (bill stays, marked CANCELLED, excluded from totals); Delete only for owner on test bills | (b): keeps the GST number series unbroken |
| D-02 | Missing PAN on a ₹2 lakh+ bill: warn or block? | Warn (current) / Block unless "declaration form received" is ticked | Block with the tick box |
| D-03 | Should billing staff edit old invoices? | Today's only / any / none | Today's only |
| D-04 | Shop phone: strict 10 digits, or also landline with STD code? | Strict (current) / allow 10–12 digits | Keep strict unless a landline is needed |
| D-05 | Cloud, local install, or both? | Cloud only / Local only / Both with nightly sync | Both: local for the counter, cloud backup |
| D-06 | Dashboard pages in R2 | All A–F / A, C, E first | A, C, E first, then B, D, F |
| D-07 | Rate rounding | Rates to 2 dp (current) / whole rupees | 2 dp |
| D-08 | Credit notes and sales returns | Out of scope / add in R2 | Add in R2 if returns are common |

### 17.2 Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Floating-point rounding differs from the worked example | Wrong bills, disputes | Decimal library; T-01–T-11 automated in CI |
| Duplicate invoice numbers with two counters | GST non-compliance | Server-side row lock / sequence (NUM-04), test T-28 |
| Tax limits change | Wrong blocks or missed warnings | Limits as configuration (Section 13) reviewed yearly with CA |
| Local PC failure | Data loss | Daily local copies + optional cloud backup (DEP-03, DEP-09) |
| Dashboard slow on large data | Owner stops using it | daily\_summary table (DSH-08) |

### 17.3 Handoff checklist for the developer

- [ ] Read Sections 6–8 and implement the calculation engine first, as a pure library with unit tests T-01–T-11.
- [ ] Get owner answers to D-01–D-08 and record them in this doc.
- [ ] Confirm compliance limits (Section 13) with the shop's CA.
- [ ] Design screens listed in 15.3; review with owner on desktop and phone.
- [ ] Build R1 to parity with the prototype; run tests T-01–T-35.
- [ ] Migrate any prototype data via Full backup (JSON) → Restore (TXN-13/14).
- [ ] Build R2 dashboards and roles; run tests T-40–T-44.
- [ ] Package the Windows installer with icon (DEP-01–07); test on a clean PC.
- [ ] Owner sign-off on a printed sample of each invoice type (GST, IGST, no-GST, multi-page).

### 17.4 Assets handed over

- Working prototype (link in Section 1) — reference for look and behaviour.
- Gold-Silver-Billing.zip — prototype local install: index.html, server.py, start scripts, icon files (billing.ico, billing.icns), README.
- Sample invoice - INV-2026-27-001.pdf — verified print of the worked example.
- Gold-Silver-Billing-on-mobile.png — phone layout reference.

## 18. References

Compliance summaries in Section 13 were checked against these pages on 9 Nov 2026 (search-result level; the CA should confirm current law):

- [Lond Jewellers — PAN and cash limits when buying gold](https://londejewellers.com/guides/pan-card-cash-limit-buying-gold-india-nagpur): Rule 114B PAN above ₹2 lakh; s.269ST cash bar at ₹2 lakh; s.40A(3) ₹10,000 cash payout.
- [IIFL — PAN card for gold purchase, ₹2 lakh rule](https://www.iifl.com/node/11452): penalty under s.269ST equals the amount received; PAN or declaration form.
- [Business Standard — how much gold you can buy without PAN](https://www.business-standard.com/finance/personal-finance/how-much-gold-you-can-buy-without-pan-or-aadhaar-card-123110600254_1.html)
- [Taxscan — six-digit HUID compulsory for gold jewellery](https://www.taxscan.in/six-digit-bis-hallmark-compulsory-for-sale-of-gold-jewellery-from-april-1/258967) (context for the HUID decision).
- CGST Rules, Rule 46 (tax invoice contents, 16-character serial number): to be confirmed by the CA from the official text.
