# TARA Growth System — Roadmap, App Research & Automations

The vision: turn TARA from a shop into a **members-grade ecosystem** where proof, ritual, tracking, education and rewards compound. Everything below is designed so the front-end prototypes we build slot onto a **Convex + SumUp** backend with minimal rework.

---

## 1. Companion app (iOS + Android) — feature research

Built as a prototype in `TARA App.dc.html` (5 tabs). Full feature set to build out:

**Home / dashboard**
- Next-dose card with countdown + one-tap "log dose" (auto-fills units from the reconstitution math).
- Adherence streak + protocol progress (week x of n).
- Live tiles: weight trend, next delivery, verified-batch count.

**Track**
- Log weight, skin clarity, sleep, energy, mood, side-effects, injection site.
- Progress charts per metric; before/after photo timeline (private by default).
- Auto-insights ("weight −2.4 kg over 30 days, on track").

**Plan / schedule**
- Protocol templates (recovery, GH-axis, metabolic, longevity) auto-built from what they ordered.
- Per-peptide dose windows + "best time to dose" guidance (fasted / pre-bed / with food).
- Smart notifications: 40-min pre-dose reminders, reconstitution-day alerts, "vial runs out ~date" reorder nudges (from doses-per-vial math).

**Learn**
- Gated Fellow videos, protocol library, plain-English glossary, COA-reading guides.

**You / social & rewards**
- Membership tier + perks; referral (give €10/get €10) with progress bar + share link.
- Subscription management; verified-batch vault; settings.
- Share tips/protocols with friends (opt-in community feed — moderated).

**Phone-native extras to research**
- Push notifications, Apple Health / Google Fit sync (weight, sleep), widgets (next dose), Face ID login, offline log, Apple/Google Pay reorder, QR scan-to-verify a vial in-hand.

**Build path:** React Native or Expo sharing types with the Convex backend; the web dashboard and app read the same `orders`, `logs`, `schedule`, `loyalty` tables.

---

## 2. Referral engine
- Give €10 / get €10; referrer earns only after the friend's first *paid* order (fraud-safe).
- Tiered bonus: 5 friends → free premium kit; 10 → a month of subscription free.
- Surfaced on website + app + post-purchase email. Shareable link + code.

## 3. Early access / membership tiers
- **Researcher → Fellow → Institute** (spend- or invite-unlocked).
- Perks: early access to new compounds, members pricing, priority cold-chain, concierge line, gated knowledge.
- Website: a members strip + "early access" badges on new SKUs.

## 4. Subscribe & save
- Recurring delivery; **6-month commit = 5% off** (and free shipping).
- Managed in app + web account; reorder date driven by usage math.

## 5. Deep knowledge platform
- Per-compound guides, protocol library, video masterclasses, glossary with hover-defs.
- Free tier vs Fellow-gated depth.

---

## 6. Automations (the operational spine)

| Trigger | Automation |
|---|---|
| Payment confirmed (SumUp webhook) | Mark order paid → generate invoice + COA + reconstitution-schedule PDFs → email them |
| Order paid (2nd+) | Issue repeat-customer / referral credit |
| Referred friend's first paid order | Credit both accounts |
| Vial depletion date approaches | Reorder-nudge push + email |
| Dose window | Pre-dose reminder push; auto-log if confirmed |
| New batch released (admin) | Publish COA to public batch wall → notify Fellows (early access) |
| Low stock | Alert admin + "notify me when back" list fires on restock |
| Subscription renewal | Charge via SumUp, dispatch, receipt |

Implement as **Convex scheduled functions + webhooks**; email via a transactional provider (Resend/Postmark); push via APNs/FCM.

---

## Build sequence (recommended)
1. **Website account area** — auth, dashboard, order history, reorder, verified vault, tracking, referrals, subscription (front-end sim on Convex-shaped data). ← *next up*
2. Companion app screens (done as prototype) → React Native build.
3. Convex backend + SumUp live + automations.
4. Admin (batch release, COA publish, inventory).

Everything is additive — we ship the account area next, then layer tiers, subscription, and automations on top.
