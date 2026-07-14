# TARA

Research-use peptide platform. Lives alongside `peppy/` in this repo as an
independent Next.js app — separate `package.json`, no shared runtime, so work
here can't break the Peppy storefront and vice versa.

Built from the design handoff package supplied mid-session — `HANDOFF-SPEC.md`
is the original full spec, `BRAND-KIT.md` the design tokens,
`UPDATES-July2026.md` the feature update, and `design-reference/` the
high-fidelity HTML prototypes (open `design-reference/TARA Website.dc.html`
directly in a browser to interact with every screen). Real brand tokens, the
51-SKU catalogue, and the Convex schema in this build are all ported from it.
See `docs/COMPLIANCE.md` for the vocabulary rules this build follows (amount,
not dose) and why.

## What's built

- **Brand** — real tokens from `BRAND-KIT.md`: primary green `#1B5E20`,
  accent `#009B72`, Playfair Display / Inter / JetBrains Mono, the hexagon
  logo mark (`src/components/logo-mark.tsx`).
- **Catalogue** (`/catalogue`) — all 51 SKUs from
  `design-reference/Pricing Model.csv`, category filter chips with counts,
  sort, stock badges. Multi-strength products only had a single "from" price
  in the CSV; larger variants are priced by a documented mg-ratio heuristic
  in `src/lib/products.ts` — **placeholder, not a quoted price.**
- **Product page** (`/products/[slug]`) — variant selector with live price,
  add-to-order, a mock batch + Verify ID, and a link into the calculator.
- **Reconstitution calculator** (`/calculator`) — type-ahead search, vial
  strength picker, mg + BAC water + amount-per-draw → U-100 syringe units,
  overfill warning, a session log (`localStorage`), print/PDF via
  `window.print()`. Formula ported exactly from the design reference's JS;
  copy uses "amount," never "dose" (see `docs/COMPLIANCE.md`). No
  "typical amount" is pre-filled per compound — deliberately left blank
  rather than inventing per-compound reference amounts without SME review.
- **Verify** (`/verify`) — login-free batch/COA lookup. Every catalogue
  item's variants get a deterministic mock batch + Verify ID
  (`src/lib/mock-batch.ts`, `verifyIdFromBatch` in `src/lib/pricing.ts`,
  ported from the reference's `vidFor`), so any of them can be looked up as
  a demo. Also reachable from the always-present header verify field.
- **Checkout** (`/checkout`) — cart review, delivery details, the
  research-use declaration checkbox, VAT-inclusive totals (Irish 23%), the
  automatic volume discount (2 vials −5%, 3+ −10%) combined with an optional
  promo code (never stacked — `max(volumePct, promoPct)`, matching
  `convex/pricing.ts` exactly), free-shipping nudge at €150 net, and a
  confirmation state. Payment is a placeholder — see the SumUp integration
  point in the file and `convex/SUMUP.md`.
- **`convex/`** — the handoff's schema + `pricing.ts` + `orders.ts` +
  `verifications.ts` + `loyalty.ts` + `auth.md` + `SUMUP.md`, ported as-is.
  Not deployed — no TARA Convex deployment credentials were available in
  this session. `convex/_generated/*` are hand-written stand-ins (see the
  comment at the top of each) so the scaffold typechecks; run `npx convex
  dev` once you have a deployment to push it for real and regenerate them.

## What's not built yet

- **Home, in full** — the real design has a goal-finder grid and a six-step
  "quality chain" section; this build has a simplified hero + featured
  compounds instead.
- **Guided finder, stack library, Knowledge/Docs, FAQ** — all in the design
  reference, none built here.
- **Accounts + auth** — no Convex Auth wiring yet (needs a real deployment).
- **The account dashboard / companion-app features** — next-scheduled
  measurement cards, protocol/schedule tracking, progress charts, referrals,
  subscriptions. See `docs/COMPLIANCE.md` — these are the features the
  compliance flag was about; build them using the softened vocabulary there,
  not the design reference's dosing language directly.
- **Real payment** — SumUp isn't wired; see `convex/SUMUP.md`.

## Commands

```bash
cd tara
npm install
npm run dev    # http://localhost:3000
npm run check  # lint + typecheck + build
```
