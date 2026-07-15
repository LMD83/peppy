# TARA Peptides — Developer Handoff

Build spec for implementing the TARA Peptides e-commerce site as production software.
Target stack: **React (front end) + Convex (backend/DB/auth) + SumUp (payments)**.

---

## 0. How to use this package

- **`design-reference/TARA Website.dc.html`** — the high-fidelity design reference. This is the **source of truth for look, layout, copy, and behavior**. Open it in a browser to interact with every screen. It is a design prototype (a single-file component), **not** production code to copy line-for-line — recreate it properly in your stack.
- **`design-reference/Pricing Model.csv`** — full SKU list with competitor prices, undercut columns, and recommended final prices. Use it to seed the `products` table.
- **`convex/`** — starter backend files (schema + functions). Drop into a Convex project and extend.
- This README — the full spec: screens, components, design tokens, data model, business rules.

**Recommended first prompt to Claude Code:**
> Read README.md. Scaffold a React + Vite front end and a Convex backend matching the schema in `convex/`. Implement the screens in order (Catalogue → Product → Checkout → Account). Use the design reference HTML for exact layout, copy, and colors.

---

## 1. Product overview

TARA Peptides sells research peptides in Ireland/EU. The strategic wedge is **proof over hype**: every vial is batch-tested and independently verifiable (COA + unique verify ID), with no login required to verify. The site undercuts the main competitor (Revive Peptides) by ~15–17% on VAT-inclusive pricing.

Core differentiators to preserve:
1. **Login-free batch verification** — header verify field on every page.
2. **Verification-linked invoices** — every invoice line carries batch + verify ID.
3. **Reconstitution calculator** — mg/BAC-water/dose → syringe units.
4. **Guided finder + stack library** — goal-based discovery and researched bundles.

---

## 2. Design tokens

**Colors**
- Primary green `#1B5E20` (hover `#164D1A`); accent green `#009B72`.
- Ink `#1A1A1A`; body text `#3f4854`; muted `#55606E`; faint `#8a95a5`.
- Borders `#E4E7EC` / `#D0D5DD`; surfaces `#FFFFFF`, `#FAFAFA`, `#F2F4F7`.
- Green wash `#F6FBF8` / border `#cfe3d6`. Dark panel `#0D1B2A`.
- Blue `#1565C0`; purple `#6A1B9A`; copper `#B87333`. Error `#B4232A` / `#8a2b30`.
- Warning wash `#FFF8EE` / border `#ead8bf` / text `#7a531d`.

**Type**
- Display: **Playfair Display** (serif) — headings, prices.
- Body/UI: system sans (ship Inter or similar).
- Mono: **JetBrains Mono** — batch codes, verify IDs, card/calculator numbers.

**Shape**: radii 2px (controls) to 6px (cards). 1px borders. Sparing shadows. Generous whitespace.

---

## 3. Screens (all in the design reference)

1. **Home** — hero; goal-finder strip (6 goals); quality-chain section; featured compounds.
2. **Catalogue** — category filter chips w/ counts; sort (name/price/purity); product cards with stock badge, plain-English blurb, "from €X", Details + Add.
3. **Product** — strength variant selector (price updates live), plain-English description, STACKS callout, spec table, inline-expanding COA, provenance timeline, calculator entry.
4. **Checkout** (4 steps: Review → Details → Payment → Confirmation) — cart with qty steppers; **automatic volume discount**; promo code; free-shipping nudge; research-use declaration; SumUp payment (wallets + card); confirmation with verification-linked invoice, order timeline, and automated-email preview.
5. **Reconstitution calculator** — mg + BAC water + dose → U-100 units, volume/dose, concentration, doses/vial; overfill warning.
6. **Guided finder** — pick a research goal → recommended compounds + link to stacks.
7. **Stack library** — 6 researched bundles with rationale, components, bundle price (~8% off), one-click add.
8. **FAQ** — accordion (verification, research-use, payment, shipping, storage, discounts).
9. **Verify** — enter/scan batch ID → COA result (login-free).
10. **Knowledge / Docs** — educational articles and documentation.
11. **Account** (TO BUILD — see §5) — auth, dashboard, order history, reorder, My Verifications, loyalty.

---

## 4. Business rules

- **Prices are VAT-inclusive** (Irish VAT 23%). Never add VAT at the end. Show "Includes VAT (23%)" as a contained line. `vat = total − total/1.23`.
- **Volume discount (automatic, no code):** 2 vials (total qty) → 5% off order; 3+ vials → 10% off. Applies to whole-order subtotal.
- **Promo code** `TARA15` → 15% (first order). **Never stack** with volume — apply `max(volumePct, promoPct)`.
- **Shipping:** flat €9.95; **free when net goods ≥ €150**. Show "add €X more" nudge below threshold.
- **Verify ID** is deterministic from batch number (see reference `vidFor`), shown per invoice line.
- **Research-use declaration** checkbox required before payment.

---

## 5. Account system + loyalty (to build)

Backed by Convex (see `convex/`). Screens:
- **Auth** — register / sign in (Convex Auth).
- **Dashboard** — order history, saved addresses, one-click **reorder**, download invoice + COA per order.
- **My Verifications** — every batch the user has purchased, each still verifiable with its COA. (Unique retention feature — a personal authentication ledger.)
- **Loyalty** — the automatic volume tiers are cart-level and need no login. Optional future: spend-based tiers, subscribe-&-save (recurring orders at 10–15% off), referral (give €10/get €10), restock alerts. Schema stubs included.

---

## 6. Data model → see `convex/schema.ts`

Tables: `users`, `sessions`, `products`, `orders`, `orderItems`, `verifications`, `loyalty`, `subscriptions`. Seed `products` from `design-reference/Pricing Model.csv`.

## 7. Payments → see `convex/SUMUP.md`

Server-to-server SumUp checkout: create checkout (secret key server-side only) → customer pays (widget/hosted) → confirm via API/webhook → `orders.markPaid` → generate invoice + send email.
