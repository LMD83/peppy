# 03 — SEO Plan

> Objective: rank on **Google.ie page 1** for commercial and informational sports-nutrition terms in Ireland, on a lean budget, by combining technical excellence, strong on-page, an E-E-A-T-credible content engine, and patient link-building.
> Related: [01 Website](./01-WEBSITE-DESIGN-PLAN.md) · [04 Content](./04-CONTENT-STRATEGY-50-ARTICLES.md) · [06 Compliance](./06-REGULATORY-COMPLIANCE.md)

---

## 1. Reality check & strategy

- SEO is a **3–9 month** compounding play. Start **day one** — it's the cheapest scalable channel and the core of the lean strategy.
- You're competing against **scaled UK sites (MyProtein, Bulk, Protein Works)** that often outrank Irish sites even on `.ie` searches. **You will not beat them on head terms quickly.** Win by:
  1. **Localisation** — be unambiguously the best result *for Ireland* (`.ie` relevance, local content, fast IE delivery info).
  2. **Long-tail & low-difficulty first** — capture "quick win" keywords competitors ignore (see [04](./04-CONTENT-STRATEGY-50-ARTICLES.md)).
  3. **Topical authority** — own clusters so deeply Google sees you as *the* sports-nutrition authority in Ireland.
  4. **E-E-A-T** — this is **YMYL** (health). Credibility signals are ranking factors, not nice-to-haves.

---

## 2. Keyword research methodology (free / cheap tooling)

1. **Seed list** from products + customer language (protein, whey, creatine, pre-workout, BCAA, mass gainer, vegan protein, fat burner, electrolytes…).
2. **Google autosuggest + "People Also Ask" + related searches** on Google.ie — mine for long-tail and questions.
3. **Google Search Console** (once live) — your single most valuable tool: shows real queries you're impressed/clicked for; double down on page-2 keywords (positions 11–20) — the fastest wins.
4. **Google Keyword Planner** (free with an Ads account) — volume ranges + Ireland geo filtering.
5. **AnswerThePublic / AlsoAsked** — question mapping for informational content.
6. **Competitor SERP mining** — see what IE-targeting pages rank; identify gaps. A low-cost tool (**Mangools/KWFinder, Ubersuggest, or Ahrefs Lite**) helps with difficulty scores when affordable.
7. **Score & prioritise** each keyword by: Ireland relevance × intent value × (low) difficulty × volume. Quick wins = decent volume + low difficulty + commercial-adjacent.

> Map keywords to page types: **head/category → collections**, **product/brand → PDPs**, **questions/how-to → blog**. One primary keyword per page; no two pages target the same term (avoid cannibalisation).

---

## 3. Ireland-specific targeting

- **Domain:** a **`.ie`** domain is a strong local trust + relevance signal for Irish searches (and aligns with the "Irish brand" positioning). A `.com` can rank in IE but a `.ie` reinforces local intent. Recommend **`.ie`** as primary.
- **Geotargeting:** set country target in Search Console if on a generic domain; `.ie` is auto-associated with Ireland.
- **hreflang:** only needed if you run multiple locale versions (e.g. an `/en-gb` for UK). At launch, single `en-IE` site — keep it simple.
- **Local signals:** Irish address + phone in footer & schema, **Google Business Profile** (even as online-first — get verified), prices in **€**, Irish spelling, mentions of Irish cities/delivery, Irish-relevant content (GAA, Irish gyms, local events).
- **Beating UK sites:** emphasise *for Ireland* in titles/H1s/content ("…in Ireland", "next-day Irish delivery", "no customs charges"). Content that's explicitly Irish out-relevances generic UK pages for IE intent.

---

## 4. Technical SEO

- **Crawlable architecture:** flat IA (≤3 clicks), logical internal linking, HTML links (not JS-only).
- **Core Web Vitals:** LCP <2.5s, INP <200ms, CLS <0.1 — see perf section in [01](./01-WEBSITE-DESIGN-PLAN.md). Critical on mobile.
- **Indexation hygiene:**
  - `robots.txt` + **XML sitemaps** (separate sitemaps for products, collections, blog; submit in Search Console).
  - **Canonical tags** on every page; product variants canonicalise to the main product URL.
  - **Faceted navigation control:** filter/sort URL combinations → `noindex` or canonical to the base collection to avoid index bloat & duplicate content. Allow indexing only of valuable filtered pages that have search demand (e.g. "vegan protein").
  - Avoid thin/duplicate collection pages; ensure each indexable page has unique copy.
- **HTTPS**, clean URL structure (`/collections/whey-protein`, `/products/{handle}`, `/blog/{slug}`), 301 redirects managed, no broken links/404 chains.
- **Mobile-first** (Google indexes mobile).
- **Pagination**: sensible handling on PLPs/blog (self-referencing canonicals, crawlable next links).

### Structured data (JSON-LD)
| Page | Schema |
|------|--------|
| Product / PDP | `Product`, `Offer` (price, availability, `priceCurrency: EUR`), `AggregateRating`, `Review` |
| Collection | `BreadcrumbList`, optionally `ItemList` |
| Article | `Article`/`BlogPosting` (author, datePublished, reviewer) |
| FAQ blocks | `FAQPage` |
| Site-wide | `Organization` (logo, sameAs socials), `WebSite` (+ Sitelinks Searchbox), `BreadcrumbList` |

> Valid review/product schema can earn ⭐ rich results — big CTR lift on commercial SERPs.

---

## 5. On-page framework

**Templates (one primary keyword each):**
- **Collection title:** `Whey Protein Ireland | Informed-Sport Tested | [Brand]`
- **Collection H1:** `Whey Protein` + unique 100–200-word intro (compliant, keyword-natural).
- **PDP title:** `[Product Name] – [key benefit/spec] | [Brand]`
- **Article title:** lead with the keyword/question, add an angle: `How Much Protein Do You Need to Build Muscle? (Ireland Guide)`
- **Meta descriptions:** unique, benefit + CTA, ~150 chars; include the keyword.
- **Headings:** one H1; logical H2/H3 with semantic keywords; descriptive, not clever.
- **Internal links:** every article links to relevant collections/PDPs (money pages) and sibling articles; collections link to top products and pillar guides.
- **Images:** descriptive alt text, compressed, named sensibly.

---

## 6. E-E-A-T for YMYL (do not skip — this is health)

Google holds health/"Your Money or Your Life" content to a higher trust bar. Build:
- **Authorship:** real author bios with credentials (e.g. nutritionist, dietitian, qualified PT). Reviewer line on health content ("Medically/Nutritionally reviewed by …").
- **Citations:** link claims to reputable sources (PubMed, EFSA, Sport Ireland, peer-reviewed studies).
- **Accuracy & compliance:** only authorised health claims; clear disclaimers (see [06](./06-REGULATORY-COMPLIANCE.md)). Misleading health claims hurt rankings *and* are illegal.
- **Trust signals site-wide:** about page, real contact details, Irish business identity, transparent policies, reviews, secure checkout, Informed Sport.
- **Freshness:** update cornerstone content periodically (show "last updated").

---

## 7. Off-page / link building (lean budget)

Authority (links) is often the deciding factor vs. UK competitors. Tactics that don't need big spend:
1. **Digital PR / founder story** — "Irish alternative to UK supplements", local-jobs/Irish-made angle → pitch Irish press, business & fitness blogs for earned links.
2. **Local & niche directories** — Irish business directories, fitness/supplement directories, gym partner pages.
3. **Partnerships** — gyms, CrossFit boxes, clubs, coaches: sponsorships/affiliate → natural backlinks from their sites.
4. **Guest posts / expert contributions** — Irish fitness blogs, podcasts, nutrition sites.
5. **HARO-style / journalist requests** — provide expert quotes (Qwoted, Featured, ResponseSource) → authoritative links.
6. **Linkable assets** — original data, calculators (protein-needs calculator), in-depth Irish guides → things people cite.
7. **Reclaim unlinked mentions** once the brand has buzz.

> Prioritise **relevance + Irish/local + authority** over volume. A few good IE/fitness links beat hundreds of spammy ones (which can harm you).

---

## 8. Internal linking model (ties to content strategy)

- **Pillar pages** (broad guides) ↔ **cluster articles** (specific) ↔ **money pages** (collections/PDPs).
- Each cluster article links up to its pillar and across to 2–4 siblings + the most relevant product/collection.
- Collections link to their pillar guide ("New to protein? Read our guide") and bestsellers.
- This concentrates topical authority and passes equity to commercial pages. Full map in [04](./04-CONTENT-STRATEGY-50-ARTICLES.md).

---

## 9. Measurement & cadence

| Cadence | Review |
|--------|--------|
| Weekly | Search Console: new queries, position 11–20 opportunities, CTR, indexation/coverage errors |
| Monthly | Rank tracking (target keywords, IE), organic sessions & revenue, new backlinks, CWV |
| Quarterly | Content audit (update/prune), cannibalisation check, competitor gap re-scan |

**90-day SEO checklist:** domain + GSC + GA4 live · sitemaps submitted · all templates have unique titles/meta · structured data validated · 6–10 quick-win articles published & internally linked · GBP verified · first 5–10 quality backlinks earned.
