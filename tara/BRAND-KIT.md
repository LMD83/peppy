# TARA Peptides — Brand & Design Kit

The single source of truth for logo, colour, type, and UI style. Everything in the site, app, and packaging is built from these tokens. Match them exactly.

---

## 1. Logo

**Mark** — a hexagon (provenance / molecular motif) enclosing a stylised "X" cross with a centre node. Stroke weight ~2.4 relative to a 48×48 viewBox.
- Hexagon path: `M24 3 L42 13.5 V34.5 L24 45 L6 34.5 V13.5 Z`
- Inner detail: `M24 15 L24 33 M17 19.5 L31 28.5 M31 19.5 L17 28.5` + centre `circle cx=24 cy=24 r=3`
- Mark stroke: primary green `#1B5E20`. Centre node: `#009B72` (screen) or `#1B5E20` (print/carton).

**Wordmark** — "TARA" in Playfair Display 700, letter-spacing `.22em–.24em`, colour `#1B5E20`.
**Lockup** — mark + wordmark horizontal, with a sub-line "PEPTIDES · RESEARCH GRADE" in Inter 600, `.28em` tracking, `#55606E`, ~9.5px.
**On kraft carton** — mark + wordmark printed in `#1B5E20` on natural kraft; sub-line in `#6b5a3a`.

Clear space = height of the mark on all sides. Never recolour the mark outside the greens, never stretch, never add shadow.

---

## 2. Colour palette

**Brand greens**
- Primary `#1B5E20` · hover/darker `#164D1A`
- Accent `#009B72` · bright (app/dark) `#12b886`
- Green wash `#F6FBF8` · wash border `#cfe3d6` · deep wash text `#14401b`

**Neutrals / ink**
- Ink `#1A1A1A` · body `#3f4854` · muted `#55606E` · faint `#8a95a5`
- Borders `#E4E7EC` / `#D0D5DD` · surfaces `#FFFFFF` / `#FAFAFA` / `#F2F4F7`

**Dark (app + panels)**
- Base `#0a121c` / `#0D1B2A` · card `#12263A` · border `#1c3049` / `#22374d`
- Dark text `#E6EDF4` · dark muted `#8fa3b8` / `#5f7387`

**Accents**
- Blue `#1565C0` · purple `#6A1B9A` · copper `#B87333`
- Premium/Fellow gold `#C9A15A`
- Kraft carton: front `#d4b98c`→`#c4a675`, top `#e0c99e`, side `#a5875a`, edge `#a98f63`

**Status**
- Error `#B4232A` / `#8a2b30` (wash `#FDF2F2`, border `#f0c9c9`)
- Warning wash `#FFF8EE` / border `#ead8bf` / text `#7a531d`

---

## 3. Typography

| Role | Family | Weights | Use |
|---|---|---|---|
| Display | **Playfair Display** (serif) | 500/600/700 | Headings, prices, hero numbers |
| Body / UI | **Inter** | 400/500/600/700 | All body, labels, buttons |
| Mono | **JetBrains Mono** | 400/600 | Batch codes, verify IDs, card/calculator numbers, dates |

Google Fonts import:
`https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap`

Scale (web): hero 42–46px, h2 26–34px, body 14.5–16px, small 12.5–13px, eyebrow 11–12px `.16–.2em` tracking uppercase. Mobile min body 15px, hit targets ≥44px. Slides/print never below 12px.

---

## 4. Shape, spacing, motion

- Radius: 2px (controls), 4–8px (cards/panels), 999px (pills), 12–18px (app cards).
- Borders: 1px hairlines. Shadows sparing; app/premium uses soft `0 18px 40px rgba(13,27,42,.16)`.
- Layout: max-width 1080–1200px, 24px gutters. Flex/grid with `gap`; avoid inline-flow spacing.
- Motion: subtle `taraRise` (10px/220ms ease-out) reveals; `taraSpin` for loaders. Respect `prefers-reduced-motion`.

---

## 5. Components (canonical patterns)

- **Buttons** — solid primary `#1B5E20` white text; secondary outline `#1B5E20` on `#F6FBF8`; focus ring `2px #1565C0` offset 2px.
- **Cards** — white, 1px `#E4E7EC`, radius 4–8px; accent gradient top-strip for product/stack cards.
- **Chips/pills** — 999px radius; active = filled primary, inactive = white + `#D0D5DD`.
- **Header verify field** — always-present QR-marked input + green Verify button.
- **COA / invoice** — mono for batch + verify IDs; "ALL PASS" green pill; verify ID per line.
- **Dark panels** — `#0D1B2A` with `#009B72` eyebrows for CTAs and premium moments.
- **Fellow/premium** — gold `#C9A15A` badges and progress accents.

---

## 6. Voice
Factual, research-framed, plain-English. "We explain, we don't persuade." Always "for laboratory research use only." Confidence through evidence (COA, verify ID, provenance), never hype.

---

## Assets in this package
Logo SVG is inline in `design-reference/TARA Kit & Packaging.dc.html` (top lockup + carton print) and `TARA Website.dc.html` (header avatar). Lift the paths above to produce standalone SVG/PNG exports.
