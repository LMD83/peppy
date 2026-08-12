# Deploying peppy (store + Timento)

Two halves: the **Next.js app on Vercel** (live now) and the **Convex production
backend** (one owner-only step away — it needs a deploy key only the project
owner can mint).

## Current state

- Vercel project `peppy` serves the app at
  `https://peppy-liams-projects-eb2f3bfa.vercel.app`. The store talks to the
  existing Convex **dev** deployment (`dependable-vulture-853`) as a fallback;
  Timento runs in **demo mode** (in-memory backend, demo fixtures, passcodes
  Liam 2580 / Conor 1379). Both come from the committed `.env.production`,
  which holds public values only.
- **The URL is currently behind Vercel Authentication** (Deployment
  Protection): team members see the app after the Vercel login redirect;
  anonymous visitors and the `deploy-verify` smoke tests get the auth
  interstitial. To open it up: Vercel dashboard → project `peppy` → Settings →
  Deployment Protection → Vercel Authentication → **Only Preview
  Deployments** (or Disabled).
- The Claude Vercel connector cannot see project `peppy` (it was created by
  this session's deploy and isn't in the connector's granted project list), so
  automated verification and protection changes are blocked until the project
  is added under the integration's project access settings.
- The Convex **prod** deployment for this project
  (`patient-wildebeest-774`, dashboard: `boundless-synergy/peppy-c3b07`) exists
  but has no functions pushed yet.
- CI runs lint → typecheck → **vitest (Timento backend tests)** → build on
  every PR.

## Going fully live on Convex prod (owner steps)

All commands run from a checkout where you've done `npx convex login`
(or use the dashboard where noted). Verified against convex CLI 1.43.

1. **Mint a production deploy key**
   - Dashboard: `dashboard.convex.dev` → team `boundless-synergy` → project
     `peppy-c3b07` → Production deployment → Settings → URL & Deploy Key →
     Generate. Key looks like `prod:patient-wildebeest-774|…`.
   - Or CLI: `npx convex deployment token create vercel-prod --prod`

2. **First push of functions + schema to prod** (do this once, before flipping
   the frontend): `npx convex deploy` (targets the project's default production
   deployment when you're logged in). Store pages are `force-dynamic`, so no
   build-time Convex calls block this ordering.

3. **Seed Timento on prod — with real passcodes** (the demo passcodes ship in
   the client bundle; never keep them on prod). This wipes and re-creates all
   `tm_*` tables, so run it once at go-live only:

   ```sh
   npx convex run tm/seed:run '{"passcodes": {"liam": "<real>", "conor": "<real>"}}' --prod
   ```

4. **Backend secrets on prod** (all optional at deploy time; checkout/payments
   need them at runtime):

   ```sh
   cp .env.convex.example .env.convex   # fill values
   npx convex env set --from-file .env.convex --prod
   npx convex env list --names-only --prod   # verify
   ```

5. **Wire Vercel to Convex** (project `peppy` → Settings):
   - Env var `CONVEX_DEPLOY_KEY=<key from step 1>`, scoped to **Production
     only** — a prod key in Preview builds makes the Convex CLI fail the build
     by design.
   - Build command override: `npx convex deploy --cmd 'npm run build'`.
     The CLI detects Next.js and injects the canonical prod
     `NEXT_PUBLIC_CONVEX_URL` / `NEXT_PUBLIC_CONVEX_SITE_URL` into the build,
     overriding the committed fallbacks.
   - Env var `NEXT_PUBLIC_TIMENTO_DEMO=0` (Production) so Timento switches from
     the demo backend to Convex.

6. **Redeploy** and check `/timento`: the login card should accept the real
   passcodes from step 3, and a second browser signed in as the other user
   should see only the shared crew projection.

## Docker path

`next.config.ts` keeps `output: "standalone"` for Docker/self-hosted builds;
the flag is skipped automatically on Vercel (`process.env.VERCEL`).

## Redeploying the frontend from this repo

Any Vercel deploy of the raw tree must include: `package.json`,
`package-lock.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`,
`.env.production`, `src/**`, `public/**`, `convex/**` (with `_generated`
pre-built — the build never runs codegen). Never include `.env.local` — it
outranks `.env.production` and would bake dev URLs into the bundle.
