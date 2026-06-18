# 01 — Website Design Plan

> Goal: a fast, trustworthy, conversion-optimised sports-nutrition store that is **SEO-ready from day one** and buildable on a lean budget.
> Related: [00 Overview](./00-OVERVIEW.md) · [03 SEO](./03-SEO-PLAN.md) · [06 Compliance](./06-REGULATORY-COMPLIANCE.md)

---

## 1. Platform decision (decide this first)

| Option | Pros | Cons | Verdict for you |
|--------|------|------|-----------------|
| **Shopify** (+ themes/apps) | Fast to launch, payments/checkout/tax/inventory built in, huge app ecosystem (reviews, subscriptions), PCI handled, great uptime | Monthly fee + app fees, less design freedom, transaction fees if not using Shopify Payments | ✅ **Recommended default** — on a lean budget with no dedicated dev team, time-to-market and built-in commerce ops beat custom code |
| **Headless Next.js (this repo) + commerce backend** (Shopify Storefront API, Medusa, or BigCommerce) | Full design control, best-in-class Core Web Vitals, owns the SEO/perf ceiling, reuses this repo's Next 16 + shadcn/ui + Tailwind v4 | Needs ongoing dev capacity, you build/maintain more, slower launch | ⚠️ Choose **only if** you have reliable dev time. Best long-term SEO ceiling. |
| **WooCommerce** | Cheap, flexible, WordPress content/SEO ecosystem | Self-hosting, security/maintenance burden, perf tuning needed | Viable but ops-heavy; not recommended unless already WP-fluent |

**Recommendation:** Launch on **Shopify** to move fast and stay compliant operationally; if/when dev capacity exists, migrate the storefront to **headless Next.js using this repo** (Shopify Storefront API as the backend) to maximise performance and SEO. This plan is written so the design works on **either**.

> The rest of this document is platform-agnostic. The "repo mapping" callouts show how each piece would live in this Next.js codebase if you go headless.

---

## 2. Information architecture & sitemap

```
/                         Home
/collections              Shop all
  /collections/protein        PLP (category)
  /collections/creatine
  /collections/pre-workout
  /collections/recovery       (BCAA/EAA, electrolytes, sleep)
  /collections/weight-management
  /collections/vitamins        (everyday health adjacent)
  /collections/bundles
  /collections/bestsellers
/products/{handle}        PDP (product detail)
/bundles/{handle}         Bundle PDP
/pages/quality            Quality & testing (Informed Sport, COAs) ← trust hub
/pages/about              Brand story (Irish-owned)
/pages/sustainability     (optional)
/blog (or /learn)         Content hub  ← SEO engine, see doc 04
  /blog/{slug}
/pages/faq
/account                  Login / orders / subscriptions
/cart, /checkout
Legal: /pages/privacy /pages/terms /pages/shipping-returns
       /pages/cookie-policy /pages/disclaimer
```

**IA principles**
- **Flat & shallow** — money pages reachable in ≤3 clicks; great for crawl depth and UX.
- **Collections = your keyword landing pages.** Each has unique intro copy + SEO metadata (see [03](./03-SEO-PLAN.md)).
- **/learn hub feeds /collections and /products** via internal links (see [04](./04-CONTENT-STRATEGY-50-ARTICLES.md)).

> **Repo mapping:** routes live under `src/app/` — e.g. `src/app/collections/[slug]/page.tsx`, `src/app/products/[handle]/page.tsx`, `src/app/blog/[slug]/page.tsx`. Use Next 16 App Router server components + `generateMetadata` for SEO. **Read `node_modules/next/dist/docs/` before coding — this Next.js has breaking changes vs. training data** (per repo AGENTS.md).

---

## 3. Page-by-page specs

### 3.1 Home
Purpose: communicate *who you are*, *why trust you*, and route to bestsellers fast.
- **Sticky header**: logo, primary nav (Protein / Creatine / Pre-Workout / Recovery / Bundles / Learn), search, account, cart. Free-shipping-threshold announcement bar.
- **Hero**: single clear value prop ("Irish-made sports nutrition, Informed-Sport tested, shipped next-day across Ireland"), one primary CTA. No carousel (hurts CWV + conversions).
- **Trust bar** (immediately below hero): Informed Sport · Made in EU/Ireland · Next-day IE delivery · ★ rating · Secure checkout.
- **Bestsellers grid** (4–8 SKUs), **Shop by goal** tiles (Build muscle / Recover / Energy / Lose fat — framed compliantly), **Bundles** strip.
- **Social proof**: review highlights, UGC.
- **Editorial/Learn teaser** (3 latest/best articles) → internal links to content hub.
- **Email capture** with first-order incentive.
- **Footer**: full nav, trust badges, legal links, newsletter, payment icons.

### 3.2 Collection / PLP
- H1 = category keyword (e.g. "Whey Protein Ireland").
- **Unique intro copy** (100–200 words, compliant) above or below the grid — this is what ranks.
- Product cards: image, name, key spec (e.g. "24g protein/serving"), **price + price-per-serving**, rating, quick-add. Informed Sport badge where applicable.
- Filters/sort: goal, flavour, dietary (vegan/gluten-free), price. Faceted nav must be **crawl-safe** (canonical/`noindex` on filter combos — see [03](./03-SEO-PLAN.md)).

### 3.3 Product / PDP (the conversion centre)
PDP anatomy, top to bottom:
1. Gallery (multiple angles, label readable, lifestyle shot).
2. Title, rating (jump-to-reviews), price **and price-per-serving**, stock/shipping ETA.
3. Variant selectors (size, flavour) with per-variant price.
4. Primary CTA: **Add to cart** + **Subscribe & Save** toggle (show % saving).
5. **Trust row**: Informed Sport, money-back, next-day IE delivery.
6. Short benefit bullets (compliant — no unauthorised health claims, see [06](./06-REGULATORY-COMPLIANCE.md)).
7. **Supplement facts / nutritional panel** (full transparency — a differentiator).
8. **How to use / dosage**, ingredients, allergens.
9. **Quality & testing**: COA link, Informed Sport explanation, "made in EU".
10. Reviews (with photos), Q&A.
11. Cross-sell ("Complete your stack") + frequently-bought-together bundle.
12. FAQ accordion (drives FAQ schema + long-tail SEO).

> Structured data: `Product`, `Offer`, `AggregateRating`, `FAQPage` — see [03](./03-SEO-PLAN.md).

### 3.4 Bundles
Pre-built stacks (Starter / Muscle / Endurance / Value) at a visible discount vs. buying separately → raises AOV. Each bundle is its own indexable page targeting bundle/stack keywords.

### 3.5 Quality hub (`/pages/quality`)
Your trust centrepiece: how products are made, where, GMP, batch COAs, what Informed Sport means and why it matters (banned-substance assurance for athletes). Links from every PDP.

### 3.6 Learn / Blog hub
Pillar + cluster structure per [04](./04-CONTENT-STRATEGY-50-ARTICLES.md). Article template: H1, author + reviewer byline (E-E-A-T), TOC, body, key-takeaways box, **compliant** product CTAs, related articles, references, medical/regulatory disclaimer.

### 3.7 Cart & checkout
- Slide-out cart with free-shipping progress bar ("€8 away from free delivery"), subscribe upsell, cross-sell.
- Checkout: as few steps as possible, express wallets (Apple/Google Pay, Revolut Pay, PayPal), trust badges, clear shipping/returns, no surprise fees.

### 3.8 Legal pages
Privacy, Terms, Shipping & Returns, Cookie Policy, **Disclaimer** ("not intended to diagnose, treat, cure…"). See [06](./06-REGULATORY-COMPLIANCE.md).

---

## 4. Design system

> Reuse the repo's existing **Tailwind v4 (oklch tokens)** + **shadcn/ui** foundation. Don't reinvent primitives — extend them.

**Tokens** (define in the Tailwind theme / CSS variables):
- **Colour**: brand primary + accent, neutral scale, semantic (success/warn/error). Sports-nutrition convention: bold, energetic, high-contrast — but keep accessible contrast (≥4.5:1 text). Decide light/dark approach early.
- **Type**: one display/heading family + one readable body family; type scale (h1–h6, body, caption). Big, confident numerals for stats/price.
- **Spacing**: 4-point scale (4/8/12/16/24/32/48/64).
- **Radius / shadow / elevation**: consistent card and button treatment.

**Component inventory** (map to `src/components/`):
- From shadcn/ui (`src/components/ui/`): button, card, accordion, dialog/sheet (cart), tabs, badge, input, select, toast, tooltip, carousel (use sparingly).
- New domain components (`src/components/`): `ProductCard`, `PricePerServing`, `TrustBar`, `InformedSportBadge`, `SupplementFacts`, `SubscribeToggle`, `BundleBuilder`, `ReviewSummary`, `AnnouncementBar`, `ArticleCard`.
- Extracted SVGs in `src/components/icons.tsx` per repo convention.

**Responsive:** mobile-first (the majority of IE supplement traffic is mobile). Verify PDP, cart, and checkout on small screens first.

---

## 5. Performance, CWV & accessibility (these ARE SEO)

- **Core Web Vitals budget**: LCP < 2.5s, INP < 200ms, CLS < 0.1 (on mobile/4G).
- Next.js `<Image>` (or Shopify image CDN) with correct sizes, AVIF/WebP, lazy-load below the fold; reserve space to avoid CLS.
- Defer non-critical JS (reviews widget, chat); avoid heavy carousels/animations.
- Self-host or `next/font` the fonts; preconnect to commerce/image CDNs.
- **Accessibility WCAG 2.1 AA**: semantic headings, alt text, focus states, keyboard nav, ARIA on cart/menus, colour contrast. Good a11y also correlates with better SEO and conversions.

---

## 6. Build order (lean)

1. Design tokens + core components (header, footer, product card, PDP shell).
2. One collection + one PDP end-to-end (template the rest).
3. Cart/checkout + payments.
4. Reviews, subscriptions, email capture apps/integrations.
5. Learn hub template + first cluster of articles.
6. Legal pages + analytics + structured data.
7. QA: CWV, mobile, accessibility, compliance review of all on-page claims.

> If headless in this repo: run `npm run check` (lint + typecheck + build) before each push, per repo commands.
