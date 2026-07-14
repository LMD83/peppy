# Peppy API Reference

Peppy's data layer runs on [Convex](https://convex.dev) — there is no
separate REST API. The storefront talks to Convex directly: server
components use `fetchQuery` (see `convex/nextjs`), and client components use
`useQuery` / `useMutation` from `convex/react`. This document is the
function-level reference, written to be pasted into a ReadMe.io **guide**
(Markdown) page rather than the REST **API Reference** page — there's no
OpenAPI spec here because there's no HTTP/REST surface to describe.

Publishing to ReadMe.io requires a project API key from your ReadMe
dashboard (Configuration → API Keys), which this environment doesn't have.
To publish: create a ReadMe project, install the CLI (`npm i -g rdme`), then
run `rdme docs upload docs/api --key=<your-key>` (or paste this file into a
new guide page in the dashboard).

## Deployment

Not yet provisioned. (The `fearless-wolf-510` deployment previously listed
here was assigned in error — that deployment is actually TARA's, see
`tara/README.md`.) Run `npx convex dev` to create Peppy's own deployment,
then set `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` in `.env.local` —
see `.env.example`. No HTTP actions are defined yet (`convex/http.ts` does
not exist), so a `.convex.site` URL, once you have one, has nothing routed
to it.

## Functions

### `products`

| Function | Type | Args | Returns |
|---|---|---|---|
| `products.list` | query | — | all products |
| `products.getByHandle` | query | `{ handle }` | one product or `null` |
| `products.byCollection` | query | `{ collection }` | products in a collection |
| `products.bestsellers` | query | — | products flagged `bestseller` |
| `products.related` | query | `{ handle, limit? }` | up to `limit` (default 3) other products, bestsellers first |

### `collections`

| Function | Type | Args | Returns |
|---|---|---|---|
| `collections.list` | query | — | all collections |
| `collections.getBySlug` | query | `{ slug }` | one collection or `null` |

### `reviews`

| Function | Type | Args | Returns |
|---|---|---|---|
| `reviews.byProduct` | query | `{ handle }` | reviews for a product |
| `reviews.ratingSummary` | query | `{ handle }` | `{ rating, count }` — average rounded to 1dp |

### `articles`

| Function | Type | Args | Returns |
|---|---|---|---|
| `articles.list` | query | — | all articles, newest first |
| `articles.getBySlug` | query | `{ slug }` | one article or `null` |

### `pages`

| Function | Type | Args | Returns |
|---|---|---|---|
| `pages.getBySlug` | query | `{ slug }` | one informational/legal page or `null` |

### `cart`

Carts are keyed by a random `sessionId` generated client-side and stored in
`localStorage` (see `src/lib/cart-context.tsx`) — there is no login system,
so a cart is scoped to a browser, not an account.

| Function | Type | Args | Returns |
|---|---|---|---|
| `cart.get` | query | `{ sessionId }` | cart lines (`[]` if none) |
| `cart.add` | mutation | `{ sessionId, handle, name, flavour, subscribe, qty, basePrice, accent }` | — |
| `cart.setQty` | mutation | `{ sessionId, id, qty }` | — (removes the line if `qty <= 0`) |
| `cart.remove` | mutation | `{ sessionId, id }` | — |
| `cart.clear` | mutation | `{ sessionId }` | — |

### `orders`

| Function | Type | Args | Returns |
|---|---|---|---|
| `orders.place` | mutation | `{ sessionId, email? }` | new order id — throws if the cart is empty |
| `orders.getBySession` | query | `{ sessionId }` | orders placed by this session |

`orders.place` snapshots the current cart lines, computes shipping via the
same `shippingFor` helper used by the cart/checkout UI
(`src/lib/checkout.ts`), and clears the cart. **No payment is taken** — see
the comment in `src/app/checkout/page.tsx` for the Stripe integration point.

### `seed`

| Function | Type | Args | Returns |
|---|---|---|---|
| `seed.run` | internal mutation | — | — |

Not part of the public API — callable only via `npx convex run seed:run` or
the Convex dashboard. Clears and re-populates every table from the fixtures
in `src/lib/products.ts`, `reviews.ts`, `pages.ts`, and `articles.ts`.
