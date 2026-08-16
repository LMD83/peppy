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
  dim: "#70747b"
  dim-2: "#9ba0a8"
  rule: "#e4e5e1"
  grid: "#eeefeb"
  soft: "#f3f3f0"
  blue: "#2b5fab"
  red: "#c7373f"
  green: "#2e7d4f"
  green-mid: "#9cc4a9"
  green-faint: "#dfeae2"
  yellow: "#b8860b"
  amber: "#c77d1f"
  amber-bg: "#fbf3e4"
  amber-ink: "#6b5a2e"
  purple: "#8a5a9e"
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
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.65625rem"
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
- Mobile-first `max-w-md` column; fixed bottom nav + quick actions

## Colors

A cool paper stack with ink text, semantic greens/ambers for protocol state, and restrained blues/reds for measure and alarm.

### Primary
- **File Ink** (#15171c): Primary actions, scoreboard chrome, selected chips, strong text. The voice of the stamp.
- **Cool Paper** (#fafaf8): App canvas / page ground.
- **Panel White** (#ffffff): Cards, sheets, bottom chrome.

### Secondary
- **Protocol Green** (#2e7d4f): Cut-mode accents, done checks, positive chips, adherence.
- **Floor Amber** (#c77d1f) on **Amber Stock** (#fbf3e4): Survival mode, tripwires, review prompts. **Amber Ink** (#6b5a2e) for readable copy on amber stock.

### Tertiary
- **Measure Blue** (#2b5fab): Weigh-in / state-check eyebrows, informational accents.
- **Alarm Red** (#c7373f): Craving, kitchen, destructive (sign out), errors.
- **Evidence Yellow** (#b8860b): Research / experiment eyebrows.
- **Marker Purple** (#8a5a9e): Reserved accent; use sparingly.

### Neutral
- **Ink 2 / 3 / Rule** (#1e222a / #232730 / #2c313b): Scoreboard interior layers and dark borders.
- **Dim / Dim 2** (#70747b / #9ba0a8): Secondary labels and muted mono.
- **Rule / Grid / Soft** (#e4e5e1 / #eeefeb / #f3f3f0): Borders, list dividers, quiet fills.

### Named Rules
**The One Stamp Rule.** Saturated accents (green, amber, red, blue) mark state — never decorate empty chrome. Prefer ink + paper first.

**The Floor Amber Rule.** Amber means survival / tripwire / review. Do not use amber as a generic “warning yellow” for unrelated UI.

## Typography

**Display Font:** Archivo Black (sans)
**Body Font:** IBM Plex Sans (system-ui fallback)
**Label/Mono Font:** IBM Plex Mono

**Character:** Display is compressed and uppercase-friendly for protocol titles; mono carries the file’s bureaucratic voice (eyebrows, buttons, stats labels); sans carries readable body at 12.5–14px.

### Hierarchy
- **Display** (400, ~24–34px, tight): Scoreboard titles, large numbers (kitchen close, breathe timer, stats).
- **Title** (600, ~14px): Card section titles inside content.
- **Body** (400/500, ~12.5–13.5px): Explanatory copy, list rows.
- **Label** (400/500, 9–11px, tracking 0.1–0.15em, uppercase): Eyebrows, buttons, nav, chips, status badges.

### Named Rules
**The Mono Stamp Rule.** Interactive chrome and section labels speak in mono uppercase. Do not title-case primary buttons in sans.

## Layout

Mobile-first single column capped at `max-w-md`, horizontal padding ~16px, vertical rhythm of 12px between cards (`gap-3`). Scoreboard is full-bleed ink header; content sits on paper. Bottom chrome is dual-layer: quick actions above tab nav, with page padding-bottom ~152px so content clears both. Desktop keeps the same narrow column centered — not a wide dashboard.

## Elevation & Depth

Flat-by-default file surfaces. Depth comes from paper vs panel contrast and hairline rules, not stacked shadows.

### Shadow Vocabulary
- **Card rest** (`0 1px 2px rgba(21,23,28,0.04)`): Default cards.
- **Sheet lift** (`0 8px 32px rgba(21,23,28,0.18)`): Modal sheets only.
- **Scrim** (`ink` at 40%): Sheet backdrop.

### Named Rules
**The Flat-By-Default Rule.** No glow, no multi-layer glass. Shadows appear only for cards (whisper) and sheets (structure).

## Shapes

Gently squared file corners: cards and primary buttons at **10px**; sheets at **14px**; chips/mode pills at **20px**; check rows and small controls at **8px** (`rounded-lg`). Eyebrow hash marks are nearly square (`1px` radius). Borders are 1px `rule` or semantic color — no thick outlines.

## Components

### Buttons (`TmButton`)
- **Shape:** 10px radius; min height 44px; mono uppercase 11px / 0.15em tracking.
- **Primary:** Ink fill, white text.
- **Ghost:** Panel fill, rule border, ink text.
- **Danger:** Alarm red fill.
- **Soft:** Soft fill for secondary completion states.
- **Press:** `opacity-70` active; disabled at 40%.

### Chips (`TmChip`)
- **Style:** Pill (20px), soft fill + rule border; green tone for crew nudges.
- **Active:** Ink (or green) fill with white text.

### Cards (`Card`)
- **Corner Style:** 10px
- **Default:** Panel + rule border + whisper shadow; padding 16px.
- **Amber tone:** Amber stock + amber border for tripwire / survival / review.

### Eyebrow
Mono uppercase dim label with an 18×4px color hash bar — the file’s section stamp.

### Inputs
Panel background, 10px radius, rule border; focus border shifts to ink. Numeric weigh-in stays narrow mono.

### Navigation
Fixed bottom tab bar on panel with top rule; icon + mono label; 3px mode-accent pill when active (green or amber). Quick-action strip sits above with soft bordered stamps (Craving / Breathe / Ritual).

### Scoreboard (signature)
Ink header with white display title, mono kicker, mode switcher pill, and a three-cell dark interior board (Mass / Day / Adherence|Floor). File menu (⋯) lives here — not in the tab bar.

### Sheets (`TmSheet`)
Bottom sheet on mobile, centered on larger viewports; 14px radius; title in mono; dismissible scrim.

## Do's and Don'ts

### Do:
- **Do** keep the narrow performance-file column and paper/ink pairing.
- **Do** use mono uppercase for chrome (buttons, nav, eyebrows).
- **Do** reserve amber for survival / tripwire / review; green for executed progress.
- **Do** keep primary controls ≥44px tall.
- **Do** share crew projection only — never style partner weights into the UI.

### Don't:
- **Don't** introduce purple gradients, glassmorphism, or neon dark themes.
- **Don't** replace Archivo / IBM Plex with Inter/Roboto “default SaaS” stacks.
- **Don't** add a fifth bottom-nav destination casually (quick actions absorb overflow).
- **Don't** decorate with emoji or sticker badges on the scoreboard.
- **Don't** invent macro-tracking chrome that violates survival’s three-check floor.
