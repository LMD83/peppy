# Timento Roadmap

**Last Updated:** August 21, 2026  
**Current Status:** MVP Complete — Core Features Implemented  
**Target Audience:** Two-person performance-file users (health accountability, protocol modes, crew tracking)

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

**Push Notifications** (Incomplete — Infrastructure Ready)
- VAPID key gating (supported: false if keys missing)
- Service worker wired (`public/sw.js`)
- Cron scheduler ready in `convex/crons.ts`
- Tests for payload contract in place

---

## Phase 1: Polish & Stabilization (2–3 Weeks)

### 1.1 **Push Notification Completion**
**Status:** 90% done (keys missing in dev)  
**Work:**
- [ ] Complete VAPID key setup (dev/staging/prod)
- [ ] Test end-to-end: subscribe → send → receive → payload contract validation
- [ ] Add settings toggle to enable/disable remind notifications
- [ ] Verify quiet hours respect in `convex/tm/push.ts`
- [ ] Monitor delivery metrics in prod (Convex logs)
- [ ] Add fallback silent notification if user not in browser

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

### 1.2 **Email Notifications (Resend Integration)**
**Status:** Not started  
**Rationale:** Emails as async fallback for critical alerts (self-harm, overdue rechecks, streaks at risk)  
**Work:**
- [ ] Define trigger rules in `logicRemind.ts` (e.g., PHQ-9 Q9 ≥2 → send to support emails)
- [ ] Create email template in Resend (clean, branded, minimal)
- [ ] Add Convex action in `convex/tm/push.ts` to send via Resend (action-only, not query)
- [ ] Hook email sending into `remind.ts` mutations
- [ ] Add RESEND_API_KEY to env + prod secrets
- [ ] Test in dev (Resend sandbox) + staging

**Files:**
- `convex/tm/logicRemind.ts` (trigger rules)
- `convex/tm/push.ts` (add Resend action)
- `src/app/_components/remind-tab.tsx` (test send UI)

---

### 1.3 **Dark Mode Refinement**
**Status:** Partial (tokens exist, not all tested)  
**Work:**
- [ ] Run a11y suite in dark mode across all 21 screens → fix any contrast violations
- [ ] Verify chart colors are readable in both modes (oklch tokens in `globals.css`)
- [ ] Test SVG axis labels (axisFontSize calculations) in dark mode
- [ ] Add dark-mode toggle to settings → persist to localStorage
- [ ] Verify opacity + contrast rule (any container opacity <1.0 should be checked)

**Files:**
- `src/app/globals.css` (tm-* tokens)
- `src/app/_components/charts.tsx` (axisFontSize)
- `src/app/_components/ui.tsx` (dark mode toggle)
- `tests/a11y-floor-guard.test.ts` (add dark mode run)

---

### 1.4 **Mobile UX Polish**
**Status:** Core flows work, but edge cases remain  
**Work:**
- [ ] Add haptic feedback on check completion (iOS)
- [ ] Improve touch targets (ensure ≥44px on mobile)
- [ ] Test virtual keyboard behavior (inputs don't get occluded)
- [ ] Add pull-to-refresh on Today tab (crew mode)
- [ ] Verify scroll position recovery after modal close
- [ ] Test tab switching performance (lazy load expensive tabs?)

**Files:**
- `src/app/_components/today-tab.tsx`
- `src/app/_components/app.tsx` (tab switching)

---

## Phase 2: Data Richness & Insights (3–4 Weeks)

### 2.1 **Trends & Analytics**
**Status:** Not started  
**Work:**
- [ ] Add 7/14/30-day rolling views to Fuel, Train, Labs, Mind tabs
- [ ] Implement trend line (linear regression) on charts → show ↑/↓ direction badges
- [ ] Add zone shading (reference band, optimal band, caution band on labs charts)
- [ ] Show variance metrics (CV, std dev) on macro trends
- [ ] Add predictive caution: "at this rate, goal in X days"
- [ ] Implement data export (CSV, PDF of monthly summary)

**Files:**
- `convex/tm/logicFuel.ts`, `logicTrain.ts`, `logicLabs.ts` (add trend calcs)
- `src/app/_components/charts.tsx` (chart types: trend lines, zones)
- `src/app/_components/research-tab.tsx` (export UI)

**Queries to Add:**
- `tm.trends.get(slice: 'fuel' | 'train' | 'labs', range: 7 | 14 | 30)`

---

### 2.2 **Crew Insights**
**Status:** Not started  
**Rationale:** Two-person context → accountability data, not comparison  
**Work:**
- [ ] Add "duality score" (how often do both users check on the same day?)
- [ ] Show "streak parity" (when did one user's mode-adherence streak diverge from the other?)
- [ ] Add protocol alignment view (both in same mode? days matched?)
- [ ] Implement crew message board (shared decision log, private to crew only)
- [ ] Add crew goal sync (both users set a training block together?)

**Privacy Rule:** Crew board shows only projections (adherence %, streak days, mode), never:
- Exact weights, labs values, food choices, exercise details
- Raw check times or completion diffs
- PHQ-9 scores or mental health data

**Files:**
- `convex/tm/crew.ts` (add crew.insights query)
- `convex/tm/logicCrew.ts` (new — crew-level metrics)
- `src/app/_components/crew-tab.tsx` (new insights section)

---

### 2.3 **Research Mode Enhancement**
**Status:** 60% done (ledger + E1–E4 exist, needs UI polish)  
**Work:**
- [ ] Add experiment templates (sleep experiment, supplement test, protocol variance)
- [ ] Implement cohort comparison view (E1 vs E2 vs E3 outcomes)
- [ ] Add evidence-strength labels on all correlations (r=, p-value, n=, CI)
- [ ] Implement craving trigger map UI (visual 2x2: depletion/emotion/cue/mixed)
- [ ] Add disputed-marker resolution workflow (vote, note, archive)
- [ ] Create shareable research summary (PDF or shareable link with password)

**Files:**
- `convex/tm/research.ts` (add templates query)
- `convex/tm/logicEasy.ts` (add evidence strength calculations)
- `src/app/_components/research-tab.tsx` (UI overhaul)

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
