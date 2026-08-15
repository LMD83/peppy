# Deploying Timento

Two halves: the **Next.js app on Vercel** (live now) and the **Convex production
backend** (one owner-only step away — it needs a deploy key only the project
owner can mint).

## Current state

- Vercel project `peppy` serves Timento at the site root
  `https://peppy-liams-projects-eb2f3bfa.vercel.app` (`/` is the app, `/why`
  the explainer). It runs in **demo mode** (in-memory backend, demo fixtures,
  passcodes Liam 2580 / Conor 1379), configured by the committed
  `.env.production`, which holds public values only.
- **Deployment Protection is off** — the URL answers anonymous requests with
  real app HTML (confirmed by a `deploy-verify` probe on 2026-08-13). It was
  previously behind Vercel Authentication, which is why earlier smoke runs saw
  the login interstitial.
- **Production is serving a stale build, and it now returns 500.** As of
  2026-08-13 the deployment answers `/` with a Next.js error page
  (`id="__next_error__"`) and *no* `x-vercel-error` header, which rules out a
  platform fault: the function ran and the application threw during server
  render. Every probe since has reported the same deployment id
  (`dpl_F7eMzNNvZUe7S2zAUqydt8u3kpbY`), so **nothing has been redeployed** —
  deploys here are manual file-tree uploads and the project has no Git
  integration, so neither a push nor a merge to `master` changes what is live.
- The most likely cause was reproduced locally: with `NEXT_PUBLIC_TIMENTO_DEMO`
  unset (or not `1`) and `NEXT_PUBLIC_CONVEX_URL` holding a placeholder or
  otherwise unusable value, `new ConvexReactClient(url)` throws inside render
  and `next build` exits with `Export encountered an error on /page: /`.
  `src/app/_lib/backend.tsx` now validates the endpoint first and falls back to
  the demo backend instead of taking the site down — but **that fix only helps
  once something redeploys.** Setting `NEXT_PUBLIC_TIMENTO_DEMO=1` in the Vercel
  project's environment variables fixes the same failure without a code change.
- The Claude Vercel connector cannot see project `peppy` (it isn't in the
  connector's granted project list — `get_project` returns 404), and this
  container holds no Vercel token, so redeploys cannot be driven from a
  session. To unblock automated deploys, either add `peppy` under the Vercel
  integration's project access settings, or connect the project to the GitHub
  repo so merges to `master` deploy themselves.
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

6. **Redeploy** and check `/`: the login card should accept the real
   passcodes from step 3, and a second browser signed in as the other user
   should see only the shared crew projection.

## Docker path

`next.config.ts` keeps `output: "standalone"` for Docker/self-hosted builds;
the flag is skipped automatically on Vercel (`process.env.VERCEL`).

## Known build fragility: fonts are fetched at build time

`src/app/layout.tsx` uses `next/font/google`, which downloads Archivo Black and
IBM Plex from `fonts.gstatic.com` **during the build**. A network blip on the
runner therefore fails the whole build with a wall of
`Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'`
against generated `…module.css` files. Seen on CI 2026-08-15 on a commit that
changed only workflow YAML, minutes after the same tree built clean.

It is transient — re-run the job and it passes. The durable fix is to vendor the
`.woff2` files into `public/` and switch to `next/font/local`, which removes the
build-time network dependency from every CI run *and* every Vercel deploy. Worth
doing the next time this costs anyone ten minutes.

## Redeploying the frontend from this repo

Simplest path from a checkout with `npx vercel login` done:

```sh
npx vercel --prod        # link to project `peppy` when prompted
```

Any Vercel deploy of the raw tree must include: `package.json`,
`package-lock.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`,
`.env.production`, `src/**`, `public/**`, `convex/**` (with `_generated`
pre-built — the build never runs codegen). Never include `.env.local` — it
outranks `.env.production` and would bake dev URLs into the bundle.
