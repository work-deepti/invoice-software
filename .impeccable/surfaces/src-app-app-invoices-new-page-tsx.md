---
version: 1
slug: "src-app-app-invoices-new-page-tsx"
primary_target: "src/app/(app)/invoices/new/page.tsx"
related_targets: ["src/app/(app)/rates/page.tsx","src/app/(app)/settings/page.tsx","src/components/invoice-document.tsx"]
---

# Surface: Billing workspace (app shell, New/Edit invoice, Rate master, Shop settings, Invoice preview/print)

Mode: Operate. Code-led (Operate surfaces are code-led; no image generation on this machine).

Audience & job: counter staff building a correct GST jewellery bill in under 2 minutes while the customer waits; owner setting rates each morning and shop settings once. Desktop, tablet and phone with equal priority.

Constraints: PRD UX-01..UX-08 (14 item columns on one row at >=1200px, cards below, no sideways scroll 360-1920px), VAL-01..07 input rules, INV-18 error chips that scroll to and focus the field, A4 print from the saved snapshot.

Owner choices (9 Nov 2026): totals live in a sticky bottom dock (full-width item table); signature moment is the live totals ticker.

## Direction contract

THESIS: The bill computes itself in front of the customer. Refuses the category default of a grey form with a totals sidebar; instead a full-width spreadsheet-grade line table over a dark slate dock where the grand total resolves digit by digit.

OWN-WORLD: Slate 50 canvas, white hairline cards (1px #E2E8F0), Slate 900 ink for the top bar, primary buttons and the totals dock; metallic amber (#B45309 / #D97706, fill #FEF3C7) only for gold metrics, active tab, focus of attention and changed figures; cool slate #475569 for silver. Geist Sans for UI, Geist Mono tabular for every number, weight, rate and input.

STORY: Staff see today's rates are current, type a phone and the customer fills in, tab across lines like a spreadsheet, watch totals settle, fix any red field from its chip, save and print. The owner trusts every figure.

FIRST VIEWPORT: Slate 900 top bar (shop name left, rate pills centre, tabs and user right). Page title "New invoice" with the number in mono. Card 1 invoice details + customer in one row at desktop. Items table begins in the first viewport. Bottom dock fixed: Au grams (amber), Ag grams (slate), balance, grand total large in mono, Save & print / Save & view / Save.

FORM: Brief-pinned direction (owner named Vercel / Apple / Stripe / Linear / Ramp / Square POS and fixed palette, type and motion); position 1 of 1. seed: none (brief-pinned, no roll)

Signature interaction: totals ticker. Digits of the grand total roll vertically into place in 150ms cubic-bezier(0.16,1,0.3,1); any summary figure that changes flashes amber once; amount in words updates live. Motion grammar: 150ms on row add/remove, tab indicator slide, dialog and toast entry; nothing on page load.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
