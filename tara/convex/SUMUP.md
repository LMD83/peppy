# SumUp integration

Prices are **VAT-inclusive**; the amount sent to SumUp is `order.totalCents / 100`.

## Flow (server-to-server)
1. **Create checkout** — a Convex **action** (not a query/mutation) calls SumUp
   `POST /v0.1/checkouts` with your **secret API key** (server-side only — never in the browser).
   Persist the returned checkout id on the order (`sumupCheckoutId`) via `orders.createOrder`.
2. **Collect payment** — use the **SumUp Payment Widget** on your own checkout page (embedded,
   PCI-compliant, card details never touch your servers) or the hosted checkout redirect.
3. **Confirm** — either poll the checkout status via the API, or (preferred) receive the
   **webhook** and call `orders.markPaid({ orderNo, sumupCheckoutId })`.
4. **Fulfil** — `markPaid` flips status to `paid`, issues any loyalty reward, and should trigger:
   - invoice PDF generation (lines carry batch + verifyId),
   - the confirmation email (invoice + COA attached).

## Keys & environment
- `SUMUP_SECRET_KEY` — set as a Convex environment variable; used only inside actions.
- Never expose the secret key or create checkouts from the client.

## Testing
- Use a **sandbox** merchant account for development.
- Per SumUp's sandbox rules, a transaction **amount with value 11** (e.g. €0.11) always fails —
  use it to exercise the declined-payment path. The design reference simulates this with test
  card `4000 0000 0000 0002`.

## Compliance note
Confirm SumUp will underwrite the research-compound category before go-live.
