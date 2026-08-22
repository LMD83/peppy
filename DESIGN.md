---
name: Timento
description: Performance file UI in the Peppy palette — calm green-tinted paper, ink stamps, scheme-aware light/dark
colors:
  paper: "#f6f7f2"
  panel: "#ffffff"
  ink: "#18201d"
  ink-2: "#232b27"
  ink-3: "#2b342f"
  ink-rule: "#3a453f"
  dim: "#4e5b55"
  dim-2: "#52605a"
  on-ink: "#aebbb3"
  rule: "#c6d0c9"
  rule-strong: "#6f7e76"
  grid: "#e9ece5"
  soft: "#edefe9"
  blue: "#2b5fab"
  blue-faint: "#e9eff8"
  red: "#9f2f35"
  red-bg: "#f9ecea"
  green: "#275d50"
  green-mid: "#9cc7b4"
  green-faint: "#e7f2ed"
  yellow: "#846005"
  amber: "#855316"
  amber-bg: "#faf1de"
  amber-ink: "#6b5a2e"
  amber-lift: "#ffd18a"
  purple: "#7e5191"
  focus: "#3e8e6c"
  board: "#18201d"
  stamp: "#18201d"
  on-stamp: "#ffffff"
typography:
  display:
    fontFamily: "Archivo Black, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "normal"
  title:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  rowTitle:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.35
  shelfRow:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.3
  statNumeral:
    fontFamily: "Archivo Black, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.1
  easyBody:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
  printBody:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
  printAisle:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.3
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.15em"
rounded:
  sm: "6px"
  md: "14px"
  lg: "18px"
  pill: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.on-stamp}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.red}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "44px"
  button-soft:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "44px"
  chip-default:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
    height: "44px"
  chip-active:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.on-stamp}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
    height: "44px"
  card-default:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  card-amber:
    backgroundColor: "{colors.amber-bg}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: Timento × Peppy

## Overview

**Creative North Star: "The Performance File, on calm paper"**

Timento still looks like a paper case file you open every day — but the stock
is now Peppy's (`design-system/peppy/MASTER.md`): a green-tinted warm off-white
instead of cool grey, deep sea-green ink accents instead of neutral greys, and
softer 14px corners. Density is unchanged: stacked cards in a narrow column,
mono uppercase stamps, high signal. Mode is still the only drama — cut/maintain
stay green-ink quiet; survival turns amber without becoming neon.

The system rejects wellness cream-serif kitsch, purple SaaS gradients, and
glow-heavy dark dashboards. Evidence over pep talk: eyebrows with a short color
hash mark, scoreboard cells as file tabs, sheets as clipped overlays rather
than glassmorphism.

**Key Characteristics:**
- Peppy paper / panel / ink neutrals (green-tinted) with visible rules
- Archivo Black display + IBM Plex Sans body + IBM Plex Mono labels
- Peppy Primary green (execute) vs deepened Peppy Attention amber (floor)
- Two colour schemes from one utility set — dark follows the OS, light-first
- Flat surfaces; one soft card shadow; deeper lift only on sheets
- Mobile-first `max-w-md` column; fixed bottom nav (More is overflow)

## Colors

The Peppy palette holds the same semantic roles the file always had. Values
below are the light scheme; the dark scheme re-points every token in
`src/app/globals.css`, and `tests/a11y-tokens.test.ts` recomputes every pairing
for BOTH schemes — take new colors from `globals.css`, never from memory.

### Fill roles (scheme-critical)
- **Board** (#18201d light / #0f1318 dark): the scoreboard/login header ground.
  Dark in both schemes — its white title and on-ink text never flip.
- **Stamp / On-stamp** (#18201d + #ffffff light; mint #8fcdbb + deep green
  dark): every filled primary control. Never hardcode `text-white` on a fill —
  use the paired on-token (`tm-onstamp`, `tm-ongreen`, `tm-onamber`,
  `tm-onred`, `tm-onblue`), or the fill breaks when the scheme flips it light.

### Primary
- **Peppy Ink** (#18201d): body text; 15.44:1 on paper.
- **Peppy Page / Surface** (#f6f7f2 / #ffffff): canvas and cards.

### Secondary
- **Peppy Primary green** (#275d50): executed progress, done checks, adherence.
  On-green on it 7.59:1. **Support** (#e7f2ed) is its faint stock.
- **Floor amber** (#855316, Peppy Attention deepened one notch) on **Amber
  Stock** (#faf1de): survival mode, tripwires, review prompts. On-amber on it
  6.47:1 — within 1.5 of green's ratio, the survival-parity invariant the
  token test enforces. **Amber Ink** (#6b5a2e) for copy on amber stock.
  **Amber Lift** (#ffd18a) is amber on the board only, both schemes.

### Tertiary
- **Measure Blue** (#2b5fab): weigh-in / state-check eyebrows.
- **Peppy Danger** (#9f2f35): craving, kitchen, destructive, errors.
- **Evidence Yellow** (#846005): research / experiment eyebrows.
- **Marker Purple** (#7e5191): reserved accent; use sparingly.

### Neutral
- **Peppy Muted ink** (#4e5b55 / #52605a): secondary text — 6.61:1 on paper.
- **Rule / Rule Strong** (#c6d0c9 / #6f7e76): decorative card edges vs 3:1
  control boundaries (rule-strong is 4.27:1 on panel).
- **On Ink** (#aebbb3): muted text on the board, both schemes.
- **Focus** (#3e8e6c light / #6fd0a8 dark): Peppy-green ring, ≥3:1 on page and
  board alike.
- **Contrast-more overrides** (#333d38 / #dce3df / #f2e3bd / #93a098): under
  `prefers-contrast: more`, muted text collapses toward ink on paper (10.46:1),
  board text lifts (12.74:1), and its dark-scheme block does the same the other
  way. These exist only inside those media queries.

### Named Rules
**The One Stamp Rule.** Saturated accents (green, amber, red, blue) mark state
— never decorate empty chrome. Prefer ink + paper first.

**The Floor Amber Rule.** Amber means survival / tripwire / review. Do not use
amber as a generic "warning yellow" for unrelated UI.

**The On-Token Rule.** Text on a filled control comes from that fill's on-token,
never `text-white` — the dark scheme flips fills light.

## Typography

Unchanged by the Peppy pass — the ramp was already the accessibility floor.

**Display Font:** Archivo Black (sans) · **Body Font:** IBM Plex Sans ·
**Label/Mono Font:** IBM Plex Mono

### Hierarchy — the whole ramp, no other sizes
Exactly six pinned steps plus the display scale; anything off this list is
drift (`tests/a11y-floor-guard.test.ts` fails the build if a sub-11.5px size
returns).

- **Label — 11.5px** (mono, 400/500, tracking 0.1–0.15em, uppercase): eyebrows,
  buttons, nav, chips, badges. Easy mode lifts it to 16px.
- **Caption — 13px** (sans 400). Easy mode lifts to 16px.
- **Body — 14px** (sans 400; 600 for card titles). Easy mode lifts to 18px.
- **Row title — 15px** (sans 500). Easy mode lifts to 18px.
- **Shelf row — 17px** (sans 500). Easy mode lifts to 18px.
- **Display** (Archivo Black 400, tight): Tailwind named steps for headings;
  pinned numerals at 22 / 32 / 34 / 40px.
- **Print exception:** the print-only shopping list runs 16–24px.
- **SVG:** chart text must come from `axisFontSize(viewBoxWidth)`.

### Named Rules
**The Mono Stamp Rule.** Interactive chrome and section labels speak in mono
uppercase. Do not title-case primary buttons in sans.

## Layout

Mobile-first single column capped at `max-w-md` (`lg:max-w-3xl`), horizontal
padding ~16px, vertical rhythm of 12px between cards (`gap-3`). Scoreboard is a
full-bleed board header; content sits on paper. Bottom chrome is a single tab
bar; page padding-bottom is **84px**. Desktop keeps the same narrow column
centered. Easy mode (`[data-easy="1"]`) raises the root to 18px and targets to
48px — easy mode IS the Peppy 18px/48px experience contract, applied when the
person chooses it.

## Color Schemes

One utility set, two schemes. `@theme inline` maps every `tm-*` utility onto a
`var(--tm-*)`; the light values live on `:root` and a single
`prefers-color-scheme: dark` block re-points all of them (Peppy MASTER.md dark
column). Light-first: dark is never the only comfortable theme. Rules:

- The dark block re-declares EVERY token — the token test fails on a subset.
- Board, amber-lift, on-ink and scrim hold one value across schemes.
- `prefers-contrast: more` has a dark counterpart block; keep both when adding
  overrides.

## Elevation & Depth

Flat-by-default file surfaces. Depth comes from paper vs panel contrast and
hairline rules, not stacked shadows.

### Shadow Vocabulary
- **Card rest** (`0 1px 2px rgba(24,32,29,0.04)`): default cards.
- **Sheet lift** (`0 8px 32px rgba(24,32,29,0.18)`): modal sheets only.
- **Scrim** (`tm-scrim` at 40%): sheet backdrop, near-black in both schemes.

### Named Rules
**The Flat-By-Default Rule.** No glow, no multi-layer glass.

## Shapes

Peppy's softer corners on a four-step ramp — **6 / 14 / 18 / 20px**: small
controls at 6px, cards, buttons, inputs and check rows at **14px** (the Peppy
"cards and actions" radius), sheets and status pills at **18px**, chips/mode
pills at 20–22px, `rounded-full` for dots and true pills. Eyebrow hash marks
stay nearly square (1px). Borders are 1px `rule` or semantic color — no thick
outlines.

## Components

### Buttons (`TmButton`)
- **Shape:** 14px radius; min height 44px; mono uppercase 11.5px / 0.15em.
- **Primary:** Stamp fill, on-stamp text. **Ghost:** panel + rule border.
- **Danger:** Peppy Danger fill. **Soft:** soft fill.
- **Press:** 150ms transform/opacity; disabled at 40%.

### Chips (`TmChip`)
- Pill (20px), soft fill + rule border; green tone for crew nudges.
- **Active:** stamp (or green) fill with its on-token text; `aria-pressed`.

### Cards (`Card`)
- 14px corners; panel + rule border + whisper shadow; padding 16px.
- **Amber tone:** amber stock + amber border for tripwire / survival / review.

### Eyebrow
Mono uppercase dim label with an 18×4px color hash bar.

### Inputs
Panel background, 14px radius, **rule-strong** border (3:1); focus border
shifts to ink.

### Navigation
Fixed bottom tab bar on panel with top rule; mono label; 3px mode-accent pill
when active. Four stamps: Today / Protocol / Crew / More. Labels nowrap at
320px. A "Skip to content" link precedes the scoreboard.

### Scoreboard (signature)
Board header (`tm-board`, dark in both schemes) with white display title, mono
kicker, mode disclosure, and a three-cell interior board on ink2/ink3.

### Sheets (`TmSheet`)
Bottom sheet on mobile, centered on larger viewports; 18px radius; title in
mono; dismissible scrim (`tm-scrim/40`). Keyboard: focus Close on open, Tab
cycles inside, Escape closes, focus returns to the opener.

## Do's and Don'ts

### Do:
- **Do** keep the narrow performance-file column and paper/ink pairing.
- **Do** use mono uppercase for chrome (buttons, nav, eyebrows).
- **Do** reserve amber for survival / tripwire / review; green for executed
  progress.
- **Do** pair every fill with its on-token; test in both schemes.
- **Do** keep primary controls ≥44px tall (48px in easy mode).
- **Do** share crew projection only — never style partner weights into the UI.
- **Do** take new colors from `globals.css` tokens, not from this file's
  memory of an older palette.

### Don't:
- **Don't** introduce purple gradients, glassmorphism, or neon dark themes.
- **Don't** replace Archivo / IBM Plex with Inter/Roboto "default SaaS" stacks.
- **Don't** add a fifth bottom-nav stamp; Protocol and More are shelves.
- **Don't** hardcode `text-white` on a token fill — the dark scheme flips it.
- **Don't** decorate with emoji or sticker badges on the scoreboard.
- **Don't** invent macro-tracking chrome that violates survival's three-check
  floor.
- **Don't** restore pre-AA hex (`#c77d1f`, `#2e7d4f`, `#c7373f`, `#70747b`,
  `#9ba0a8`, `#b8860b`) — the token test bans them in either scheme.
