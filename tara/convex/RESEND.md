# Resend integration

Two independent uses of Resend, both server-side only (`RESEND_API_KEY`
lives in Convex env vars, never the client):

1. **Auth verification codes** — `convex/ResendOTP.ts` (sign-up/sign-in) and
   `convex/ResendOTPPasswordReset.ts` (password reset), both plugged into
   the `Password` provider in `convex/auth.ts`. Uses `AUTH_RESEND_KEY` (a
   separate env var from `RESEND_API_KEY` — Convex Auth's own convention;
   they can hold the same key, kept separate so auth-email sending and
   general transactional sending can be revoked independently).
2. **Order confirmation** — `convex/emailActions.ts`'s
   `sendOrderConfirmation`, scheduled by `orders.markPaidInternal` via
   `ctx.scheduler.runAfter(0, ...)`. Idempotent: guarded by
   `order.confirmationEmailSentAt`, and passes an `idempotencyKey` to
   Resend itself (`order-confirmation/${orderNo}`) as a second layer.

Templates live in `convex/emails/*.tsx`, authored with
`@react-email/components` and passed directly as the `react:` option to
`resend.emails.send(...)` — the SDK renders them, no manual
`@react-email/render` call needed.

## Webhook (delivery/bounce audit trail)

`POST /resend/webhook` in `convex/http.ts` — verifies the Svix-backed
signature via `resend.webhooks.verify({ payload, headers: { id, timestamp,
signature }, webhookSecret })` (confirmed against the installed `resend`
package's own `.d.ts`, not just docs — the method exists on
`resend.webhooks`, separate from the `Webhook` class name shown in some
third-party writeups). Verified events are recorded in the `webhookEvents`
table (deduped by `svix-id`) as an audit trail; no automated action is taken
on bounces/complaints yet — a natural next step if delivery volume grows.

Register the webhook URL in the Resend dashboard once the app has a public
`CONVEX_SITE_URL`, and set `RESEND_WEBHOOK_SECRET` (the `whsec_...` value
Resend shows you) via `npx convex env set`.

## Environment variables

- `RESEND_API_KEY` — order confirmation emails.
- `AUTH_RESEND_KEY` — auth verification/reset codes (see convex/auth.md).
- `AUTH_EMAIL_FROM` — shared sender identity for both, e.g.
  `"TARA Peptides <verify@tarapeptides.com>"`. Requires a domain verified in
  Resend (SPF + DKIM records; DMARC is a TXT record you add yourself,
  Resend doesn't auto-provision it) — until then, sending falls back to
  `onboarding@resend.dev` for local testing.
- `RESEND_WEBHOOK_SECRET` — signing secret for `/resend/webhook`.

## Rate limits (Resend's own, not ours)

Default plan is ~2 requests/second; use `resend.batch.send([...])` if this
app ever needs to send many emails in one action (not currently needed —
order confirmations are one-at-a-time).
