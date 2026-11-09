---
name: Gold & Silver Billing
description: GST billing for Indian gold and silver jewellery — a precise, calm counter tool where the numbers lead.
colors:
  canvas: "#f8fafc"
  surface: "#ffffff"
  sunken: "#f1f5f9"
  line: "#e2e8f0"
  line-strong: "#cbd5e1"
  ink: "#0f172a"
  ink-2: "#1e293b"
  ink-3: "#334155"
  muted: "#64748b"
  faint: "#94a3b8"
  gold: "#d97706"
  gold-deep: "#b45309"
  gold-fill: "#fef3c7"
  gold-soft: "#fffbeb"
  silver: "#475569"
  silver-fill: "#f1f5f9"
  danger: "#dc2626"
  danger-deep: "#b91c1c"
  danger-fill: "#fef2f2"
  ok: "#16a34a"
  ok-deep: "#15803d"
  ok-fill: "#f0fdf4"
typography:
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
  caption:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 500
  metric:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "17px"
    fontWeight: 600
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\", \"zero\""
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "14px"
    fontWeight: 400
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\", \"zero\""
  total:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\", \"zero\""
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.ink-2}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  button-secondary-hover:
    backgroundColor: "{colors.canvas}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  input-error:
    backgroundColor: "{colors.danger-fill}"
    textColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  rate-pill:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  totals-dock:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "12px 20px"
  error-chip:
    backgroundColor: "{colors.danger-fill}"
    textColor: "{colors.danger-deep}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
---

# Design System: Gold & Silver Billing

## Overview

**Creative North Star: "The Trading Desk"**

Numbers are the interface. Every weight, rate and rupee sits in tabular mono figures so decimals line up down a column like an institutional trading screen, while everything around them stays quiet: a cool slate canvas, white hairline cards, and one dark slate frame (the top bar above, the totals dock below) that holds the work between them. The tool should disappear into the bill being made at the counter.

Colour does jobs, never decoration. Metallic amber means gold — gold grams, gold rates, the active tab, a figure that just changed — and appears nowhere else. Cool slate means silver. Red means a problem the user must fix. The rest is neutral, so a single amber flash or red field is impossible to miss.

Density is spreadsheet-grade on wide screens (all fourteen item columns on one row at 1200 px and above) and relaxes into labelled, hairline-divided sections on tablets and phones. Motion is fast and functional: 150 ms with an exponential ease-out, only where state changes.

**Key Characteristics:**
- Tabular mono figures for every number, input value and total; sans for every word.
- A dark slate frame: top bar with live rate pills, bottom dock with the rolling grand total.
- Amber reserved for gold and for attention; slate for silver; red only for errors and dues.
- Hairline borders with a whisper of shadow; no gradients, glass or glow.
- 150 ms `cubic-bezier(0.16, 1, 0.3, 1)` on state changes only; nothing animates on page load.

## Colors

A restrained slate system with one metallic accent that always means gold.

### Primary
- **Counter Slate** (ink): the top bar, the totals dock, primary buttons, checked controls and all body text. The frame and the voice of the app.

### Secondary
- **Hallmark Amber** (gold): gold metrics in the dock and rate pills, the active-tab underline, the amber flash on a changed figure, the caret. Its deeper tone (gold-deep) is for amber text on light grounds, such as gold rates in the rate master and the "typed by hand" rate marker; its fills (gold-fill, gold-soft) tint the flash and today's row in rate history.

### Tertiary
- **Assay Silver** (silver): silver metrics and silver rate dots; its fill matches the sunken neutral.

### Neutral
- **Morning Slate** (canvas): the page ground behind every card.
- **Paper White** (surface): cards, inputs, dialogs, the printed invoice.
- **Recess** (sunken): read-only computed cells (net weight, fine weight), table header strips, skeletons.
- **Hairline** (line) and **Firm Hairline** (line-strong): card and row borders; line-strong on hover and in printed table rules.
- **Graphite** (ink-3), **Pewter** (muted), **Mist** (faint): secondary text, labels and hints, placeholders and empty-value dashes.

### Semantic
- **Signal Red** (danger, danger-deep, danger-fill): invalid fields, error chips, balance due, destructive actions.
- **Settled Green** (ok, ok-deep, ok-fill): success toasts, "Change to return", rates moving up in history.

### Charts
A separate categorical order for data, validated for colour-blind separation and contrast on light and dark surfaces (adjacent pairs): **chart gold** `#c2700a` and **chart steel** `#3d6fb0` carry gold and silver identity only; non-metal categories take, in fixed order, teal `#12a37a`, violet `#8a5cc7`, rose `#d0527a`, olive `#5f8f1f`, blue `#1b7fb8`. Single-series charts that are neither metal use Graphite (`#334155`); the previous period is a dashed Mist line. Magnitude (the hours heatmap) uses one slate-blue ramp from Recess to `#2f5d99`. Dues and risk use Signal Red tints only.

### Named Rules
**The Gold Means Gold Rule.** Amber marks gold metal, the active place, or a value that just changed. Never use it for decoration, a generic call to action, or silver.

**The Red Is a Task Rule.** Red appears only when the user has something to fix or someone owes money. A red element that has no action behind it is a bug.

## Typography

**Body Font:** Geist (with ui-sans-serif, system-ui)
**Data Font:** Geist Mono (with ui-monospace), tabular figures and slashed zero

**Character:** One workhorse sans for every word and one mono for every number. The pairing reads like a well-set financial statement: calm labels, figures that align to the paisa.

### Hierarchy
- **Headline** (600, 22px, −0.02em): page titles ("New invoice", "Rate master").
- **Title** (600, 15px, −0.02em): card titles.
- **Body** (400, 14px, 1.5): field text, dialog copy, descriptions at 13–13.5px in muted.
- **Label** (500, 12.5px): field labels, column headers (11.5px muted in tables).
- **Caption** (500, 11.5px): table column headers, small tags ("No GST", "Cancelled"), chart axis ticks.
- **Metric** (600 mono, 17px, −0.02em): ledger summary tiles and dashboard rate tiles.
- **Data** (400–600 mono, 13–14px, tabular): every input value, weight, rate, amount, invoice number and date.
- **Total** (600 mono, 20–26px, −0.02em, line-height 1): the grand total in the dock and summary, rendered by the rolling ticker.

### Named Rules
**The Mono Is Data Rule.** Geist Mono sets numbers, codes (GSTIN, PAN, HSN, invoice numbers) and number placeholders (`0.000`, `Full: ₹…`). Words, labels and word placeholders ("Optional", "Cash customer") stay in Geist. Mono is never a "technical" costume.

**The Indian Figures Rule.** Money prints in Indian grouping with the rupee sign (₹2,03,701.00), weights always with three decimals (25.450 g), dates as DD-MM-YYYY on every screen, whatever the browser's locale.

## Layout

A centred work column up to 1680 px with 24 px side gutters (12 px on phones). Pages stack full-width cards with 16 px gaps; paired cards split 1 : 2.1 (invoice details and customer) or fluid : 440 px (notes and summary) from 1024 px.

The item table is the system's density anchor. At 1200 px and above it is one row per line on a fixed fractional column plan (#, description, purity, HSN, pcs, gross, less, net, wastage, rate, making, stone, amount, remove) with 4 px column gaps and 32 px controls. Below 1200 px each line becomes a labelled section in a 2-, 4- or 6-column grid, divided from its neighbours by a hairline, with the amount on its own bottom row. Exchange rows and rate rows follow the same pattern.

On phones (700 px and below) the top bar scrolls away instead of sticking, inputs are 16 px so iOS never zooms, and rate pills and tabs scroll inside their own strip. No page ever scrolls sideways between 360 and 1920 px; wide reference tables (rate history) scroll inside their own bordered box.

The totals dock is fixed to the bottom on every screen, so the page reserves bottom padding for it.

## Elevation & Depth

Depth is a hairline first and a whisper of shadow second. Cards carry a 1 px line border plus the hair shadow, which keeps them crisp on the slate canvas. Real lift is reserved for things that float above the work.

### Shadow Vocabulary
- **Hair** (`box-shadow: 0 1px 2px rgba(15,23,42,0.04)`): cards, secondary buttons, outline links.
- **Pop** (`box-shadow: 0 12px 32px -8px rgba(15,23,42,0.18), 0 2px 6px rgba(15,23,42,0.06)`): dialogs, dropdowns, the phone-recall list, toasts, the error-chip panel.
- **Dock** (`box-shadow: 0 -8px 24px -12px rgba(15,23,42,0.35)`): the totals dock and settings save bar, lifting off the page bottom.

### Named Rules
**The Float Earns Shadow Rule.** Only overlays and the dock get more than the hair shadow. A card that sits in the page never lifts.

## Shapes

Gently rounded and consistent: 6px for compact table controls and icon buttons, 8px for inputs and buttons, 12px for cards, 16px for the dock and dialogs (dialogs take a 16 px top radius as a bottom sheet on phones), full pills only for rate pills and status tags. Checkboxes are 5 px squares; switches are pills. The brand mark is a flat amber tile with an ink square inside.

## Components

### Buttons
- **Shape:** gently rounded (8px); compact 32 px in toolbars and tables, 36 px default, 44 px on sign-in.
- **Primary:** Counter Slate fill, white text, a faint inner top highlight; hover deepens to ink-2.
- **Secondary:** Paper White with a hairline border and hair shadow; hover firms the border and tints to canvas.
- **Ghost:** text only; hover fills with Recess.
- **On the dock:** translucent white (10%) with a white 10% border; the main save action is solid white with ink text.
- **Press:** every button nudges down 1 px on press; loading swaps in a spinner and blocks repeat clicks.

### Rate pills (top bar)
- **Style:** pill outline on the dark bar, a 6 px metal dot (amber for gold, slate for silver), short purity name in white 60% and the rate in mono.
- **State:** stale rates dim the pills and lead with an amber "Rates from DD-MM-YYYY — update" pill; no rates shows a solid amber "Set today's rates →" pill.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Paper White on Morning Slate.
- **Shadow Strategy:** Hair (see Elevation).
- **Border:** 1 px Hairline.
- **Internal Padding:** 16 px (20 px from 700 px), title row on top.

### Inputs / Fields
- **Style:** 36 px (32 px in the one-row table), 8px radius, 1 px Hairline, Paper White; numbers right-aligned in mono.
- **Focus:** border turns Counter Slate with a 2 px slate ring at 10%; the caret is amber.
- **Error:** Signal Red border on a faint red fill, message under the field (a tooltip in the one-row table).
- **Number fields:** text inputs with a decimal keypad, no spin arrows, wheel-proof; "-", "+", "e" blocked; rounded on leaving (weights 3 dp, money and % 2 dp).
- **Date:** a mono DD-MM-YYYY field with a calendar button that opens the native picker.

### Navigation
- **Style:** tabs on the dark top bar, 13.5px medium; inactive white 55%, hover 85%, active white with a 2 px amber underline that slides between tabs in 150 ms. On phones the tab strip scrolls horizontally inside the bar.

### KPI tiles & chart cards (dashboards, ledger)
- **KPI tile:** muted label, mono value with ₹ L / Cr compaction (exact amount on hover), and a delta chip vs the previous equal period (green when the move is good, red when bad — falling dues are good). Tiles sit in a hairline grid, 4 per row on desktop and 2 on phones.
- **Chart card:** a Paper White card with title and one-line subtitle, a Table toggle and Download CSV top right, legend chips under the title for 2+ series, and a dashed empty state ("No sales in this period"). Every mark is clickable and opens Transactions filtered to exactly those bills.
- **Marks:** 2 px lines, bars at most 24 px thick with 4 px rounded data ends, 2 px white gaps between stacked segments, hairline solid gridlines, mono axis ticks.

### Totals Dock (signature)
- A fixed Counter Slate bar, 16px radius, floating above the page bottom. Left: gold grams in amber, silver grams in slate, balance due in light red when present. Right: the grand total in mono, rolling digit by digit (each digit a vertical strip that slides to its value in 150 ms), then Save & view, Save & print and Save. On phones the secondary saves fold into a menu beside Save.
- Every summary figure that changes flashes the gold fill once (650 ms fade). The amount in words updates with the total.
- When a save fails, an error panel opens above the dock with one red chip per problem; each chip scrolls to and focuses its field.

## Do's and Don'ts

### Do:
- **Do** set every number, weight, rate, total, code and number placeholder in Geist Mono with tabular figures.
- **Do** keep amber for gold, the active place, and changed values (The Gold Means Gold Rule).
- **Do** show money as ₹ with Indian grouping, weights to 3 decimals, and dates as DD-MM-YYYY.
- **Do** keep the item table on one row at 1200 px and above, and switch rows to hairline-divided labelled sections below.
- **Do** use 150 ms `cubic-bezier(0.16, 1, 0.3, 1)` for state changes, and honour reduced motion.
- **Do** keep messages in-page: inline field errors, chips above the dock, one dialog for all warnings, toasts that leave after about 3 s.

### Don't:
- **Don't** use serif fonts, beige or paper-toned backgrounds, neon purple-blue gradients, 3D blobs, or glowing dark-mode effects (owner's brief).
- **Don't** fake metal with gradients or bevels; gold is a flat amber token.
- **Don't** nest cards inside cards; divide rows inside a card with hairlines.
- **Don't** let any page scroll sideways between 360 and 1920 px.
- **Don't** animate on page load or for decoration; motion only reports a change of state.
- **Don't** use browser alert boxes.
