# SumUp integration

Prices are **VAT-inclusive cents** internally; SumUp's `amount` field is
**decimal major units** (e.g. `10.99`, not `1099`) — the opposite convention.
Conversion happens once, in `convex/sumup.ts`'s `centsToMajorUnits`.

## Why we never trust the webhook body

SumUp's own OpenAPI spec (`github.com/sumup/sumup-openapi`) documents no
signature/HMAC scheme for its `return_url` payment-result callback — the
field is described only as "webhook URL to which the payment result will be
sent," with no signing secret. Rather than trust an unauthenticated POST
body as proof of payment, every confirmation path re-fetches the checkout
from `GET /v0.1/checkouts/{id}` with our own secret key and only marks an
order paid if SumUp's API itself says `status: "PAID"`. If SumUp ever adds
documented webhook signing, that would be an additional check to layer on
top of this — not a replacement for it, since re-verifying against the API
is strictly stronger.

## Flow

1. **`orders.createOrder`** (mutation) — creates a `pending` order.
2. **`sumup.createCheckout`** (action, rate-limited) — `POST
   /v0.1/checkouts` with our secret key. `checkout_reference` is
   `${orderNo}-${orderId}` (globally unique, avoids the small collision
   window `orderNo` alone would have). `return_url` is
   `${CONVEX_SITE_URL}/sumup/webhook/${orderId}` — the order id is embedded
   in the *path* we control, so the webhook handler never has to parse an
   unconfirmed body shape to know which order it's for. Persists
   `sumupCheckoutId` on the order.
3. **SumUp Payment Widget** (`src/components/sumup-widget.tsx`) — loads
   `https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js`, mounts
   `window.SumUpCard` against the checkout id. Card details never touch our
   servers.
4. **Confirmation — two independent, idempotent paths, either can win:**
   - **Webhook** (`POST /sumup/webhook/:orderId` in `convex/http.ts`) —
     SumUp calls this after the checkout resolves. We ignore its body,
     rate-limit by IP, then call `sumup.confirmCheckout`.
   - **Client fallback** (`sumup.confirmCheckoutFromClient`) — called once
     right after the widget's `onResponse("success")`, in case the webhook
     is slow or never arrives. Same rate-limited path, same re-verify-first
     logic — a client can't mark its own order paid without SumUp
     confirming it first.
   - Both converge on `orders.markPaidInternal` / `markFailedInternal`,
     which no-op if the order isn't still `pending` — safe to race or
     double-deliver.
5. **Fulfil** — `markPaidInternal` flips status to `paid`, issues a
   repeat-customer loyalty code if applicable, and schedules
   `emailActions.sendOrderConfirmation` (Resend, idempotent via
   `confirmationEmailSentAt`).

The client polls nothing — `checkout/page.tsx` holds a live
`useQuery(api.orders.getOrderStatus, { orderNo })`; the moment either
confirmation path updates the order in the database, Convex's reactivity
re-renders the checkout UI automatically.

## Keys & environment (`npx convex env set NAME value`)

- `SUMUP_SECRET_KEY` — server-side only, used only inside `action`/`httpAction`.
- `SUMUP_MERCHANT_CODE`
- `SITE_URL`, `CONVEX_SITE_URL` — already required by Convex Auth; reused
  here for `redirect_url`/`return_url`.

## Testing

- Use a **sandbox** merchant account (`sk_test_...` key) for development —
  same API host as production, sandbox vs. live is determined entirely by
  which key you use.
- Per SumUp's sandbox rules, certain test amounts (`€11.00`, `€42.01`,
  `€42.76`, `€42.91`) reliably simulate a declined payment — confirm the
  exact table in your own sandbox account before relying on it in CI, since
  it wasn't independently verifiable against primary docs at the time this
  was written (`developer.sumup.com` was unreachable from the build
  environment).

## Compliance note

Confirm SumUp will underwrite the research-compound category before go-live.
