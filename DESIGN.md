---
name: Gold & Silver Billing
description: GST billing for Indian gold and silver jewellery — a counter tool as friendly as a wallet app, with numbers you can trust at a glance.
colors:
  canvas: "#f6f5f2"
  surface: "#ffffff"
  sunken: "#f1f0ec"
  line: "#ebe9e3"
  line-strong: "#dad7cf"
  ink: "#1c1b22"
  ink-2: "#2c2b33"
  ink-3: "#47464f"
  muted: "#6b6a73"
  faint: "#77767f"
  gold: "#e9a23b"
  gold-deep: "#94590a"
  gold-fill: "#fdecc8"
  gold-soft: "#fff6e6"
  silver: "#8296b3"
  silver-deep: "#4c5f80"
  silver-fill: "#e6edf7"
  lav: "#7b61e8"
  lav-deep: "#5b3fd0"
  lav-fill: "#eeeafd"
  mint: "#2f9e6a"
  mint-fill: "#e2f4ea"
  peach-fill: "#fdebe1"
  rose: "#e0556b"
  rose-fill: "#fce6ea"
  danger: "#d93a45"
  danger-deep: "#b4232f"
  danger-fill: "#fdecee"
  ok: "#2f9e6a"
  ok-deep: "#1d7a4e"
  ok-fill: "#e2f4ea"
  warn: "#d9861a"
  warn-fill: "#fff3df"
typography:
  display:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    letterSpacing: "-0.025em"
  headline-phone:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    letterSpacing: "-0.025em"
  figure-xl:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\""
  figure-lg:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    fontFeature: "\"tnum\""
  figure-md:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    fontFeature: "\"tnum\""
  figure-sm:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    fontFeature: "\"tnum\""
  section:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
  title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  body-lg:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
  body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
  label:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  caption:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
  micro:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
  tag:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
  print-body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 400
  print-small:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 400
rounded:
  control: "12px"
  tile: "16px"
  panel: "20px"
  card: "24px"
  sheet: "28px"
  pill: "9999px"
spacing:
  gutter-phone: "12px"
  gutter: "24px"
  card-pad: "20px"
  card-pad-wide: "24px"
  stack: "16px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "40px"
  input:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
  input-focus:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.lav}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
  pastel-tile:
    backgroundColor: "{colors.gold-fill}"
    rounded: "{rounded.card}"
  hero-tile:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
    rounded: "{rounded.card}"
  totals-dock:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
    rounded: "{rounded.card}"
  bottom-bar:
    backgroundColor: "{colors.ink}"
    rounded: "{rounded.pill}"
---

# Design System: Gold & Silver Billing

North star: **"The friendly counter."** Billing a customer should feel as light as checking a wallet app, while every figure stays exact.

## Overview

The redesign (9 Nov 2026) takes its cues from two consumer apps the owner chose: a finance wallet (white canvas, big balance figures, solid colour category cards, black pill actions, a floating black bottom bar with a centre "+") and a health tracker (soft peach, lavender and mint cards, large numbers, generous corners, segmented Days/Weeks tabs). It is lighter than both: a warm off-white canvas, borderless white cards, pastel tints for meaning, and only a few bold accents.

Three layers do all the work:

1. **Canvas and cards.** Warm off-white page, white cards with 24 px corners and a soft lift. No borders around cards.
2. **Pastel meaning.** Each tint has one job (see Colors). A pastel card is a summary you can read from across the counter.
3. **Ink for decisions.** Near-black is reserved for the one primary action, the hero figure, the totals dock and the phone bottom bar.

## Colors

### Neutrals
- **Canvas `#f6f5f2`** — the page. Warm, never pure grey.
- **Surface `#ffffff`** — cards, dialogs, sidebar.
- **Sunken `#f1f0ec`** — inputs, secondary pills, empty states, segmented-control tracks.
- **Line `#ebe9e3` / line-strong `#dad7cf`** — table rules only. Cards have no border.
- **Ink `#1c1b22`** through **faint `#77767f`** — text ramp. Faint is the lightest that still passes 4.5:1 on white (placeholders).

### Meaning tints (fill + deep text colour)
| Tint | Fill | Text / icon | Means |
| --- | --- | --- | --- |
| Gold | `#fdecc8` | `#94590a` | Gold metal, rates, the summary card, totals |
| Silver | `#e6edf7` | `#4c5f80` | Silver metal, old-metal exchange |
| Lavender | `#eeeafd` | `#5b3fd0` | Focus, active navigation, invoice details, counts |
| Mint | `#e2f4ea` | `#1d7a4e` | Paid, GST collected, good change |
| Peach | `#fdebe1` | `#a64b1e` | People (customer, business), making charges, old metal taken |
| Rose | `#fce6ea` | `#b4232f` | Money still owed, compliance limits |

### Bold accents
- **Gold `#e9a23b`** and **silver `#8296b3`** — the two coins of the logo; dots, avatars and the logo only (they are too light for text).
- **Lavender `#7b61e8`** — focus ring and filter counts.
- **Danger `#d93a45`** — errors only.

### Charts
Categorical series keep the previously validated palette (gold `#c2700a`, silver `#3d6fb0`, then `#12a37a`, `#8a5cc7`, `#d0527a`, `#5f8f1f`, `#1b7fb8`) so metal colours stay distinct for colour-blind users. Chart chrome (grid `#efede8`, axis `#8d8b94`, previous period `#a3a1ab`) follows the warm neutrals. The heatmap is a single lavender ramp.

### Named rules
- One meaning per tint. Never use a pastel for decoration alone.
- Gold-coloured text uses gold-deep; never put `#e9a23b` text on white.
- Red is only for things the user must fix or money owed.

## Typography

**Figtree** for everything (UI and numbers), self-hosted from `src/fonts/figtree/` (SIL OFL). It has the ₹ sign and tabular figures; every number uses the `num` utility (`font-variant-numeric: tabular-nums`) so decimals align. The PDF uses a copy with tabular figures frozen in (`FigtreeTab`).

### Hierarchy
- **Headline** 30 px / 800 (26 px on phones) — page titles.
- **Figures** 20–30 px / 800 — hero totals, KPI values, grand total.
- **Title** 16 px / 700 — card titles.
- **Body** 14 px; **label** 13 px / 600; **caption** 12.5 px; **tag** 11.5 px / 600.
- Print and PDF use 9–11 px.

### Named rules
- No serif, no second family.
- Weights: 400 body, 600 labels, 700 titles, 800 headlines and figures.
- Inputs are 16 px on phones (no iOS zoom).

## Layout
- **Computers (≥ 1024 px):** fixed white sidebar. A 76 px icon rail from 1024 px, full 264 px with labels and today's rates from 1440 px. Content max 1456 px, 24–32 px gutters.
- **Phones and tablets:** a header with the logo, shop name and scrolling rate chips; a floating ink bottom bar with a white centre "+" for New invoice. On the invoice screen the bottom bar gives way to the totals dock and the header shows a back button.
- **UX-01/02:** no sideways page scroll from 360 to 1920 px. **UX-03:** the 14-column item row stays on one line at ≥ 1200 px, even with the icon rail (checked).
- Breakpoints: `tab` 700 px, `lg` 1024 px, `desk` 1200 px, `wide` 1440 px.

## Elevation & Depth
- **hair** — small controls on white (outline buttons, chips).
- **card** — every card.
- **pop** — menus, toasts' surroundings, error tray.
- **dock** — ink surfaces that float: totals dock, bottom bar, hero tile, save bar.

## Shapes
Controls 12 px, inner tiles 16–18 px, cards 24 px, sheets 28 px, buttons and chips fully round (pills). Avatars and icon chips are circles.

## Components

### Buttons
Pills. **Primary** ink with white text (one per view). **Secondary** sunken grey. **Outline** white with hair shadow. **Ghost** text only. **Danger** red. **Dock** translucent white on ink. Sizes 32 / 40 / 48 px.

### Cards
White, 24 px, no border. Header: a round pastel **icon chip** (36 px) + 16 px bold title + muted description. Body padding 20 px (24 px from 700 px).

### Inputs
44 px tall, sunken fill, no border. On focus: white fill, lavender border and a soft lavender ring. Numbers right-aligned with tabular figures. Errors: red border, message under the field.

### Totals dock (signature)
A floating ink bar, 24 px corners, aligned to the content column. Gold and silver grams on the left, the rolling grand total in 26 px extrabold, and white "Save" pill on the right. Errors collect in a white tray above it as rose chips that jump to the field.

### Wallet tiles (ledger and dashboards)
An **ink hero tile** for the headline money figure (Total billed / Sales), then **pastel tiles** for the rest (gold sold, silver sold, old metal, dues; invoices, GST, making). Big 22–30 px extrabold figure, coloured label, change chip.

### Coin avatars
40 px circles in the ledger: a gold coin, a silver coin, or both overlapping, so the metal on a bill is visible at a glance. They echo the logo.

### Tabs
- **Segmented control** (period, ₹/grams): sunken track, the active option a white pill.
- **Page tabs** (dashboard pages): pills, the active one ink.

### Logo
**Coin B**: an ink stem with a gold coin and a silver coin as the bowls of a B. Masters in `design/logo/`; React component `src/components/shell/logo.tsx`. Favicon, app icons and manifest are generated from the same geometry.

### Print and PDF
The printed invoice stays neutral and black-and-white friendly: Figtree, hairline rules, one gold rule under the header, an ink grand-total row.

## Do's and Don'ts

### Do
- Lead with the number: big, bold, tabular.
- Use one pastel per meaning and keep cards borderless.
- Keep one ink primary action per view.
- Write labels in plain words ("Old metal taken", "Balance due").

### Don't
- No borders around cards, no nested cards.
- No serif fonts, neon purple-blue gradients, 3D blobs or glowing dark mode.
- No gold-coloured body text on white.
- No sample data in empty states.
