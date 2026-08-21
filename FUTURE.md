# Timento — parked, not built

Per the v2 non-goals and addendum §8. Nothing here ships without a deliberate decision.

- Meditation / content library (the 2-minute physiological-sigh timer is the only mindfulness tool, embedded in exactly two places)
- Calendar sync for pre-assigned disruption modes (modes are set manually for now)
- Anxiety journaling beyond the stress/energy scalars + optional note
- Macro tracking in survival mode (explicitly forbidden by the mode's design)
- Any third user / social features beyond the two-person crew
- AI chat
- ~~Wearable / Health Connect integration — manual entry plus weekly import stays~~
  *Deliberately un-parked August 2026*: the Connect slice ships the file rails
  (Renpho/Samsung/generic CSV import, InBody sheet entry, CSV exports, GP print
  sheet) and the env-gated Renpho poller, per docs/research/INTEGRATIONS.md.
  Still parked from that decision record: any native wrapper, the Google
  Health API OAuth (pending the 8-day Restricted-scope experiment), lab-PDF
  import, Apple Health/Takeout streaming import, and activity/sleep metrics.
- Food-photo logging
- Week-planner drag-to-swap meal grid + auto shopping list (addendum §8 "meal planning upgrade")
- PWA push reminders (20:15 ritual, 20:30 close, Sunday review, Oct–Feb morning light) — needs a push service; the in-app cards carry the schedule today
- Kitchen-close streak tracked separately from the day streak
