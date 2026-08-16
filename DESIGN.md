---
name: Timento
description: Performance file UI — paper, ink, mono stamps, mode-aware amber/green
colors:
  paper: "#fafaf8"
  panel: "#ffffff"
  ink: "#15171c"
  ink-2: "#1e222a"
  ink-3: "#232730"
  ink-rule: "#2c313b"
  dim: "#5f636a"
  dim-2: "#63676e"
  on-ink: "#a2a7af"
  rule: "#e4e5e1"
  rule-strong: "#888b85"
  grid: "#eeefeb"
  soft: "#f3f3f0"
  blue: "#2b5fab"
  blue-faint: "#e9eff8"
  red: "#b8323a"
  red-bg: "#faeceb"
  green: "#297047"
  green-mid: "#9cc4a9"
  green-faint: "#dfeae2"
  yellow: "#8a6407"
  amber: "#8f5a15"
  amber-bg: "#fbf3e4"
  amber-ink: "#6b5a2e"
  amber-lift: "#e0a34e"
  purple: "#7e5191"
  focus: "#3b82f6"
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
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.15em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
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
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
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

# Design System: Timento

## Overview

**Creative North Star: "The Performance File"**

Timento looks like a paper case file you open every day — cool off-white stock, near-black ink headers, mono uppercase stamps for sections and controls. Density is high but calm: stacked cards in a narrow column, not a dashboard wallpaper. Mode is the only drama — cut/maintain stay green-ink quiet; survival turns amber without becoming neon.

The system rejects wellness cream-serif kitsch, purple SaaS gradients, and glow-heavy dark dashboards. Evidence over pep talk: eyebrows with a short color hash mark, scoreboard cells as file tabs, sheets as clipped overlays rather than glassmorphism.

**Key Characteristics:**
- Paper / panel / ink neutrals with hairline rules
- Archivo Black display + IBM Plex Sans body + IBM Plex Mono labels
- Mode-aware green (execute) vs amber (floor)
- Flat surfaces; one soft card shadow; deeper lift only on sheets
- Mobile-first `max-w-md` column; fixed bottom nav (More is overflow)

## Colors

A cool paper stack with ink text, semantic greens/ambers for protocol state, and restrained blues/reds for measure and alarm. Values below are the AA-retuned tokens in `src/app/globals.css` — do not restore the pre-retune hex.

### Primary
- **File Ink** (#15171c): Primary actions, scoreboard chrome, selected chips, strong text. The voice of the stamp.
- **Cool Paper** (#fafaf8): App canvas / page ground.
- **Panel White** (#ffffff): Cards, sheets, bottom chrome.

### Secondary
- **Protocol Green** (#297047): Cut-mode accents, done checks, positive chips, adherence. White on it 5.99:1.
- **Floor Amber** (#8f5a15) on **Amber Stock** (#fbf3e4): Survival mode, tripwires, review prompts. White on amber 5.77:1; amber on stock 5.23:1. **Amber Ink** (#6b5a2e) for readable copy on amber stock. **Amber Lift** (#e0a34e) is amber on the dark header only.

### Tertiary
- **Measure Blue** (#2b5fab): Weigh-in / state-check eyebrows, informational accents. **Blue Faint** (#e9eff8) for the maintain badge fill.
- **Alarm Red** (#b8323a): Craving, kitchen, destructive (sign out), errors. **Red Bg** (#faeceb) for error panels.
- **Evidence Yellow** (#8a6407): Research / experiment eyebrows.
- **Marker Purple** (#7e5191): Reserved accent; use sparingly.

### Neutral
- **Ink 2 / 3 / Rule** (#1e222a / #232730 / #2c313b): Scoreboard interior layers and dark borders.
- **Dim / Dim 2** (#5f636a / #63676e): Secondary labels on light surfaces (both clear 4.5:1 on paper/panel/soft/grid/amber-bg/green-faint).
- **On Ink** (#a2a7af): Muted text on the dark scoreboard and login header.
- **Rule / Rule Strong / Grid / Soft** (#e4e5e1 / #888b85 / #eeefeb / #f3f3f0): Decorative card edges vs 3:1 control boundaries, list dividers, quiet fills.
- **Focus** (#3b82f6): 3:1 ring on paper and on ink.
- **Contrast-more overrides** (#3a3d43 / #d9dde3): Under `prefers-contrast: more`, muted text collapses toward ink on paper (10.42:1) and on-ink muted text lifts (13.15:1). These exist only inside that media query.

### Named Rules
**The One Stamp Rule.** Saturated accents (green, amber, red, blue) mark state — never decorate empty chrome. Prefer ink + paper first.

**The Floor Amber Rule.** Amber means survival / tripwire / review. Do not use amber as a generic “warning yellow” for unrelated UI.

## Typography

**Display Font:** Archivo Black (sans)
**Body Font:** IBM Plex Sans (system-ui fallback)
**Label/Mono Font:** IBM Plex Mono

**Character:** Display is compressed and uppercase-friendly for protocol titles; mono carries the file’s bureaucratic voice (eyebrows, buttons, stats labels); sans carries readable body at 13–15px.

### Hierarchy — the whole ramp, no other sizes
The app uses exactly six pinned steps plus the display scale. Anything off this list is drift (the sizes below 11.5px that once shipped were raised at the source on 2026-08-17; `tests/a11y-floor-guard.test.ts` fails the build if one returns).

- **Label — 11.5px** (mono, 400/500, tracking 0.1–0.15em, uppercase): Eyebrows, buttons, nav, chips, status badges, footnotes. This is the floor for everyone; easy mode lifts it to 16px.
- **Caption — 13px** (sans 400): Secondary copy, list-row detail lines. Easy mode lifts to 16px.
- **Body — 14px** (sans 400; 600 for card titles): Explanatory copy, answers, notes. Easy mode lifts to 18px.
- **Row title — 15px** (sans 500): The primary line of a tappable list row (retailers, doses, choices). Easy mode lifts to 18px.
- **Shelf row — 17px** (sans 500): Story-shelf navigation rows and the largest tap-row text. Easy mode lifts to 18px.
- **Display** (Archivo Black 400, tight): Tailwind named steps (`text-lg`–`text-2xl` and up) for headings; pinned numerals at **22px** (scoreboard stats), **32/34/40px** (rest timer, energy figures, weigh-in). Numerals are data, not labels — they scale per surface.
- **Print exception:** the print-only shopping list runs 16–24px on paper and is unaffected by easy mode.
- **SVG:** chart text must come from `axisFontSize(viewBoxWidth)` — the viewBox transform means a pinned class lies about its rendered size.

### Named Rules
**The Mono Stamp Rule.** Interactive chrome and section labels speak in mono uppercase. Do not title-case primary buttons in sans.

## Layout

Mobile-first single column capped at `max-w-md` (`lg:max-w-3xl`), horizontal padding ~16px, vertical rhythm of 12px between cards (`gap-3`). Scoreboard is full-bleed ink header; content sits on paper. Bottom chrome is a single tab bar; page padding-bottom is **84px** so content clears it. Desktop keeps the same narrow column centered — not a wide dashboard. Easy mode (`[data-easy="1"]`) raises the root to 18px and targets to 48px.

## Elevation & Depth

Flat-by-default file surfaces. Depth comes from paper vs panel contrast and hairline rules, not stacked shadows.

### Shadow Vocabulary
- **Card rest** (`0 1px 2px rgba(21,23,28,0.04)`): Default cards.
- **Sheet lift** (`0 8px 32px rgba(21,23,28,0.18)`): Modal sheets only.
- **Scrim** (`ink` at 40%): Sheet backdrop.

### Named Rules
**The Flat-By-Default Rule.** No glow, no multi-layer glass. Shadows appear only for cards (whisper) and sheets (structure).

## Shapes

Gently squared file corners on a four-step ramp — **6 / 10 / 14 / 20px**: small controls at 6px (`rounded-md`), cards, buttons and check rows at **10px**, sheets and status pills at **14px**, chips/mode pills at **20px**, with `rounded-full` reserved for dots and true pills. The Tailwind names `rounded-lg` (8px) and `rounded-xl` (12px) are off-ramp and were normalised away on 2026-08-17 — use the pinned values. Eyebrow hash marks are nearly square (`1px` radius). Borders are 1px `rule` or semantic color — no thick outlines.

## Components

### Buttons (`TmButton`)
- **Shape:** 10px radius; min height 44px; mono uppercase 11.5px / 0.15em tracking.
- **Primary:** Ink fill, white text.
- **Ghost:** Panel fill, rule border, ink text.
- **Danger:** Alarm red fill.
- **Soft:** Soft fill for secondary completion states.
- **Press:** 150ms transform/opacity; disabled at 40%. Reduced motion keeps this press; it stills pulse and the breathe fill only.

### Chips (`TmChip`)
- **Style:** Pill (20px), soft fill + rule border; green tone for crew nudges.
- **Active:** Ink (or green) fill with white text; `aria-pressed` when used as a toggle.

### Cards (`Card`)
- **Corner Style:** 10px
- **Default:** Panel + rule border + whisper shadow; padding 16px.
- **Amber tone:** Amber stock + amber border for tripwire / survival / review.

### Eyebrow
Mono uppercase dim label with an 18×4px color hash bar — the file’s section stamp.

### Inputs
Panel background, 10px radius, **rule-strong** border (3:1); focus border shifts to ink. Numeric weigh-in stays narrow mono.

### Navigation
Fixed bottom tab bar on panel with top rule; mono label; 3px mode-accent pill when active (green or amber). Four stamps for everyone: Today / Protocol / Crew / More. Protocol is the day's work in order (kitchen → body file → mind file); More is the appendix. Easy mode keeps the same stamps and plains the shelf rows only. Labels nowrap at 320px. A “Skip to content” link precedes the scoreboard.

### Scoreboard (signature)
Ink header with white display title, mono kicker, mode disclosure (not a dialog), and a three-cell dark interior board (Mass / Day / Adherence|Floor). File menu lives here — not in the tab bar.

### Sheets (`TmSheet`)
Bottom sheet on mobile, centered on larger viewports; 14px radius; title in mono; dismissible scrim (click only, out of tab order). Keyboard: focus Close on open, Tab cycles inside the panel, Escape closes, focus returns to the opener.

## Do's and Don'ts

### Do:
- **Do** keep the narrow performance-file column and paper/ink pairing.
- **Do** use mono uppercase for chrome (buttons, nav, eyebrows).
- **Do** reserve amber for survival / tripwire / review; green for executed progress.
- **Do** keep primary controls ≥44px tall (48px in easy mode).
- **Do** share crew projection only — never style partner weights into the UI.
- **Do** take new colors from `globals.css` tokens, not from this file’s memory of an older palette.

### Don't:
- **Don't** introduce purple gradients, glassmorphism, or neon dark themes.
- **Don't** replace Archivo / IBM Plex with Inter/Roboto “default SaaS” stacks.
- **Don't** add a fifth bottom-nav stamp; Protocol and More are shelves.
- **Don't** decorate with emoji or sticker badges on the scoreboard.
- **Don't** invent macro-tracking chrome that violates survival’s three-check floor.
- **Don't** restore pre-AA hex (`#c77d1f`, `#2e7d4f`, `#c7373f`, `#70747b`, `#9ba0a8`, `#b8860b`).
