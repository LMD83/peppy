# Phase 1.1: Push Notification Completion — Implementation Checklist

**Roadmap Phase:** 1 (Polish & Stabilization)  
**Task:** 1.1 Push Notification Completion  
**Estimated Effort:** 2–3 days  
**Priority:** HIGH (core feature, infrastructure ready)  
**Branch:** `claude/timento-roadmap-mln0iq`

---

## Overview

Push notifications infrastructure is **90% complete**. The three-part system is wired:

- ✅ **Backend schedule** (`convex/crons.ts`) — Runs every 30 minutes
- ✅ **Delivery engine** (`convex/tm/push.ts`) — Sends via web-push + Resend email
- ✅ **Service worker** (`public/sw.js`) — Receives & displays notifications
- ✅ **Tests** (`tests/push.test.ts`) — Payload/worker contract validated

**Blockers:** None. Setup just requires:
1. VAPID key generation (5 min)
2. Local testing (15 min)
3. E2E & a11y verification (5 min)
4. Resend email optional (10 min if adding)

---

## Work Breakdown

### **1.1.1: Local Development Setup** (1 hour)

**Objective:** Enable developers to test push notifications locally without needing prod credentials.

#### Tasks:

- [ ] **1.1.1.1 — Generate VAPID keys**
  - Run `npx web-push generate-vapid-keys`
  - Document keys somewhere safe (not in git)
  - Keys should be unique per environment (don't share dev/prod)
  - **Files:** `.env.local` (not committed — documented in `.env.example`)

- [ ] **1.1.1.2 — Test env setup**
  - Copy `.env.example` to `.env.local`
  - Add VAPID keys + VAPID_SUBJECT
  - Verify `npm run dev` starts without warnings
  - Check Convex dashboard shows VAPID keys loaded
  - **Files:** `.env.local` (local only)
  - **Verification:** `npm run dev` output shows "Convex deployment ready"

- [ ] **1.1.1.3 — Verify Service Worker registration**
  - Load the app in browser
  - DevTools → Application → Service Workers
  - Should see `sw.js` registered with status "activated"
  - Check version shows `timento-sw-3`
  - **Files:** `public/sw.js`, `src/app/_components/remind-tab.tsx`

**Acceptance Criteria:**
- `npm run dev` starts cleanly
- App loads Reminders tab
- Tab shows "Service Worker: ready" ✓
- SW registered in DevTools with correct version
- No console errors about VAPID or service worker

---

### **1.1.2: Subscription Flow Testing** (1 hour)

**Objective:** Verify users can subscribe to push notifications and subscription is stored.

#### Tasks:

- [ ] **1.1.2.1 — Request notification permission**
  - Reminders tab → Click "Turn on reminders"
  - Browser prompts for notification permission
  - Accept permission
  - Check `tm_pushSubscriptions` table has 1 new row
  - **Files:** `src/app/_components/remind-tab.tsx`, `convex/tm/remind.ts`
  - **Verification:** Convex dashboard → `tm_pushSubscriptions` table

- [ ] **1.1.2.2 — Store subscription correctly**
  - Verify row has:
    - `userId` (current user)
    - `endpoint` (browser push service URL)
    - `p256dh` (encryption key)
    - `auth` (auth secret)
    - `subscribedAt` timestamp
  - **Files:** `convex/schema.ts` (check `tm_pushSubscriptions` schema)
  - **Verification:** Inspect row in dashboard

- [ ] **1.1.2.3 — Show subscription status in UI**
  - After subscription succeeds, Reminders tab shows:
    - "Reminders are on" ✓
    - Service Worker version (e.g., "timento-sw-3")
    - Last subscription time
    - "Turn off reminders" button appears
  - **Files:** `src/app/_components/remind-tab.tsx`
  - **Verification:** UI displays all fields correctly

- [ ] **1.1.2.4 — Handle unsubscribe**
  - Click "Turn off reminders"
  - Subscription removed from `tm_pushSubscriptions`
  - UI updates to "Turn on reminders" button
  - **Files:** `src/app/_components/remind-tab.tsx`, `convex/tm/remind.ts`
  - **Verification:** Row deleted from table, UI updates

**Acceptance Criteria:**
- Subscription created in DB after permission granted
- Subscription row has all required fields
- UI correctly shows "on/off" status
- Unsubscribe removes row from DB

---

### **1.1.3: Test Delivery Flow** (1 hour)

**Objective:** Verify notifications are sent when due and arrive on device.

#### Tasks:

- [ ] **1.1.3.1 — Manual sweep trigger**
  - Method 1: Wait 30 min for cron to run
  - Method 2: Use Convex dashboard → Run function `internal.tm.push.sweep`
  - Check Convex logs show delivery attempt
  - Look for log: "sent: X, notifications: Y, users: Z"
  - **Files:** `convex/crons.ts`, `convex/tm/push.ts`
  - **Verification:** Convex logs show sweep execution

- [ ] **1.1.3.2 — Create a test reminder (manual)**
  - Insert test data into `tm_reminders` or similar
  - Or modify a user's check settings to trigger a reminder
  - Run sweep again
  - Verify notification is included in delivery
  - **Files:** `convex/tm/remind.ts` (planReminders logic)
  - **Verification:** Sweep logs show notification sent

- [ ] **1.1.3.3 — Verify notification arrives on lock screen**
  - When sweep runs (either manually or on cron):
    - Notification should appear in browser notification center
    - Or on Android lock screen
    - Or in macOS notification center
  - Title: Correct (e.g., "Time for your morning dose")
  - Body: Correct (from reminder text)
  - Tag: Ensures duplicates replace (not stack)
  - **Files:** `public/sw.js` (notification display), `convex/tm/logicPush.ts` (payload)
  - **Verification:** Notification visible on device

- [ ] **1.1.3.4 — Test notification click**
  - Tap/click notification
  - App should open to the correct screen (from `tab` field)
  - E.g., dose reminder → Stack tab, check reminder → Today tab
  - **Files:** `public/sw.js` (notificationclick handler), `src/app/_components/remind-tab.tsx` (tab routing)
  - **Verification:** App opens to correct screen

**Acceptance Criteria:**
- Sweep runs and sends notifications
- Notification arrives on device with correct title/body
- Tapping notification opens app to correct screen
- No JavaScript errors in console or worker

---

### **1.1.4: "Taken" Quick Action Testing** (30 min)

**Objective:** Verify lock-screen "Taken" button logs dose without opening app (Android/Chromium).

**Note:** iOS does not support notification actions, so button will not appear. This is a Chromium/Android feature only.

#### Tasks:

- [ ] **1.1.4.1 — Generate grant token**
  - Sweep creates a `tm_takenGrants` row for each notification that needs it
  - Token should be single-use, short-lived (expires in 24h)
  - **Files:** `convex/tm/remind.ts` (mintTakenGrants), `convex/tm/logicRemind.ts` (grant logic)
  - **Verification:** `tm_takenGrants` table has row after sweep

- [ ] **1.1.4.2 — Include grant in payload**
  - Notification payload has `taken: { url, token }`
  - URL points to `/ingest/dose-taken` endpoint
  - Token is the grant from DB
  - **Files:** `convex/tm/logicPush.ts` (notificationPayload), `convex/tm/push.ts` (payload encoding)
  - **Verification:** Inspect payload in public/sw.js logs (console.log encodePayload result)

- [ ] **1.1.4.3 — Display "Taken" button on Android**
  - Lock screen shows:
    - "Taken" button (primary action)
    - "Open" button (fallback)
  - Button only shows if grant is attached
  - iOS: No buttons (platform limitation)
  - **Files:** `public/sw.js` (cleanActions, platform detection), `convex/tm/logicPush.ts` (actionsFor)
  - **Verification:** Button appears on Android/Chromium lock screen

- [ ] **1.1.4.4 — Handle "Taken" tap**
  - Tap "Taken" button on lock screen
  - Worker POSTs to `/ingest/dose-taken` with token
  - Server logs dose to `tm_doseLogs` without opening app
  - Notification closes silently
  - **Files:** `public/sw.js` (notificationclick handler), `/ingest/dose-taken` endpoint (if exists, or check `convex/tm/ingest.ts`)
  - **Verification:** Dose logged in DB, app didn't open

- [ ] **1.1.4.5 — Handle tap after token expiry**
  - Token expires after 24h (configurable in GRANT_TTL_MS)
  - If user taps "Taken" after expiry, POST fails
  - Worker falls back to opening app (user must log manually)
  - **Files:** `public/sw.js` (fallback logic), `convex/tm/remind.ts` (doseTaken validation)
  - **Verification:** Notification closes, app opens as fallback

**Acceptance Criteria:**
- "Taken" button appears only on Chromium/Android
- Button tap POSTs to correct endpoint
- Dose logged server-side without app opening
- Token validation works (rejects expired/used tokens)

---

### **1.1.5: Email Notification Integration** (1 hour, optional for Phase 1.1)

**Objective:** Add email as async fallback for push notifications (especially for critical alerts).

**Note:** This is optional for Phase 1.1 but recommended for robustness. Skip if time-constrained.

#### Tasks:

- [ ] **1.1.5.1 — Set up Resend account (optional)**
  - Sign up at https://resend.com
  - Get API key
  - Verify sender email domain (or use onboarding domain)
  - **Files:** `.env.local` (RESEND_API_KEY, REMIND_EMAIL_FROM)

- [ ] **1.1.5.2 — Verify Resend integration already wired**
  - Check `convex/tm/push.ts` — Resend logic already exists
  - Mailer loads from `RESEND_API_KEY` env var
  - **Files:** `convex/tm/push.ts` (lines 79–86)
  - **Verification:** Code review shows Resend client instantiated

- [ ] **1.1.5.3 — Test email send (dev-only)**
  - Add test email to a user's `remindEmail` field
  - Run sweep manually
  - Check email inbox for notification
  - Verify subject, sender, and body
  - **Files:** `convex/tm/remind.ts` (batch.email field), `convex/tm/logicEmail.ts`
  - **Verification:** Email received with correct content

- [ ] **1.1.5.4 — Add UI toggle for email preferences**
  - Reminders tab → Settings icon
  - Option: "Receive email reminders too"
  - On: Prompts for email, saves to user profile
  - Off: Clears email, only push
  - **Files:** `src/app/_components/remind-tab.tsx` (email input field)
  - **Verification:** Email preference persists

- [ ] **1.1.5.5 — Document email configuration**
  - Add section to PUSH_NOTIFICATIONS_SETUP.md
  - How to get Resend API key
  - How to test locally
  - Email template examples
  - **Files:** `PUSH_NOTIFICATIONS_SETUP.md`

**Acceptance Criteria:**
- Email sends when RESEND_API_KEY is set
- Email does not send when key missing (no error, just skipped)
- User can enable/disable email separately from push
- Email subject and body are clear and helpful

---

### **1.1.6: E2E & A11y Testing** (1 hour)

**Objective:** Ensure push notification flow works across devices and is accessible.

#### Tasks:

- [ ] **1.1.6.1 — Run E2E test suite**
  ```bash
  npm run e2e
  ```
  - Should test Reminders tab flow:
    - Load Reminders tab ✓
    - Subscribe to notifications ✓
    - Verify permission prompt ✓
    - Verify subscription success ✓
  - **Files:** `scripts/timento-e2e.mjs` (add remind-tab flow if missing)
  - **Verification:** E2E passes without errors

- [ ] **1.1.6.2 — Test across breakpoints**
  - Mobile (390px): Button sizing, permission prompt layout
  - Tablet (768px): Navigation, settings panel
  - Desktop (1280px): Full layout, preview pane
  - **Tools:** DevTools responsive mode
  - **Files:** `src/app/_components/remind-tab.tsx` (responsive classes)

- [ ] **1.1.6.3 — Run accessibility audit**
  ```bash
  npm run a11y
  ```
  - Should test Reminders tab at 320/390/1280px
  - Check WCAG 2.2 AA compliance:
    - All buttons/inputs have labels ✓
    - Text contrast ≥4.5:1 ✓
    - No tiny text (<11.5px) ✓
    - No sideways scroll at 320px ✓
  - **Files:** `scripts/timento-a11y.mjs` (should include remind-tab), `src/app/_components/remind-tab.tsx`
  - **Verification:** A11y passes, no violations

- [ ] **1.1.6.4 — Test notification screen reader**
  - iOS/Android screen reader announces:
    - Notification title + body
    - "Taken" button text (if shown)
  - **Tools:** iOS VoiceOver / Android TalkBack
  - **Files:** `public/sw.js` (notification text), `src/app/_components/remind-tab.tsx` (button labels)
  - **Verification:** Screen reader announces correctly

**Acceptance Criteria:**
- E2E test passes (subscribe → verify)
- Responsive at 390px, 1280px
- A11y audit passes (no violations)
- Screen reader announces notifications correctly

---

### **1.1.7: Documentation & Examples** (1 hour)

**Objective:** Document push notification system for future maintainers and users.

#### Tasks:

- [ ] **1.1.7.1 — Verify setup guide is complete**
  - `PUSH_NOTIFICATIONS_SETUP.md` exists and has:
    - Local setup steps ✓
    - Testing checklist ✓
    - Troubleshooting guide ✓
    - Production deployment ✓
    - Files reference ✓
  - **Files:** `PUSH_NOTIFICATIONS_SETUP.md`
  - **Verification:** Guide is clear and actionable

- [ ] **1.1.7.2 — Add inline code comments**
  - `convex/tm/push.ts` — Delivery logic with examples
  - `convex/tm/logicPush.ts` — Payload encoding rules
  - `public/sw.js` — Event handlers with platform notes
  - `convex/crons.ts` — Schedule logic
  - **Files:** All push-related files
  - **Verification:** Comments explain key decisions

- [ ] **1.1.7.3 — Document limitations & known issues**
  - iOS: No lock-screen buttons, needs Home Screen install
  - Battery optimization on Android
  - Payload size limit (4KB)
  - Grant token expiry (24h)
  - **Files:** `PUSH_NOTIFICATIONS_SETUP.md` → "Known Limitations"
  - **Verification:** All major gotchas documented

- [ ] **1.1.7.4 — Add troubleshooting section**
  - "Push not arriving" → check VAPID keys, permission, SW registered
  - "Empty notification" → check payload JSON parsing
  - "Button doesn't work" → check token not expired, endpoint correct
  - **Files:** `PUSH_NOTIFICATIONS_SETUP.md` → "Troubleshooting"
  - **Verification:** Guide covers 80% of user issues

**Acceptance Criteria:**
- Setup guide is clear and complete
- Code has explanatory comments
- Limitations documented with workarounds
- Troubleshooting covers common issues

---

### **1.1.8: Deploy to Staging** (1 hour)

**Objective:** Test push notifications in a production-like environment before going live.

#### Tasks:

- [ ] **1.1.8.1 — Generate staging VAPID keys**
  ```bash
  npx web-push generate-vapid-keys
  ```
  - Keys for staging (different from dev and prod)
  - Store securely (e.g., Vercel secrets, Convex env vars)
  - **Files:** None (env vars only)

- [ ] **1.1.8.2 — Set staging env vars**
  - Vercel dashboard → Environment Variables
  - Add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
  - Set for staging/preview builds only
  - **Files:** Vercel dashboard settings
  - **Verification:** Vars shown in build logs

- [ ] **1.1.8.3 — Deploy to staging**
  ```bash
  git push origin staging-push-notifications
  # Vercel auto-deploys, or:
  npx convex deploy --environment staging
  ```
  - Wait for build + deploy
  - Check no errors in Vercel logs
  - **Files:** CI/CD pipeline
  - **Verification:** Build succeeds, app loads

- [ ] **1.1.8.4 — Test on staging URL**
  - Load staging.timento.app (or staging URL)
  - Reminders tab should work
  - Subscribe to notifications
  - Send test reminder (via Convex dashboard)
  - Verify notification arrives
  - **Files:** No changes needed
  - **Verification:** Full flow works on staging

- [ ] **1.1.8.5 — Monitor for 24h**
  - Watch Convex logs for sweep errors
  - Check error rate in Vercel Analytics
  - Verify no unexpected behavior
  - **Files:** Monitoring dashboards
  - **Verification:** No errors over 24h period

**Acceptance Criteria:**
- Staging build deploys cleanly
- Reminders tab works on staging
- Notifications send successfully
- No errors in 24h monitoring period

---

### **1.1.9: Production Release** (30 min)

**Objective:** Release push notifications to all users.

#### Tasks:

- [ ] **1.1.9.1 — Generate production VAPID keys**
  ```bash
  npx web-push generate-vapid-keys
  ```
  - Store in a secure vault (not git, not Slack)
  - Keys for production only
  - **Files:** None (env vars only)

- [ ] **1.1.9.2 — Set production env vars**
  - Vercel dashboard → Environment Variables → Production
  - Or Convex dashboard → Production environment
  - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
  - RESEND_API_KEY (optional)
  - **Files:** Production secrets
  - **Verification:** Vars set, visible in audit log

- [ ] **1.1.9.3 — Create release branch**
  ```bash
  git checkout -b release/push-notifications-v1
  ```
  - Merge staging push notifications branch into main
  - Tag with version (e.g., `v1.2.0`)
  - **Files:** Git tags, release notes
  - **Verification:** Branch created, CI passes

- [ ] **1.1.9.4 — Deploy to production**
  ```bash
  git push origin main
  npx convex deploy
  ```
  - CI/CD builds and deploys
  - Vercel promotes staging → production
  - Convex functions deployed
  - **Files:** No changes
  - **Verification:** Deployment succeeds, no rollback needed

- [ ] **1.1.9.5 — Post-deploy validation**
  - Monitor error rates for 1h
  - Check Convex logs for sweep execution
  - Verify notifications deliver to real devices
  - Spot-check a few users' notifications
  - **Files:** Monitoring dashboards
  - **Verification:** All green, no anomalies

- [ ] **1.1.9.6 — Announce feature**
  - Changelog: "Push notifications now available"
  - In-app banner: "Enable reminders to stay on track"
  - Support docs: Link to setup guide
  - **Files:** Changelog, website, support docs

**Acceptance Criteria:**
- Production deployment succeeds
- Notifications deliver to real devices
- Error rate normal/low for 1h post-deploy
- Users notified of new feature

---

## Success Metrics

✅ **Completion Definition:**
- [ ] All 9 sections completed
- [ ] E2E test passes
- [ ] A11y audit passes (WCAG 2.2 AA)
- [ ] Production notifications deliver successfully
- [ ] Zero critical bugs found in 24h post-deploy

📊 **Quality Metrics:**
- Push delivery success rate: **>95%**
- Notification platform support: **iOS + Android + Web**
- "Taken" button acceptance: **>50%** (Android users who tap it)
- User permission grant rate: **>60%**

---

## Dependencies & Risks

### External Dependencies
- **Firebase Cloud Messaging (FCM)** — Android push service
- **Apple Push Notification service (APNs)** — iOS (via web push gateway)
- **Resend** — Email service (optional)
- **Browser push service** — Chromium, Firefox, Safari

### Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| VAPID keys leaked | 🔴 High | Store in secret manager, rotate immediately |
| Tokens replayed | 🟡 Medium | Single-use grants, short expiry (24h) |
| Notifications not delivered | 🟡 Medium | Email fallback, on-app reminders |
| iOS battery impact | 🟡 Medium | Rely on server-side throttling (30 min sweep) |
| Notification spam | 🟡 Medium | Tag-based deduplication, user can disable |

---

## Timeline & Effort Estimates

| Section | Estimated Time | Effort |
|---------|-----------------|--------|
| 1.1.1 — Setup | 1 hour | Low |
| 1.1.2 — Subscription | 1 hour | Low |
| 1.1.3 — Delivery | 1 hour | Medium |
| 1.1.4 — "Taken" action | 30 min | Medium |
| 1.1.5 — Email (optional) | 1 hour | Low |
| 1.1.6 — Testing | 1 hour | Medium |
| 1.1.7 — Docs | 1 hour | Low |
| 1.1.8 — Staging | 1 hour | Low |
| 1.1.9 — Production | 30 min | Low |
| **Total** | **8.5 hours** | **Low-Medium** |

**Actual timeline likely 2–3 days** given parallel work and context switching.

---

## Handoff & Maintenance

### For Maintainers
- Monitor Convex logs for push delivery errors
- Check `tm_pushSubscriptions` table for growth rate
- Review user permission grant rate monthly
- Update `PUSH_NOTIFICATIONS_SETUP.md` if adding new integrations

### For Support
- Direct users to `PUSH_NOTIFICATIONS_SETUP.md` for troubleshooting
- Escalate delivery failures to backend team
- Track "Taken" action adoption to measure UX improvement

### Future Enhancements (Post-Phase 1.1)
- Rich notifications with custom icons/actions
- Notification scheduling (send at specific time)
- Analytics: delivery rate, open rate, "Taken" rate
- Wearable integration (Apple Watch, Wear OS)

---

**Created:** August 21, 2026  
**Status:** Ready for Implementation  
**Next Step:** Assign tasks and begin Section 1.1.1 (Setup)
