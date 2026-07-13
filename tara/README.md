# TARA

Research-use peptide platform. Lives alongside `peppy/` in this repo as an
independent Next.js app — separate `package.json`, no shared runtime, so work
here can't break the Peppy storefront and vice versa.

## What's built

- **Reconstitution calculator** (`/calculator`) — type-ahead search across 20
  reference compounds, live solution-concentration math, a draw-volume
  reference table, and a research log persisted to `localStorage`. Defaults
  to 2&nbsp;mL of bacteriostatic water per vial, matching the brief.
- **Catalogue** (`/catalogue`) — demonstrates the volume-tier pricing engine:
  buy 2 vials → 5% off, 3+ → 10% off, automatically, no code required. A
  promo code can also be entered; whichever discount is larger applies — they
  never stack. Logic lives in `src/lib/pricing.ts`, framework-agnostic so it
  can be reused server-side later (Convex mutation, checkout API, etc.).
- **Home** (`/`) — placeholder landing page.

## What's not built yet

Everything else described in the original spec: accounts/auth, a Convex
backend (products, orders, loyalty), SumUp payment integration, the COA/batch
lookup portal, and the remaining screens. See `docs/COMPLIANCE.md` before
writing any customer-facing copy, and the strategy-brief artifact from this
session for the SEO/retention roadmap.

The design tokens in `src/app/globals.css` are a placeholder clinical/amber
palette chosen to fit the product — the real TARA brand reference
(`TARA Website.dc.html`) was never received in this session. Swap the tokens
for the real ones when available.

## Commands

```bash
cd tara
npm install
npm run dev    # http://localhost:3000
npm run check  # lint + typecheck + build
```
