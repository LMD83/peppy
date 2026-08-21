# Timento Roadmap

**Last Updated:** August 21, 2026  
**Current Status:** MVP Complete — Core Features Implemented  
**Target Audience:** Two-person performance-file users (health accountability, protocol modes, crew tracking)

**Phase 1.1 (Push Notifications) verification, Aug 21, 2026:** ran the full toolchain against
this branch rather than trusting the plan's own status claims. Result: 969/969 vitest tests,
clean typecheck, clean production build, e2e 33/33 flows × 2 viewports with 0 console errors,
and a11y 75/75 screens with 0 WCAG 2.2 AA violations — the last of those only after finding and
fixing a real, pre-existing bug (`/why`'s hero image hung the page's `load` event whenever the
Reminders tab's service worker had already taken control of the page; see
`PHASE_1_1_CHECKLIST.md` and the `src/app/why/page.tsx` commit for the root cause). Sections 1.2
(email) and part of 1.4 (touch targets) turned out to already be built — corrected below rather
than re-planned as new work.

---

## Current State

### ✅ **Completed Features** (MVP)

**Core Infrastructure**
- Two-user authentication (passcode login, session tokens, lockout protection)
- Privacy enforced at query level (crew views share only projections, never raw data)
- Demo mode with in-memory backend (no Convex required for testing)
- Convex schema with `tm_*` tables (fully normalized, deployable)

**Tab Domains** (9 screens total)
1. **Today** — Mode-aware checks (3 in survival, more in maintain/cut), kitchen-close countdown, 20:15 ritual
2. **Fuel** — Adaptive TDEE, macro targets, meal plan, fuel bank tracking
3. **Train** — Mesocycle, RIR progression, MEV/MAV/MRV volume tracking
4. **Stack** — Meds/peptides/supplements, cycles, dose adherence, reconstitution
5. **Labs** — Panels, reference vs optimal bands, trends, recheck countdown
6. **Mind** — PHQ-9/GAD-7/PSS-10/WHO-5/ISI/AUDIT-C/PACS, implementation intentions
7. **Crew** — Shared projection (adherence, streaks, mode, today score)
8. **Research** — Evidence-first craving ledger, n=1 experiments (E1–E4), disputed-marker tracking
9. **More Shelf** → Supply, Shop, Remind, Capture, Settings

**Quality Gates**
- Accessibility (WCAG 2.2 AA, 11.5px floor, no sideways scroll at 320px)
- E2E tests (click-suite across mobile 390px / 1280px desktop)
- Backend logic tests (vitest, privacy proofs for crew views)
- Convex deployability validation (module naming, "use node" isolation)

**Push Notifications** (Infrastructure complete, verified working Aug 21, 2026)
- VAPID key gating (supported: false if keys missing) ✅
- Service worker wired (`public/sw.js`) ✅
- Cron scheduler ready in `convex/crons.ts` ✅
- Tests for payload contract in place — 969/969 vitest tests pass ✅
- Email delivery already implemented alongside push (see 1.2 below) ✅
- Enable/disable toggle already in `remind-tab.tsx` (`SwitchCard`, `setReminderPrefs`) ✅
- Quiet hours already implemented in `logicRemind.ts` ✅

---

## Phase 1: Polish & Stabilization (2–3 Weeks)

### 1.1 **Push Notification Completion**
**Status:** Verified working — `npm run build`, `npx vitest run` (969/969 passing), and
`npm run typecheck` all pass cleanly on this branch as of Aug 21, 2026. Local dev setup with
generated VAPID keys is documented in `PUSH_NOTIFICATIONS_SETUP.md`.

**Remaining work (narrowed from original list — most items were already built):**
- [x] ~~Complete VAPID key setup~~ — done, keys generated + documented for dev; prod keys are a
      deploy-time secret, not an engineering task
- [ ] Test end-to-end on a **real device** (subscribe → wait for sweep or trigger manually →
      confirm notification + "Taken" button arrive) — automated e2e only covers the "cannot
      send" honesty check, not a live push round-trip, since that needs a real push service
- [x] ~~Add settings toggle~~ — already exists (`SwitchCard`, `setReminderPrefs`)
- [x] ~~Verify quiet hours~~ — already implemented in `logicRemind.ts`
- [ ] Monitor delivery metrics in prod (Convex logs) — operational, do once deployed with real
      VAPID keys
- [ ] ~~Add fallback silent notification~~ — dropped: not a real gap, the sweep already skips
      silently and logs when it cannot deliver (see `blockedLog`/`blockedReport` in
      `logicPush.ts`)

**Files to Touch:**
- `convex/tm/push.ts` (action payload)
- `convex/crons.ts` (schedule)
- `convex/tm/remind.ts` (subscription state)
- `public/sw.js` (receive + notification display)
- `src/app/_components/remind-tab.tsx` (UI for subscribe/test)

**Tests:**
- `tests/push.test.ts` (payload contract) — should already pass
- E2E: remind-tab flow (subscribe, trigger send, verify received)

---

### 1.2 **Email Notifications (Resend Integration)** — ✅ ALREADY IMPLEMENTED
**Status:** Done — verified Aug 21, 2026, corrected from initial roadmap error  
**Verification:** `convex/tm/push.ts` already sends both push AND email in the same sweep
(`if (mailer !== null && batch.email !== "")` loop). `convex/tm/logicEmail.ts` has the full
message-building, address-cleaning, and capability-detection logic (`emailConfigured`,
`emailMessage`, `emailFromEnv`). `tests/email.test.ts` covers it. The only remaining step is
operational: set `RESEND_API_KEY` in whichever environment should actually send.

**Correction note:** The original version of this roadmap listed this as "Not started" without
checking the code first. It was already built as part of the reminders feature. No further
engineering work needed — only a Resend account + API key when the team wants live email.

---

### 1.3 **Dark Mode Refinement** — ❌ NOT APPLICABLE, REMOVED
**Status:** Withdrawn — Timento has no light/dark toggle by design.  
**Verification:** `globals.css` has an unused `.dark` CSS class inherited from the original
shadcn/website-clone scaffold, but nothing in the app ever adds a `.dark` class to the DOM —
no `next-themes`, no `ThemeProvider`, no toggle in `settings-tab.tsx`. Timento's actual design
system (the `tm-*` tokens, ~50 of them) is a single fixed "ink-on-paper, plate-colour" aesthetic
per `AGENTS.md` — light paper body, dark ink header/scoreboard — already tuned and contrast-
tested for WCAG 2.2 AA (see the extensive ratio comments in `globals.css` lines 140–209, and
`tests/a11y-tokens.test.ts` which recomputes every pairing from the file).

**Correction note:** Building a light/dark toggle would work against the deliberate design and
duplicate contrast-tuning work already done for the single theme. Recommend: leave as-is, or
if truly wanted, treat as a **new design initiative** (a second full palette + re-run of the
a11y contrast suite), not a "refinement." Removed from Phase 1.

---

### 1.4 **Mobile UX Polish** — Partially done, scope narrowed
**Status:** Touch targets already correct; remaining items are smaller than first estimated  
**Verification:**
- ✅ **Touch targets** — already 44×44px per WCAG 2.5.8, with an explicit comment marking the
  fix (`today-tab.tsx:319`, "size-11 = 44×44 (2.5.8). Was size-8."). Not a gap.
- ❌ **Haptic feedback** — no `navigator.vibrate` calls anywhere in `src/app/_components/`.
  Genuine gap, but low priority: haptics need a user gesture and don't help crew accountability;
  treat as a nice-to-have, not a blocker.
- **Unverified, need live testing (not just code search):** virtual keyboard occlusion, scroll
  position recovery after modal close, tab-switching performance. These need a real device or
  Playwright + a real viewport, not a grep — pick up when doing a manual pass.

**Revised work:**
- [ ] (Optional, low priority) Add `navigator.vibrate(10)` on check completion, iOS/Android only
- [ ] Manual pass: virtual keyboard occlusion on iOS Safari + Android Chrome
- [ ] Manual pass: scroll position after closing a modal (today-tab, stack-tab)
- [ ] Profile tab-switching in `app.tsx` only if a real perf complaint surfaces — no evidence of
      a problem yet, don't optimize speculatively

**Files:**
- `src/app/_components/today-tab.tsx`
- `src/app/_components/app.tsx` (tab switching)

**Correction note:** The original entry assumed touch targets needed work; the codebase already
fixed this with a WCAG-citing comment. Scope narrowed to the two items that are real gaps.

---

## Phase 2: Data Richness & Insights (3–4 Weeks)

**Audited against the actual code Aug 21, 2026** (an Explore agent read every file listed as
evidence below) before writing new code, since Phase 1 found several "not started" items were
already built. Same pattern here: of the ~15 original sub-items, 3 were already fully built, 1
was partially built, and 1 (goal-date projection) has now been built and shipped this session.
The rest are corrected to genuinely NOT STARTED below, with file:line evidence, not vibes.

### 2.1 **Trends & Analytics**
**Status:** Mixed — corrected per sub-item below, one item shipped this session.
- [x] **Zone shading on lab charts** — ALREADY BUILT. `logicLabs.ts:56-78` (`flagFor`, reference +
      optimal bands) rendered as real SVG shading in `RangeBar()`, `labs-tab.tsx:378-408`
      (`fill-tm-green-faint` reference band, `fill-tm-green-mid` optimal band). The roadmap had
      this listed as unbuilt; it was not.
- [x] **Predictive caution ("at this rate, goal in X days")** — SHIPPED this session. Added
      `projectGoal()` to `convex/tm/logic.ts`, reusing the existing `weightSlopeKgPerWeek()` fit
      from `logicFuel.ts`. Renders on the Trend screen (Body → Trend). 976/976 tests, e2e, and
      a11y all verified green after the change — see the commit on this branch for detail.
- [~] **Trend line direction badges** — PARTIALLY BUILT. Fully live for Labs
      (`logicLabs.ts:100-123` `deltaFor()`, rendered via `DIRECTION_MARK` in `labs-tab.tsx:344`).
      Not built for Fuel (the slope exists at `logicFuel.ts:175-191` but isn't shown as a badge
      anywhere) or Train/Mind (no slope calc exists there at all). Real remaining work: extend
      the already-proven Labs pattern to Fuel first (data's already computed), Train/Mind would
      need a new slope calc each.
- [ ] **7/14/30-day rolling views (Fuel/Train/Labs/Mind)** — genuinely NOT STARTED. No
      `tm.trends.get`-style query exists; `progress.ts` pulls a fixed 180-day window with no
      range param, `logicLabs.ts`'s `MAX_TREND_POINTS=12` is draw-count-based not day-range-based.
- [ ] **Variance metrics (CV, std dev)** — genuinely NOT STARTED. No such calc anywhere in
      `logicFuel.ts`/`logicTrain.ts`/`logicLabs.ts`.
- [ ] **CSV/PDF export** — genuinely NOT STARTED. The only "export"-shaped code in the repo is
      CSV *import* for lab uploads (`labs-tab.tsx:490-598`); no outbound export exists.

---

### 2.2 **Crew Insights**
**Status:** Architecture mismatch — the roadmap imagined the wrong model. Corrected below.

**The real architecture, read from `convex/tm/crew.ts` (314 lines) and `logicConsent.ts`:** this
is not the simple two-person comparison the original roadmap assumed. It's a general N-user,
per-scope consent system — invite/accept/revoke links, `scopes: adherence | supply`,
`relationship: crew | carer`, a roster, and per-scope projection through `projectMember()` so an
ungranted scope costs zero reads, let alone gets leaked. `crew.ts:26-41`'s own comment explains
this replaced an earlier version that leaked adherence data to anyone signed in — any new
"insight" feature has to go *through* `projectMember`, never bypass it, or it reopens exactly
that leak.

- [x] **Crew message board** — ALREADY BUILT, just under a different name. `crew.ts:183-214`
      (`feed` query + `nudge` mutation, scoped to consented counterparts only), rendered in
      `crew-tab.tsx:64,369-417`. The roadmap called this "not started" — it's shipped.
- [ ] **Duality score / streak parity / protocol alignment / crew goal sync** — genuinely NOT
      STARTED, all four. The underlying per-member data (`mode`, `streak`, `adherence7`,
      `daysInMode`) is already exposed per-scope in `MemberFacts` (`crew.ts:120-137`), so any of
      these would be a *derived view* over data already flowing through consent, not new
      plumbing — the real work is designing what's worth showing, then computing it inside
      `projectMember`'s existing scope boundary.

**Files (if picked up):** `convex/tm/crew.ts`, `convex/tm/logicConsent.ts` (extend, don't
bypass), `src/app/_components/crew-tab.tsx`.

---

### 2.3 **Research Mode Enhancement**
**Status:** More built than the roadmap said, evidence-strength labels are the real gap.
- [x] **Craving trigger map UI** — ALREADY BUILT. `logic.ts:57-68` (`buildTriggerMap`),
      `research.ts:12-25`, rendered live via `<TriggerMap>` + engine read-out in
      `research-tab.tsx:30-41`. The roadmap listed this as work to do; it already ships.
- [ ] **Evidence-strength labels (r=, p-value, n=, CI)** — genuinely NOT STARTED. `classifyEngine`
      (`logic.ts:73-84`) and `findPeak` (`logic.ts:86-102`) produce a share % and a dominant-signal
      label, not a statistical estimate — there is no r/p/CI anywhere in `convex/tm/*.ts`. Given
      the product's own invariant ("evidence strength is labelled wherever a claim is made"),
      this is worth prioritizing over the fancier items below — but a fabricated p-value from an
      n=1 experiment would be worse than none; needs real thought on what's honestly claimable
      from a two-person, self-tracked dataset before building it.
- [ ] **Experiment templates** — NOT STARTED. `research.ts:27-41` only reads the static,
      fixture-seeded `tm_experiments` table; no template catalogue or "start from template"
      mutation exists.
- [ ] **Cohort comparison view** — NOT STARTED. `research-tab.tsx:44-61` lists experiments
      individually; no side-by-side view.
- [ ] **Disputed-marker resolution workflow (vote/note/archive)** — NOT STARTED. `research.ts`
      only reads `tm_markers`; status is display-only, no mutation exists to resolve one.
- [ ] **Shareable research summary** — NOT STARTED. No share-link or export logic anywhere in
      `research.ts`/`research-tab.tsx`.

**Files (if picked up):** `convex/tm/research.ts`, `convex/tm/logic.ts` (evidence calcs),
`src/app/_components/research-tab.tsx`.

---

## Phase 3: Integrations & Ecosystem (4–6 Weeks)

### 3.1 **Apple HealthKit / Google Fit Sync**
**Status:** Not started  
**Rationale:** Pull body composition, steps, sleep, HR data into labs/trend views  
**Work:**
- [ ] Design data model for synced health data (separate from user-entered data)
- [ ] Implement OAuth flow for HealthKit (iOS) + Google Fit (Android)
- [ ] Create background sync (daily, runs every 6 AM)
- [ ] Add data reconciliation UI (user can override synced value or accept as-is)
- [ ] Show "auto-logged" vs "manual" badge on each data point
- [ ] Test in dev with mock health data, prod with staging credentials

**Files:**
- `convex/tm/ingest.ts` (add healthkit/googlefit queries)
- `convex/tm/logicIngest.ts` (data merge logic)
- `src/app/_components/labs-tab.tsx` (sync status UI)
- `convex/tm/fixtures/ingest.ts` (mock data)

**Queries:**
- `tm.ingest.healthKit.status()` → permission state, last sync
- `tm.ingest.healthKit.sync()` (action)

---

### 3.2 **Wearable Integration (Whoop, Oura, Fitbit)**
**Status:** Not started  
**Rationale:** HRV, recovery, sleep score as contextual input for mode decisions  
**Work:**
- [ ] Add wearable data model to schema (`tm_wearable_sync` table)
- [ ] Implement OAuth for Whoop API (start here — most structured data)
- [ ] Add background job to pull HRV + recovery daily
- [ ] Show wearable-informed "readiness to train" badge on Today tab
- [ ] Warn if recovery low but mode is CUT (aggressive protocol)
- [ ] Add Oura, Fitbit integrations after Whoop is stable

**Files:**
- `convex/schema.ts` (tm_wearable_sync table)
- `convex/tm/ingest.ts` (wearable queries)
- `convex/tm/logicIngest.ts` (sync + reconcile)
- `src/app/_components/today-tab.tsx` (readiness badge)

---

### 3.3 **Email Digest & Weekly Summary**
**Status:** Not started  
**Rationale:** Async check-in for users who miss notifications  
**Work:**
- [ ] Create weekly digest email template (trends, achievements, crew parity, action items)
- [ ] Add Convex cron to send every Sunday 9 AM local time
- [ ] Include 1 chart (best performer metric that week)
- [ ] Add digest settings (weekly vs daily vs off, preferred day/time)
- [ ] Implement unsubscribe link + 1-click resubscribe

**Files:**
- `convex/crons.ts` (add weekly digest cron)
- `convex/tm/push.ts` (add digest action)
- `src/app/_components/settings-tab.tsx` (digest prefs UI)

---

## Phase 4: Advanced Features (6–8 Weeks)

### 4.1 **Adaptive Protocol Engine**
**Status:** Not started  
**Rationale:** AI-suggested mode progression (CUT → MAINTAIN → SURVIVAL) based on compliance + adherence data  
**Work:**
- [ ] Implement decision model: if adherence <60% for 7 days, suggest SURVIVAL mode
- [ ] Add "protocol recommendation" card to Today tab (why? when? commit?)
- [ ] Create mode transition UI with pre-written responses (crew confirms together)
- [ ] Log all decisions in `tm_decision_log` (audit trail)
- [ ] Add decision explainer to Research tab (why did we switch modes?)

**Files:**
- `convex/tm/logicEasy.ts` (add protocol recommendation logic)
- `convex/tm/today.ts` (add recommendation query)
- `src/app/_components/today-tab.tsx` (UI for recommendation)

---

### 4.2 **Macro Intelligence (Carb Cycling, Refeed Timing)**
**Status:** Not started  
**Rationale:** Suggest macro shifts based on mode, HRV recovery, and training stimulus  
**Work:**
- [ ] Implement carb cycle template (base, training day, refeed day carbs)
- [ ] Add refeed-timing suggestion (highest carbs on hardest training day)
- [ ] Calculate daily deficit vs training volume (MEV/MAV/MRV)
- [ ] Add macro flexibility (user can tweak ±10% without breaking plan)
- [ ] Show adherence to macro targets vs settings (drift detection)

**Files:**
- `convex/tm/logicFuel.ts` (add carb cycle logic)
- `convex/tm/fuel.ts` (add carb cycle query)
- `src/app/_components/fuel-tab.tsx` (carb cycle builder UI)

---

### 4.3 **PHQ-9 & Mental Health Escalation**
**Status:** Partial (PHQ-9 exists, escalation minimal)  
**Rationale:** Non-diagnostic, but clear escalation path for serious responses  
**Work:**
- [ ] If Q9 (self-harm) ≥2 or total ≥20, show resource banner + support hotlines
- [ ] Add "check-in" reminder if GAD-7 stays >15 for 3+ weeks
- [ ] Implement mood tracking over time (PHQ-9 trends, detect worsening)
- [ ] Create private journal for mental health notes (encrypted, crew can't see)
- [ ] Add mood-training correlation (is harder training → worse mood?)

**Files:**
- `convex/tm/mind.ts` (add escalation logic)
- `convex/tm/logicMind.ts` (mood trend calc)
- `src/app/_components/mind-tab.tsx` (escalation UI, resource links)

---

### 4.4 **Accountability Agents (AI Coaching)**
**Status:** Not started  
**Rationale:** Optional AI-driven nudges + reflection prompts based on protocol adherence  
**Work:**
- [ ] Integrate Claude API for structured reflection prompts
- [ ] Add daily "intention setter" (AI suggests focus for the day)
- [ ] Implement "why did you miss?" smart reply (if check skipped)
- [ ] Add AI-generated weekly summary of insights + progress
- [ ] Create "voice note" input for reflection (transcribe + summarize)
- [ ] Gate behind opt-in + clear data privacy notice (Claude does not store data)

**Files:**
- `convex/tm/ai.ts` (new — Claude API actions)
- `convex/tm/logicAi.ts` (prompt engineering)
- `src/app/_components/today-tab.tsx` (intention UI)
- `src/app/_components/research-tab.tsx` (AI summary)

**API:**
- Convex + Claude API (Anthropic SDK)

---

## Phase 5: Scale & Monetization (8+ Weeks)

### 5.1 **Multi-User Crews** (Optional)
**Rationale:** Current: 2 people. Consider: 3–4 person teams (small crew cohorts)?  
**Work:**
- [ ] Extend schema to support >2 users per crew
- [ ] Add crew invite flow (passcode share or email link)
- [ ] Implement voting on crew decisions (mode changes, protocol experiments)
- [ ] Add crew roles (coach, athlete, observer)
- [ ] Privacy still enforced: crew sees projections only

**Risk:** Significantly more complex — recommend shipping single/dual-user MVP first.

---

### 5.2 **Coach Collaboration Mode** (Optional)
**Rationale:** Athletes bring their coach into read-only view to review progress  
**Work:**
- [ ] Create "share with coach" link (UUID-based, password-protected)
- [ ] Coach view shows: trends, adherence, recent entries (but not crew data)
- [ ] Coach can add comments (in-app or email digest)
- [ ] Athlete sees coach feedback in Research tab

**Risk:** Privacy/liability — needs legal review before shipping.

---

### 5.3 **Subscription Tiers** (Post-MVP)
**Rationale:** Free tier (basic Today + Crew), Paid (all features + API access)  
**Work:**
- [ ] Add Stripe subscription management
- [ ] Implement feature flags by tier (`premium_features`)
- [ ] Lock advanced tabs behind paywall (Fuel detail, Mind trends, Export)
- [ ] Add onboarding upsell
- [ ] Implement trial period (14 days free)

---

## Not Roadmapped (Out of Scope)

- **AI Diagnosis/Prescription:** The app tracks, scores, and correlates — it never diagnoses or prescribes. Stays out of liability.
- **Wearable Hardware:** No custom devices — integrations only.
- **Mobile App Native Compilation:** PWA is sufficient for now.
- **Offline-First Sync:** Convex handles this; we assume online.
- **Multi-language Support:** Ship English-first.

---

## Success Metrics

### By Phase Completion:

| Phase | Metric | Target |
|-------|--------|--------|
| **1** | Push delivery rate | >95% |
|       | Email open rate | >40% |
|       | A11y score | 100 (21 screens, both modes) |
|       | Mobile CLS (cumulative layout shift) | <0.1 |
| **2** | Trends page load | <1s |
|       | Crew view engagement | >80% weekly check-ins |
|       | Research export count | >10 exports/month |
| **3** | HealthKit sync adoption | >30% of users |
|       | Wearable integration MAU | >20% |
|       | Email digest unsubscribe rate | <10% |
| **4** | Protocol recommendation acceptance | >50% |
|       | Mental health escalation test | 1 real escalation verified |
|       | AI coach feature satisfaction | NPS >40 |
| **5** | Paid subscribers | >500 |
|       | Coach collaboration usage | >100 active coaches |

---

## Technical Debt & Maintenance

- **Convex Schema Migrations:** Plan v2 when schema breaks (likely in phase 3 with wearable data).
- **Dependency Updates:** Keep Next.js 16+, React 19+, Tailwind 4+ current.
- **E2E Tests:** Add new flow for each feature. Current: Today, Crew, basic checks.
- **Performance:** Monitor Convex function cold starts; add edge caching if >500ms seen.
- **Accessibility:** A11y is a gate — any new feature must pass WCAG 2.2 AA before merge.

---

## Next Immediate Steps (Week of Aug 21–27)

1. **Branch Setup:** Work in `claude/timento-roadmap-mln0iq`
2. **Push Notifications:** Complete VAPID setup + test end-to-end (1–2 days)
3. **Email Notifications:** Add Resend trigger logic (1 day)
4. **Dark Mode Testing:** Run a11y suite, fix violations (1 day)
5. **Mobile UX Review:** Haptic feedback, touch targets, scroll (1–2 days)
6. **Create PRs & Merge:** Collect small wins into 1–2 PRs by end of week

**Commit frequency:** Small, focused commits per feature — aim for 2–3 commits/day during Phase 1.

---

## Questions for Product Clarification

- **Crew invite:** Email link vs passcode share? (Current: passcode only)
- **Coach mode:** Ship v1, or defer until proven need?
- **Subscription timing:** After Phase 2 or 3?
- **Mental health escalation scope:** Only PHQ-9 Q9, or add PSS-10 threshold?
- **AI coaching:** Claude API keys management (env var per deployment)?

---

**Created by:** Claude Code  
**Branch:** `claude/timento-roadmap-mln0iq`  
**Status:** Ready for review + prioritization
