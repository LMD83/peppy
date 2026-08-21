# Push Notifications Setup & Testing Guide

**Status:** Infrastructure Complete, Ready for Testing  
**Phase:** 1.1 Push Notification Completion  
**Branch:** `claude/timento-roadmap-mln0iq`

## Overview

Push notifications in Timento are handled by a three-part system:

1. **Backend Schedule** (`convex/crons.ts`) — Triggers sweep every 30 minutes
2. **Delivery Engine** (`convex/tm/push.ts`) — Sends via web-push (VAPID) + Resend email
3. **Service Worker** (`public/sw.js`) — Receives & displays on lock screen

The system is **fully functional but gated on environment variables**. Without VAPID keys or Resend credentials, delivery is blocked and logged (never silently fails).

---

## Local Development Setup

### Step 1: Generate VAPID Keys

Push notifications use VAPID keys to authenticate with the browser's push service. For development:

```bash
npx web-push generate-vapid-keys
```

This outputs:
```
Public Key:  BGLfEsAvBTzQ4ZXlXY9wNMPwzjqpW2gKaoCZK7CU0xu8oj61vZ7jwZ1kFDEMVcWQbpDfHQ5vkF6EgJodMdpMRlY
Private Key: zLziog_JKhthMAssc5FqXCd9der7hR8iIGiBFIOuMGQ
```

### Step 2: Create `.env.local`

Copy `.env.example` and add the generated keys:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and add:

```bash
# --- Reminders (Push notifications) ---
VAPID_PUBLIC_KEY=<your-public-key-from-step-1>
VAPID_PRIVATE_KEY=<your-private-key-from-step-1>
VAPID_SUBJECT=mailto:dev@timento.local

# Email notifications (optional — requires Resend account)
# Get a free API key from https://resend.com
# RESEND_API_KEY=re_xxx
# REMIND_EMAIL_FROM=Timento <onboarding@resend.dev>
```

### Step 3: Start Dev Server

```bash
npm run dev
```

The Convex backend will pick up the env vars and the cron will start triggering every 30 minutes.

---

## Testing Flow

### 1. Browser Capability Detection

Visit the **Reminders** tab in the app. It will detect:
- ✅ Service Worker support
- ✅ Push Manager support  
- ✅ Notification permission (will ask for permission)
- ⚠️ Home Screen install status (iOS only — web push requires HSI on iOS)
- ✅ VAPID key configuration (shown as "Push is available")

### 2. Subscribe to Push Notifications

1. Click **"Turn on reminders"**
2. Browser requests notification permission → **Allow**
3. App subscribes device and saves subscription to `tm_pushSubscriptions` table
4. **Reminders tab** shows:
   - Service Worker version
   - Last subscription time
   - "View test reminders" preview

### 3. Send a Test Reminder

The Reminders tab has a **"Send test reminder"** button (dev-only) that:
1. Calls `remind.testDeliver` (dev mutation)
2. Immediately sends a test push via `push.sweep`
3. Shows success/failure in console logs
4. Notification appears on lock screen or notification tray

**What the notification shows:**
- Title: "Timento" (or custom title from reminder)
- Body: Reminder text (e.g., "Time for your morning dose")
- Actions: "Taken" (if grant attached), "Open"
- Tag: One per subject — duplicates replace, not stack

### 4. Test "Taken" Quick Action

On Android/Chromium (2 buttons max):
1. Lock screen shows notification with "Taken" + "Open" buttons
2. Tap "Taken" → HTTP POST to `/ingest/dose-taken` with token
3. Entry logged to `tm_taken_ingest` without opening app
4. Notification silently closes

On iOS (no buttons):
- Notification shows; tap opens app to the right screen
- Manual logging happens in-app (no lock-screen button)

### 5. Verify Delivery Logs

Check Convex dashboard logs:

```bash
# See sweep results (every 30 min)
npx convex query tm.push.sweep

# See test delivery (immediate)
# Should show: "sent: 1, notifications: 1, users: 1"
```

Or check browser console during test send for delivery details.

---

## Production Setup (Vercel/Convex)

### 1. Generate Production VAPID Keys

**Do NOT reuse development keys in production.** Generate new ones:

```bash
npx web-push generate-vapid-keys
```

### 2. Set Production Env Vars

In Vercel dashboard or hosting provider:

```
VAPID_PUBLIC_KEY=<production-key>
VAPID_PRIVATE_KEY=<production-key>
VAPID_SUBJECT=mailto:your-email@timento.app
RESEND_API_KEY=re_xxx
REMIND_EMAIL_FROM=Timento <hello@timento.app>
```

### 3. Deploy

```bash
git push origin main  # CI builds and deploys
npx convex deploy    # Or Convex auto-deploys on push
```

The cron will automatically start triggering in production every 30 minutes.

---

## Delivery Guarantees & Failures

### When Delivery Works
- ✅ VAPID keys are set
- ✅ Browser has permission
- ✅ Service Worker registered
- ✅ Push service reachable (Firebase Cloud Messaging, APNs, etc.)

### When Delivery Fails (Gracefully)
- ❌ VAPID keys missing → **Blocked log (no delivery, no failure record)**
- ❌ Resend API key missing → Email skipped (push still works)
- ❌ No permission granted → App notified (`supported: false`), sweep continues
- ❌ Push service returns 404/410 → Subscription marked dead, retried next sweep
- ❌ Push service returns 500 → Logged as transient, retried next sweep

**Key rule:** A deployment that cannot send must never mark a subscription as "delivered" or fail a device that was never reached.

---

## Testing Checklist

- [ ] **Setup**
  - [ ] `npm run dev` starts without errors
  - [ ] Env vars loaded (check terminal output for VAPID keys being read)
  - [ ] Convex backend ready

- [ ] **Browser**
  - [ ] Reminders tab loads
  - [ ] Capability detection runs (shows "Service Worker: ready", "Push: ready")
  - [ ] "Turn on reminders" button appears (if not blocked)

- [ ] **Subscription**
  - [ ] Click "Turn on reminders"
  - [ ] Browser asks for permission
  - [ ] Click "Allow"
  - [ ] App shows "Reminders are on" + worker version
  - [ ] `tm_pushSubscriptions` table has 1 row

- [ ] **Test Delivery**
  - [ ] Click "Send test reminder"
  - [ ] Notification appears on device
  - [ ] Notification shows correct title + body
  - [ ] Console shows delivery success

- [ ] **Taken Action** (Android/Chromium only)
  - [ ] Lock screen shows "Taken" button
  - [ ] Tap "Taken"
  - [ ] Notification closes without opening app
  - [ ] `tm_taken_ingest` table logs entry

- [ ] **E2E Test**
  - [ ] Run `npm run e2e`
  - [ ] Remind-tab flow passes (subscribe → test send → verify logged)

- [ ] **A11y Test**
  - [ ] Run `npm run a11y`
  - [ ] Reminders tab at 320/390/1280px passes WCAG 2.2 AA

---

## Known Limitations

### iOS
- **No background push.** Web app receives push only when Safari tab is active OR Home Screen install is in use.
- **No lock-screen actions.** Notifications show but buttons are not drawn. Tap opens app.
- **Requires Home Screen install.** Apple restricts web push to HSI apps.

### Android Chrome
- **Battery optimization.** Device may delay push if battery-save is enabled.
- **GCM/FCM.** Uses Firebase Cloud Messaging; requires Google Play Services.

### Payload Size
- **Max 4KB** per notification (before encryption).
- Very long reminder text will truncate.
- Grant tokens are single-use and expire within 24h.

---

## Troubleshooting

### "Push is not available" (Reminders tab shows red)
- [ ] Check `.env.local` has `VAPID_PUBLIC_KEY`
- [ ] Restart `npm run dev`
- [ ] Check browser console for errors

### Subscription succeeds but no notification arrives
- [ ] Check permission: does browser show "Notifications: Allowed"?
- [ ] Check Service Worker: is it registered? (DevTools → Application → Service Workers)
- [ ] Check push service status: try sending from a different browser
- [ ] Check Convex logs for delivery errors

### "Notification arrived but empty" (just says "A reminder from your file.")
- [ ] Payload JSON did not parse in the worker
- [ ] A field name changed in `logicPush.ts` but `public/sw.js` was not updated
- [ ] Test: run `npm test -- push.test.ts` → should pass (it validates all keys match)

### Can't tap "Taken" button
- [ ] Button only appears on Android/Chromium (not iOS, not Firefox)
- [ ] If button appears but fails: check grant token expired or was already used
- [ ] If button appears but does nothing: network error posting to `/ingest/dose-taken`

### Email not sending
- [ ] Resend API key not set or invalid
- [ ] Check `.env.local` has `RESEND_API_KEY`
- [ ] Restart `npm run dev`
- [ ] Check Convex logs for Resend API errors

---

## Files to Know

| File | Purpose |
|------|---------|
| `convex/tm/push.ts` | Delivery logic (web-push + Resend) — Node.js action |
| `convex/tm/logicPush.ts` | Payload encoding, error classification — testable pure code |
| `convex/crons.ts` | Schedule (every 30 min) — triggers sweep |
| `convex/tm/remind.ts` | Queries/mutations for subscriptions + grants |
| `public/sw.js` | Service Worker, push event handler |
| `src/app/_components/remind-tab.tsx` | UI, capability detection, subscribe/unsubscribe |
| `tests/push.test.ts` | Payload/worker contract validation |
| `tests/remind.test.ts` | Subscription + delivery logic |

---

## Next Steps

1. **Setup locally** (steps above) — 5 min
2. **Run test checklist** — 10 min
3. **Run e2e suite** — 2 min
4. **Run a11y audit** — 2 min
5. **Deploy to staging** if integration works
6. **Add email credentials** when Resend account ready
7. **Production keys + deploy** when ready

---

**Questions?** Check `convex/tm/logicPush.ts` or `public/sw.js` comments for detailed behavior rules.
