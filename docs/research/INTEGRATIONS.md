# Integration Architecture — devices, files, reports

Researched August 2026 across six parallel streams (Fitbit/Google, Garmin,
Samsung/Renpho, aggregators, file import, file export). This is a decision
record, not a survey: one recommendation per question, and the reasoning that
produced it, so a future reader can tell a settled call from a guess.

## The dividing line

**Where the data lives**, not how modern the API is.

**Reachable today from a Convex action** (cloud-to-cloud OAuth + webhooks):
Withings, Oura, Whoop, Polar, Strava, Google Health API
(`https://health.googleapis.com/v4/`, launched 24 Mar 2026), Garmin's Health
API in principle.

**Structurally unreachable, permanently:** Apple HealthKit, Samsung Health,
Google Health Connect. These are on-device stores with no server API *by
design* — Google's own comparison guide confirms there is no cloud/REST/web
path. **No aggregator changes this.** Terra's docs state their mobile SDK is
used for exactly these three; $399/mo buys nothing here.

## Why there is no native wrapper

A Capacitor shell + Health Connect + HealthKit plugins is realistically 2–4
weeks of build, $99/yr Apple + $25 Google Play, Play Console health-data-type
declarations, store review on every release, and a permanent second build
target — against a 21-screen a11y gate and an e2e suite that both assume one
runtime. For two users that is the worst cost/benefit item available. Apple
Health is covered by file import, which is the only route a web app has anyway.

The same decision costs one thing worth naming: **iOS web push cannot carry
action buttons** (Apple allows a tap only). The "Taken" button is therefore
Android/desktop-only by platform, not by omission, and `public/sw.js` already
degrades to a deep-linked tap. See AGENTS.md on the remind slice.

## Per-vendor verdicts

| Vendor | Verdict |
|---|---|
| **Renpho** | No public API, ever. Reverse-engineered cloud client is the only automatic path. CSV export exists. |
| **Samsung Health** | Hard no for web. Android-native SDK only; no consumer cloud API. Health Connect is on-device too. |
| **Garmin** | Developer program *paused*, no reopening date, business-use-only. A two-person personal file would be refused. |
| **Fitbit** | Legacy Web API **decommissioned September 2026**. Successor is the Google Health API, which carries Fitbit/Pixel data only — not Garmin/Oura/Withings/Whoop. |
| **Aggregators** | Terra $399–499/mo, Junction $300 min, Rook $399 + $99 webhooks, Spike $450, Thryve €499. No free tier. Absurd at two users. |
| **Withings** | Open cloud API, developer-friendly. The escape hatch if the Renpho path dies (~€90 scale). |

## Phased plan

**Phase 0 — €0, no permission needed, nothing can deprecate it.**
`toMarkdown(view)` per slice (pure function, vitest-testable, no deps), a
`@media print` GP handover sheet, CSV export, Renpho CSV import, lab-PDF
import. Highest value per hour in this document.

**Phase 1 — the Renpho poller.** Port `danvaneijck/renpho-api` into a
`"use node"` Convex action + daily cron: email + AES-encrypted password,
discover scales, page measurements. It is `fetch` + `node:crypto`, so it ports
directly. **Build the CSV import first** and make the poller write through the
same parser into the same `tm_*` rows — that is what makes an unsanctioned
dependency safe to rely on.

Accept the terms honestly: unsanctioned, stores a Renpho *password* (not a
revocable token) in Convex env, and can break without notice.

**Phase 2 — one OAuth integration, only if the hardware justifies it.** If
either user wears a Fitbit or Pixel, build Google Health API (OAuth 2.0,
read-only `googlehealth.*` scopes, webhook receiver in an `httpAction`, pulls
in an `action`). If not, build nothing here.

**Phase 3 — only if a specific gap bites.** A Withings scale if Renpho breaks.
Garmin if the program reopens *and* there is a legal entity to apply as.

### Status — August 2026 build

The Connect slice (`convex/tm/sync.ts` + `logicSync.ts` + `renphoCloud.ts`,
screen at More → Connect) ships the first slice of this plan:

- **Phase 0, partly built**: body-scale CSV import (Renpho export, Samsung
  Health download, generic date/weight spreadsheets — lb→kg only where the
  header declares pounds, ambiguous dates and implausible values refused with
  reasons), InBody sheet quick-entry, per-slice CSV exports (weigh-ins,
  training, bloods, readings — BOM + ISO dates), and the `@media print` GP
  handover sheet. **Still open from Phase 0**: lab-PDF import (`unpdf` +
  per-field confirmation) and the browser-side Apple Health/Fitbit Takeout
  streaming import.
- **Phase 1, built**: the Renpho poller, ported from `danvaneijck/renpho-api`
  (AES-128-ECB envelope, login → device/count → paged measurements) as a
  `"use node"` actions-only module, twice-daily cron, writing through the
  same validation and dedupe plan as the CSV import — exactly as this
  document required. Gated on `RENPHO_EMAIL`/`RENPHO_PASSWORD`; without them
  it logs one line and records nothing. See DEPLOY.md for the owner steps.
- **Phase 2**: not started — the Restricted-scope experiment above still
  decides it.

### Rejected Renpho paths, and why

- **Renpho → Fitbit → Google Health API.** The Fitbit Web API dies September
  2026, and it is unverified whether weight *written into* Fitbit by a partner
  app is readable back out. Never build a chain with an unresolved dead end.
- **Web Bluetooth.** Apple blocks it permanently; every iOS browser is WebKit.
  An iPhone home-screen PWA can never do this.

## Unresolved — settle before writing integration code

Google OAuth refresh-token expiry under **Restricted** scopes (every Google
Health scope is Restricted). One stream held that "In production" publishing
status avoids the 7-day expiry; another held that unverified apps expire at 7
days regardless, forcing CASA assessment at $500–4,500/yr. The general
mechanism favours the first, but Restricted scopes are genuinely unresolved by
this research.

**Resolve it with a throwaway Cloud project and an 8-day wait.** It decides
whether Phase 2 is free or absurd.

## Files in

**Lab PDFs — `unpdf`, via `extractTextItems` (not `extractText`).** It bundles
PDF.js rebuilt for serverless with no native deps, so it runs in a Convex Node
action; `pdf-parse` is unmaintained and needs `canvas`, which will not load
there at all. Use the *item* API because results are tables: cluster by
y-coordinate, assign marker/value/unit by x-band. Flat text silently pairs a
marker name with the neighbouring row's number.

Route on whether a text layer exists: Medichecks/Thriva/Randox/Forth PDFs have
one (character-exact). Scans go to OCR, and **OCR values are never
auto-committed** — draft-populate with per-field confirmation showing the
cropped source region. Store `source: 'manual' | 'file-import' | 'ocr-confirmed'`
plus the originating `storageId` on every reading.

**Numeric accuracy is the real danger.** Best measured table extraction is
~97.7%: one to two wrong values per 40-marker panel, **silently**. The failure
modes look plausible — decimal placement (TSH 0.45 vs 4.5) and unit confusion
(IE/UK mmol/L vs US mg/dL is an 18× error on glucose, 29× on testosterone).
Validate every value against a physiological range **in the reported unit** and
**reject rather than coerce**. This is the "never a guess" rule applied to
imported data.

**Apple Health / Fitbit Takeout — parse in the browser, never on Convex.** Web
Worker + `fflate` streaming unzip + `sax-wasm` streaming SAX over `export.xml`,
aggregating to daily summaries as records stream past, then upload a few hundred
KB. Not a preference: exports run to hundreds of MB, the Convex upload POST
times out at 2 minutes (~150 MB on 10 Mbps mobile), the Node action ceiling is
512 MB, and **Node action arguments cap at 5 MiB**. Server-side parsing cannot
work.

Small files (FIT via `@garmin/fitsdk`, CSVs, PDFs) go to Convex storage and
parse in an action.

## Files out

**GP report — print stylesheet + `window.print()`.** 0 KB bundle, perfect
fidelity (oklch tokens and `charts.tsx` SVGs render as-is), works offline, and
on iOS the system print sheet is the only reliable "save a file" route —
`<a download>` is broken there (WebKit 167341/216918) and in standalone mode can
eject the user from the PWA entirely. `shop-tab.tsx`'s `PrintList` is the
existing pattern to copy. Convex **cannot** run headless Chrome: its bundling
docs name Puppeteer as incompatible.

**Spreadsheet — CSV, one per slice.** ~20 lines, no dependency. npm `xlsx` is
frozen at 0.18.5 with two unfixed CVEs; ExcelJS is inactive. Prepend a UTF-8 BOM
and use ISO-8601 dates, or Excel on a UK/IE locale mangles both.

**Image — `satori`/`@vercel/og`** in a Next.js route handler for a purpose-built
share card; `snapdom` if a real DOM screenshot is needed. Never `html2canvas`
(fails on oklch).

**Markdown** — a pure `toMarkdown(view)` per slice. No dependency, testable,
and the format every other tool can read.

## Deprecation watch

Anything built on these is already dead or dying: Fitbit Web API (Sept 2026),
Google Fit REST (end-2026, "no alternative"), `garth` (dead 28 Mar 2026),
`@garmin/fitsdk` `legacyArrayMode` (removed end-2026).
