# Security — what's hardened, what's trade-off, what's left for go-live

This file exists so a future reviewer (or auditor) doesn't have to
reconstruct the reasoning from commit messages. Written alongside the
SumUp/Convex Auth/Resend integration.

## Fixed: a real hole in the original demo checkout

The pre-existing `orders.markPaid` mutation was **public** and took the
caller's word for it — any client could call `api.orders.markPaid({orderNo,
sumupCheckoutId: "anything"})` directly and mark any order paid for free,
with zero payment verification. This was fine for a demo with no real
payment processor wired up; it would have been a critical vulnerability the
moment SumUp went live on top of it unchanged.

Fixed by removing the public mutation entirely. Payment confirmation now
only happens via `orders.markPaidInternal`, an `internalMutation` reachable
exclusively from `convex/sumup.ts`'s `confirmCheckout`, which itself always
re-fetches the checkout status from SumUp's API with our server-side secret
key first — see `convex/SUMUP.md` for why we don't trust the webhook body
either. There is no code path, client-triggered or otherwise, that can mark
an order paid without SumUp's API itself confirming it.

## Defense in depth, layer by layer

- **Secrets never reach the client.** `SUMUP_SECRET_KEY`, `RESEND_API_KEY`,
  `AUTH_GOOGLE_SECRET`, etc. are all Convex environment variables, used only
  inside `action`/`httpAction` handlers. This isn't just convention —
  Convex's `query`/`mutation` runtime has no `fetch()` at all (confirmed
  against the installed SDK's ctx type definitions), so a secret used for an
  external API call architecturally *cannot* end up in a query/mutation
  code path by accident.
- **Webhook signature verification** where a scheme exists (Resend, via its
  Svix-backed `resend.webhooks.verify()`) and **re-verify-via-API** where it
  doesn't (SumUp — see `convex/SUMUP.md`).
- **Rate limiting** (`convex/rateLimiter.ts`, `@convex-dev/rate-limiter`) on
  checkout creation and both inbound webhooks, keyed by email/IP. Convex
  Auth's own Password/OTP flow rate-limits failed attempts internally — not
  re-wrapped.
- **CSP + security headers.** A fresh nonce is generated per request in
  `src/proxy.ts` and used for `script-src` (`'self' 'nonce-...'` plus
  SumUp's widget origin and Google's OAuth origin) — no
  `'unsafe-inline'`/`'unsafe-eval'` for scripts anywhere. Next.js reads the
  nonce back out of its own `Content-Security-Policy` response header and
  stamps it onto its own hydration/RSC bootstrap scripts automatically; this
  was verified live, not assumed — an earlier static (no-nonce) CSP was
  smoke-tested first and broke Next's own inline bootstrap script
  (`Invariant: Expected a request ID... self.__next_r`), which is what
  prompted switching to nonces. `frame-ancestors 'none'`, `object-src
  'none'`, HSTS with `preload`, `X-Content-Type-Options: nosniff`, a
  restrictive `Permissions-Policy` are set statically in `next.config.ts`.
- **Authorization checks, not just authentication.** `orders.reorder` and
  `orders.listMyOrders` verify the caller owns the order/session via
  `getAuthUserId(ctx)` before returning data — not just "is someone logged
  in."
- **Idempotency everywhere money or email is involved** — `markPaidInternal`
  /`markFailedInternal` no-op on a non-pending order (safe to race the
  webhook against the client fallback); `sendOrderConfirmation` checks
  `confirmationEmailSentAt` *and* passes Resend its own `idempotencyKey`.
- **Dependency hygiene.** Next.js was pinned at a version with several
  disclosed CVEs (DoS, cache poisoning, middleware bypass, CSP-nonce XSS —
  see the advisories linked in the commit that bumped it); bumped to the
  latest 16.2.x patch in both apps. `npm audit fix` (non-breaking) applied
  to the root app's dev-tooling chain. One remaining `postcss` moderate
  advisory in both apps is a transitive dependency vendored *inside*
  Next.js's own build pipeline — fixing it would require downgrading Next
  to `9.3.3`, which is obviously the wrong trade — Next.js will ship the fix
  upstream; this is a build-time-only dependency (processes our own trusted
  CSS, not user input), not a runtime attack surface.

## Deliberate trade-offs — read before "fixing" these

- **Nonce-based CSP relies on every route already being dynamic.** Normally
  a nonce forces every page that reads it into dynamic rendering,
  incompatible with static generation/ISR/PPR. That cost is paid regardless
  here — `ConvexAuthNextjsServerProvider` already forces every route dynamic
  (see below) — so adding the nonce was free, not a new trade-off. If auth
  is ever restructured to avoid the global dynamic-rendering cost, revisit
  whether the CSP can stay nonce-based or needs to fall back to a static
  policy with `'unsafe-inline'` for scripts.
- **`style-src 'unsafe-inline'` is intentional.** The app uses inline
  `style={{ background: ... }}` attributes for per-product accent colors in
  several components. Inline CSS injection is a real but much
  lower-severity XSS vector than inline script injection — this is a
  considered trade, not an oversight.
- **Every route is now dynamically rendered.** `ConvexAuthNextjsServerProvider`
  (wrapping the root layout) reads cookies on every request to resolve auth
  state, which opts the whole tree out of static generation — confirmed via
  `next build` output before/after (several routes were `○ Static`, all are
  now `ƒ Dynamic`). This is an inherent cost of real server-side auth, not a
  regression to chase down.
- **Guest checkout has no session to authorize against.**
  `orders.getOrderStatus` is a public query keyed by `orderNo` — it only
  returns `{ status, orderNo, totalCents }`, nothing a guest buyer doesn't
  already know from their own order confirmation screen. Don't widen its
  return shape without re-thinking this.

## What could not be verified in this environment

This app was built in a sandboxed environment whose network policy blocks
`api.convex.dev`, `*.convex.cloud`, `api.resend.com`, and `api.sumup.com`
outright (confirmed via the proxy's own status endpoint, not assumed). That
means:

- `npx convex dev`/`convex deploy` could not be run — `convex/_generated/*`
  are hand-written stand-ins that match the real codegen's shape (documented
  in each file), but only a real deployment run will produce and verify the
  genuine output.
- No live API call to SumUp, Resend, or Google's token endpoint could be
  made from here. Every integration was built from each provider's actual
  installed SDK types/source and (where reachable) primary API
  documentation — not from memory — but **live end-to-end payment and email
  delivery has not been exercised and must be smoke-tested against real
  sandbox credentials before go-live.**
- SumUp's webhook payload shape and signature scheme (or lack thereof)
  couldn't be confirmed against `developer.sumup.com` directly (403 from
  every fetch path tried, including archive mirrors) — only against their
  OpenAPI spec on GitHub, which documents no signing. If you observe a
  signature header on a real webhook delivery that isn't accounted for
  here, that's new information this build didn't have access to.

## Go-live checklist

- [ ] Run `npx @convex-dev/auth` against the real deployment; confirm it
      regenerates `convex/_generated/*` without surprises.
- [ ] Set every env var listed in `.env.example`, `convex/auth.md`,
      `convex/SUMUP.md`, `convex/RESEND.md`.
- [ ] Create a Google OAuth client; add the Convex `.convex.site` callback
      URL as an authorized redirect URI.
- [ ] Verify a sending domain in Resend (SPF/DKIM); add your own DMARC
      record.
- [ ] Confirm SumUp will underwrite the research-compound merchant category
      (flagged in convex/SUMUP.md since before this change).
- [ ] Exercise a full sandbox purchase end-to-end, including the SumUp
      webhook actually arriving (not just the client fallback path).
- [ ] Register the Resend webhook URL and set `RESEND_WEBHOOK_SECRET`.
- [ ] Re-run `npm audit` after any dependency bump between now and go-live.
