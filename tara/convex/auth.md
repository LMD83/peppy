# Auth

Convex Auth (`@convex-dev/auth`) with two providers, wired in `convex/auth.ts`:

- **Google OAuth** — social sign-in, no separate verification step (Google
  already confirmed the email).
- **Password + email verification** — `Password({ verify: ResendOTP, reset:
  ResendOTPPasswordReset })`. Sign-up/sign-in only succeeds after a 6-digit
  code, emailed via Resend (`convex/ResendOTP.ts`), is entered. Password
  reset uses the same OTP pattern (`convex/ResendOTPPasswordReset.ts`).

Guest checkout still works — `orders.createOrder` links the order to a
signed-in user when there's a session (`getAuthUserId(ctx)`), and stays
`undefined` otherwise.

## Schema

`convex/schema.ts` spreads `authTables` from `@convex-dev/auth/server` and
defines `users` with the exact field set + index names
(`.index("email", ...)`, `.index("phone", ...)`) Convex Auth's own
`createOrUpdateUser` implementation looks up by — confirmed against the
installed package's source
(`node_modules/@convex-dev/auth/dist/server/implementation/users.js`), not
assumed from docs, since getting an index name wrong here fails silently
until a real sign-in attempt.

Trust model: Google and the OTP-verified Password flow are both "trusted"
methods and auto-link onto the same user by verified email address; a
password sign-up without a matching verify step would NOT auto-link (Convex
Auth's own guidance) — since `verify` is always configured here, this isn't
a concern, but don't add an unverified auth method later without checking
this again.

## Next.js wiring

- `src/proxy.ts` — Next.js 16 renamed `middleware.ts` to `proxy.ts` (same
  mechanism). Wraps `convexAuthNextjsMiddleware`, redirects `/account/*` to
  `/signin` when unauthenticated and `/signin` to `/account` when already
  signed in.
- `src/app/layout.tsx` — wrapped in `ConvexAuthNextjsServerProvider`.
- `src/components/convex-client-provider.tsx` — uses
  `ConvexAuthNextjsProvider` instead of the plain `ConvexProvider`.
- `src/app/signin/page.tsx` — Google button + password/OTP two-step form.
- `src/app/account/page.tsx` — order history, sign out.

**Known cost**: `ConvexAuthNextjsServerProvider` reads cookies on every
request, which opts every page under the root layout out of static
generation (confirmed via `next build` — all routes became `ƒ` /
server-rendered after adding it, where several were previously `○` /
static). This is an inherent trade-off of real server-side auth state, not
a bug — see docs/SECURITY.md.

## Environment variables (set via `npx convex env set NAME value`)

`SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS` (from the Convex Auth CLI setup),
`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`.

## Rate limiting

Convex Auth's Password/OTP provider rate-limits failed verification attempts
internally (documented, exact threshold not published). We don't re-wrap it.
