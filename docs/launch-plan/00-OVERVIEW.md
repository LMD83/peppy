# 00 — Overview & Gap Analysis

> **Project:** Own-brand / white-label **sports nutrition** e-commerce store, Ireland
> **Budget posture:** Lean (< €1,000/month) → **organic-first** growth
> **Status:** Pre-launch. Brand, supply, site, and content all to be built.
> **Last updated:** 2026-06-18

This is the master document. Read it first, then the seven supporting plans:

| # | Document | What it covers |
|---|----------|----------------|
| 00 | **This file** | Business snapshot, gap analysis, KPIs |
| 01 | [Website Design Plan](./01-WEBSITE-DESIGN-PLAN.md) | Platform, IA, page specs, design system |
| 02 | [Marketing Plan](./02-MARKETING-PLAN.md) | Positioning, channels, lifecycle, budget |
| 03 | [SEO Plan](./03-SEO-PLAN.md) | Technical, on-page, off-page, Ireland targeting |
| 04 | [Content Strategy — 50 Articles](./04-CONTENT-STRATEGY-50-ARTICLES.md) | Clusters, keyword map, 50 titles |
| 05 | [Competitive Pricing Research](./05-COMPETITIVE-PRICING-RESEARCH.md) | Undercutting methodology & unit economics |
| 06 | [Regulatory & Compliance](./06-REGULATORY-COMPLIANCE.md) | FSAI, health claims, labelling, ASAI |
| 07 | [Launch Roadmap](./07-LAUNCH-ROADMAP.md) | Phased timeline, milestones, KPI dashboard |

---

## 1. Business snapshot

- **What:** Direct-to-consumer sports nutrition (protein, creatine, pre-workout, recovery, etc.) sold under **your own brand**, manufactured by a **white-label / contract manufacturer**.
- **Where:** Republic of Ireland primary market; Northern Ireland / UK and rest-of-EU as secondary opportunities.
- **How (acquisition):** Organic-first — SEO + content + email/SMS + organic social + micro-influencer seeding. Paid ads are a small, surgical line item, not the engine.
- **Why this can work:** Post-Brexit, UK supplement giants (MyProtein, Bulk, etc.) now carry shipping friction, potential customs/VAT hassle, and slower delivery into Ireland. A credible **Irish-based, fast-shipping, no-customs** brand has a structural wedge — *if* the cost base and trust signals are right.

---

## 2. Gap analysis — what you're missing

Your brief covered website, marketing, SEO, content, and pricing. Those are necessary but **not sufficient**. Below is everything else that determines whether this launches successfully, ranked by how badly it can hurt you.

### 🔴 Critical — can block launch or get you fined/shut down

**1. Regulatory & legal compliance** *(see [06](./06-REGULATORY-COMPLIANCE.md))*
The #1 missing piece. Sports nutrition = food supplements = heavily regulated in Ireland/EU:
- **FSAI** food-supplement notification before you place products on the market.
- **EU Regulation 1924/2006** — you may only make **authorised** nutrition & health claims. "Boosts immunity", "burns fat", "builds muscle fast" used carelessly = illegal claims.
- **Labelling**: ingredients, allergens (the 14), NRVs, dosage, warnings, batch & best-before.
- **ASAI** advertising code + influencer disclosure (#ad).
Getting this wrong is the fastest route to forced takedowns, FSAI enforcement, or ASAI rulings. **This is not optional and not a "phase 2" item.**

**2. Supply chain & operations**
- White-label **manufacturer selection** (EU/IE-based ideal for shipping + GMP), MOQs, lead times.
- **Quality assurance**: Certificate of Analysis (COA) per batch, GMP/ISO, and — critically for sports nutrition — **Informed Sport** banned-substance certification. This is both compliance *and* your single strongest trust/marketing asset vs. competitors.
- Inventory, warehousing / **3PL**, pick-pack-ship, returns logistics.

**3. Unit economics**
You asked to "undercut competitors", but you can't undercut from a weak cost base. You need:
- Landed cost per SKU (manufacture + packaging + freight + duty).
- Target **gross margin** (sports nutrition DTC typically aims 55–70% on own-brand).
- **Price floor** per SKU and where undercutting is viable vs. where you compete on value/trust instead. Full framework in [05](./05-COMPETITIVE-PRICING-RESEARCH.md).

### 🟠 High — needed to actually transact and be trusted

**4. Payments, tax & business setup**
- Irish company registration (CRO), business bank account.
- **VAT registration** with Revenue; understand VAT on food supplements (most supplements are standard-rated in Ireland — confirm with an accountant).
- Payment gateway: Stripe / Shopify Payments; consider PayPal, Apple/Google Pay, and Revolut Pay (popular in Ireland).
- **GDPR + ePrivacy**: cookie consent banner, privacy policy, lawful basis for marketing.

**5. Trust & social proof**
- Reviews engine (Trustpilot, Judge.me, Okendo, or Yotpo) — non-negotiable in supplements.
- User-generated content; note **compliance limits** on before/after photos and testimonials (they can imply unauthorised health claims).
- Trust badges: Informed Sport, secure checkout, Irish-owned, money-back guarantee.

**6. Retention & LTV** *(your lean-budget growth engine — see [02](./02-MARKETING-PLAN.md))*
With paid acquisition mostly off the table, you live or die on **repeat purchase**:
- **Subscribe & Save** (replenishment is natural in this category).
- Email/SMS lifecycle flows.
- Loyalty + referral program.
LTV is the number that lets you eventually afford paid ads.

### 🟡 Important — gets overlooked, compounds over time

**7. Analytics & measurement**
- GA4 + Google Search Console from day one (Search Console especially — it powers your SEO feedback loop).
- Conversion tracking, server-side tagging considerations, consent-mode.
- A simple weekly KPI dashboard (section 4 below).

**8. Brand & differentiation**
- A reason to exist beyond "cheaper". Pure price war vs. scaled UK players is a losing game on a lean budget.
- Brand pillars, name, identity, tone — feeds both [01](./01-WEBSITE-DESIGN-PLAN.md) and [02](./02-MARKETING-PLAN.md).

---

## 3. The core strategic tension (read this twice)

> **You want to undercut on price, but you have a lean budget and own-brand (low initial volume → higher unit cost).** Those pull in opposite directions.

Scaled UK competitors buy raw materials by the tonne and run on thin margins they can afford because of volume. **You cannot win a pure price war with them.** What you *can* do:

1. **Compete on total landed cost to an Irish customer** — free/cheap fast IE shipping + no customs friction often beats a lower sticker price that arrives slowly with a customs surprise.
2. **Pick hero SKUs to undercut** (e.g. whey protein — the category's "milk", a known price-comparison anchor) and run healthy margins elsewhere.
3. **Compete on trust** (Informed Sport, transparency, Irish-owned) and **value** (bundles, subscribe & save) rather than raw sticker price.

This nuance is built into [05](./05-COMPETITIVE-PRICING-RESEARCH.md).

---

## 4. KPI framework & 12-month north-star targets

> Targets are planning placeholders to calibrate ambition — refine once you have cost data and the first 90 days of real traffic.

| Layer | Metric | Why it matters | Indicative 12-mo target |
|-------|--------|----------------|--------------------------|
| Acquisition | Organic sessions / mo | Core of lean strategy | 8–15k |
| Acquisition | Ranking keywords (top 10, IE) | SEO progress | 100+ |
| Acquisition | Email list size | Owned audience | 3–5k |
| Conversion | Conversion rate | Site/CRO health | 1.5–2.5% |
| Conversion | Avg. order value (AOV) | Bundles/subscriptions working | €45–60 |
| Retention | Repeat purchase rate | LTV engine | 25–35% |
| Retention | Subscribe & Save % of orders | Predictable revenue | 15–25% |
| Economics | Gross margin % | Pricing discipline | 55–65% |
| Economics | Contribution margin after shipping | Real profitability | Positive by month 6 |
| Brand | Reviews count / avg. rating | Trust | 200+ / 4.6★ |

**Weekly review (15 min):** sessions, top landing pages, conversion rate, orders, AOV, list growth.
**Monthly review:** keyword rankings, margin by SKU, competitor price index, retention cohort.

---

## 5. How to use this document set

1. **Don't start marketing spend until 🔴 items are cleared.** Compliance and supply are the critical path — see [07](./07-LAUNCH-ROADMAP.md).
2. Build the site ([01](./01-WEBSITE-DESIGN-PLAN.md)) and content engine ([03](./03-SEO-PLAN.md), [04](./04-CONTENT-STRATEGY-50-ARTICLES.md)) **in parallel** with supply/compliance work — content takes months to rank, so start early.
3. Treat [05](./05-COMPETITIVE-PRICING-RESEARCH.md) as a living spreadsheet, not a one-off.

> ⚠️ **Disclaimer:** These documents are strategic orientation, not legal, tax, or regulatory advice. Engage an Irish solicitor/accountant and a food-law/regulatory specialist before going to market. See [06](./06-REGULATORY-COMPLIANCE.md).
