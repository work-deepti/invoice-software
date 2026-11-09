---
version: 1
slug: "src-app-app-invoices-new-page-tsx"
primary_target: "src/app/(app)/invoices/new/page.tsx"
related_targets: ["src/app/(app)/transactions/page.tsx","src/app/(app)/dashboard/page.tsx","src/app/(app)/rates/page.tsx","src/app/(app)/settings/page.tsx"]
---

# Surface: Billing workspace (shell, New/Edit invoice, Transactions, Dashboards, Rate master, Shop settings, Preview/print)

Mode: Operate. Code-led (Operate surfaces are code-led; no image generation on this machine).

Audience & job: counter staff building a correct GST jewellery bill in under 2 minutes while the customer waits, on desktop, tablet or phone (equal priority); owner setting rates each morning, reading dashboards, reconciling the ledger.

Constraints: PRD UX-01..UX-08 (14 item columns on one row at >=1200px, cards below, no sideways scroll 360-1920px), VAL rules, INV-18 error chips, A4 print from the saved snapshot. Redesign of the whole app (owner disliked the dark-slate world). Owner choices: Figtree; Coin B logo; left sidebar on computers, floating bottom bar with centre "+" on phones; soft pastels + bold accents.

## Direction contract

THESIS: A billing counter that feels as friendly as a wallet app: soft pastel metal cards and big confident figures, with near-black pill actions doing the work. Refuses the category default of grey enterprise forms and dark chrome.

OWN-WORLD: Warm off-white canvas #F6F5F2, borderless white cards at 24px radius with a soft shadow; pastel tints carry meaning (cream = gold, mist blue = silver, lavender = focus/active, mint = paid, peach/rose = dues); bold accents only for the Coin B gold #E9A23B, silver #8296B3 and ink #1C1B22 pill buttons. Figtree 400-800, tabular figures, tight -0.02em headings.

STORY: Staff see today's rates as small metal cards, start a bill with the "+", type a phone and the customer fills in, tab across lines, watch the total settle in the floating black dock, fix any red field from its chip, save and print. The owner glances at pastel KPI cards and taps through to the bills.

FIRST VIEWPORT: Desktop: a light left sidebar (Coin B lockup, five sections with icons, today's rates as compact metal rows, user) beside the work area; the invoice page opens with a big "New invoice" title and the number, then details + customer cards and the item table, with the floating black totals dock at the bottom. Phone: compact header with logo and rate chips, cards stacked, floating black bottom bar with a white centre "+".

FORM: Brief-pinned direction (owner supplied two reference apps, chose font, logo, navigation and colour level); position 1 of 1. seed: none (brief-pinned, no roll)

Signature interaction: the floating black totals dock — the grand total rolls digit by digit (150ms), changed figures flash a soft gold once, and the dock carries black-pill actions like the reference wallet's Add / Move / Send. Motion grammar: 150-200ms expo-out on row add/remove, tab and segment switches, dialogs and toasts; nothing on page load.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
