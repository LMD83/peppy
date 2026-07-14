# TARA — July 2026 Feature Update (for the build)

Everything added since the initial handoff. Design references are in `design-reference/`; build these on the Convex + SumUp backend described in `convex/`.

## New in the website (`design-reference/TARA Website.dc.html`)
- **Full catalogue** — ~38 compounds across 13 categories, **strength variants** with live per-variant pricing, category filter chips, sort, stock badges.
- **VAT-inclusive pricing** — prices are final; checkout shows "Includes VAT (23%)" as contained, never added.
- **Cart → checkout → SumUp → confirmation** — 4-step flow, research-use declaration, order timeline, verification-linked invoice (batch + verify ID per line), automated-email preview.
- **Auto reconstitution kit** — per vial: 1× BAC water + 10 needles + 10 free swabs; **Standard vs Premium** tier selector (Premium = 3D holder + reusable pen + pen needles).
- **Discounts** — automatic volume tier (2 vials −5%, 3+ −10%), promo `TARA15` −15% (never stacked; take the better), free shipping ≥ €150.
- **Reconstitution calculator** — type-to-search all peptides, mg strength dropdown + manual, 2 mL BAC default (recommended), U-100 units output, session log, TARA-letterhead print/PDF, attach schedule to invoice + email.
- **Guided finder**, **stack library** (bundle pricing), **FAQ**.
- **Account area** (header "A" avatar) — dashboard (next dose, schedule), progress tracking + chart, protocol schedule, orders + reorder, subscription (6-month −5%), referrals (give/get €10), verified vault, gated knowledge. Currently a logged-in demo.

## Companion app (`design-reference/TARA App.dc.html`)
Dark premium iOS prototype, 5 tabs: Home (next dose/streak), Track (weight/skin/sleep/energy + photos), Plan (protocol + smart notifications), Learn (gated Fellow content), You (tier, referrals, subscription, vault). Build as React Native/Expo sharing the Convex backend. Full feature research in `design-reference/Roadmap & Automations.md`.

## Packaging (`design-reference/TARA Kit & Packaging.dc.html`)
3D-printed 5-well vial holder (matte green / off-white), die-cut cardboard insert (cheaper Standard option), 4/6/8/10-vial kraft carton range with printed logo, Standard/Premium kit tiers, full component cost-up (low-vol + at-scale).

## Backend additions needed (extend `convex/schema.ts`)
- `logs` (userId, metric, value, date, photos) — progress tracking.
- `schedules` (userId, peptide, window, dose, notifyOffset) — dosing + notifications.
- `subscriptions` (already stubbed) — recurring orders, 6-month term, −5%.
- `referrals` (referrerId, code, refereeId, status, creditCents).
- `kits` on order (tier: standard|premium, computed consumables).
Automations mapping is in `Roadmap & Automations.md` §6.

## Brand
See `BRAND-KIT.md` — logo, colours, fonts, components, voice.
