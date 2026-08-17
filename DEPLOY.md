# Deploying Timento

Two halves: the **Next.js app on Vercel** (live now) and the **Convex production
backend** (one owner-only step away — it needs a deploy key only the project
owner can mint).

## Current state

*Last verified 2026-08-16 against the Deploy verify runs on `master`. Everything
below is either observed in a CI run or explicitly marked unverified — an
earlier version of this section described a dead site long after it had
recovered, which is worse than saying nothing.*

- Vercel project `peppy` serves Timento (`/` is the app, `/why` the explainer).
  It runs in **demo mode** — in-memory backend, demo fixtures, passcodes
  Liam 2580 / Artur 1379 — configured by the committed `.env.production`, which
  holds public values only. Those passcodes guard nothing real; they stop being
  the login the moment Convex prod is seeded with real ones.
- **Git-integrated deploys work.** A merge to `master` produces a Vercel
  deployment, which emits a `deployment_status` webhook, which triggers the
  Deploy verify workflow against that deployment's URL. Observed on `40dd6ee`,
  `51047fd`, `35cc0ac` and `d8bbb39` — all green. The older note in this file
  claiming deploys were manual file-tree uploads with no Git integration is
  wrong and has been removed.
- **The build is healthy and publicly reachable.** Deploy verify drives 26
  click-suite checks and 63 accessibility screen-scans anonymously against each
  new deployment and they pass, so Deployment Protection is off and the app
  renders. The 2026-08-13 `500` (a `ConvexReactClient` constructed with an
  unusable URL, throwing during server render) is fixed in
  `src/app/_lib/backend.tsx`, which now validates the endpoint and falls back to
  the demo backend rather than taking the site down.
- **Unverified: the vanity alias.** Deploy verify probes the deployment-specific
  URL the webhook hands it (e.g. `peppy-hcl1rw722-…vercel.app`), so a green run
  proves *that deployment* is good — not that
  `https://peppy-liams-projects-eb2f3bfa.vercel.app` is aliased to the newest
  one. A Claude container cannot reach `*.vercel.app`, so this cannot be checked
  from a session. One command settles it:

  ```sh
  curl -sI https://peppy-liams-projects-eb2f3bfa.vercel.app | head -1
  ```

- The Claude Vercel connector still cannot see project `peppy` (`get_project`
  returns 404) and this container holds no Vercel token, so a *session* cannot
  drive a redeploy. That no longer blocks anything, because merges deploy
  themselves.
- The Convex **prod** deployment (`patient-wildebeest-774`, dashboard:
  `boundless-synergy/peppy-c3b07`) exists but **has no functions pushed yet**.
  Everything backend-real waits on this — see the owner steps below.
- **CI** runs lint → typecheck → vitest → Convex deploy check → build on every
  PR. **Deploy verify** runs the click-suite and the accessibility sweep against
  each deployment. The Convex step needs `CONVEX_DEPLOY_KEY` and warns rather
  than failing when it is absent (see below).

### Why there is a Convex deploy check

Nothing in CI used to look at `convex/` at all. Vitest resolves those modules
through Vite and `next build` ignores the directory, so two defects shipped
green: thirteen `logic-*.ts` modules whose hyphenated paths Convex cannot
address — they had never reached a deployment — and a `crons.ts` import that
pulled `web-push` into the default runtime.

`tests/convex-deployability.test.ts` now catches both classes in seconds without
credentials: it checks every module path is a valid identifier, that the
generated `api.d.ts` still matches the filesystem, and that no default-runtime
module can reach a `"use node"` module through a value import — walking the
whole import graph, so a second hop through a helper is caught too.

`npx convex deploy --dry-run` is the authority for everything else. Add
`CONVEX_DEPLOY_KEY` under **Settings → Secrets and variables → Actions** to
switch it on; until then that CI step emits a warning annotation and passes, so
a green tick never silently means "the backend is fine".

## Going fully live on Convex prod (owner steps)

All commands run from a checkout where you've done `npx convex login`
(or use the dashboard where noted). Verified against convex CLI 1.43.

1. **Mint a production deploy key**
   - Dashboard: `dashboard.convex.dev` → team `boundless-synergy` → project
     `peppy-c3b07` → Production deployment → Settings → URL & Deploy Key →
     Generate. Key looks like `prod:patient-wildebeest-774|…`.
   - Or CLI: `npx convex deployment token create vercel-prod --prod`
   - While you have it: add the same value as a **GitHub Actions secret** named
     `CONVEX_DEPLOY_KEY` (repo → Settings → Secrets and variables → Actions).
     That switches on the `Convex deploy check` step in CI, which runs
     `npx convex deploy --dry-run` — it prints the configuration it would push
     and deploys nothing, so it is safe on pull requests.

2. **First push of functions + schema to prod** (do this once, before flipping
   the frontend): `npx convex deploy` (targets the project's default production
   deployment when you're logged in). Store pages are `force-dynamic`, so no
   build-time Convex calls block this ordering.

3. **Seed Timento on prod — with real passcodes** (the demo passcodes ship in
   the client bundle; never keep them on prod). This wipes and re-creates all
   `tm_*` tables, so run it once at go-live only:

   ```sh
   npx convex run tm/seed:run '{"passcodes": {"liam": "<real>", "artur": "<real>"}}' --prod
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

## Reminders: one step left, and it is yours

Reminders are wired end to end. `convex/crons.ts` sweeps every 30 minutes,
`convex/tm/remind.ts` decides what is due using the same pure module the
Reminders tab previews from, and `convex/tm/push.ts` signs and sends it with
`web-push`. The client half — service worker, subscription, iOS install
gating — is in place too.

**The only thing missing is the keys**, because a VAPID keypair is an identity
for your deployment and is not something to generate into a repo.

```sh
npx web-push generate-vapid-keys
npx convex env set VAPID_PUBLIC_KEY  <public>                --prod
npx convex env set VAPID_PRIVATE_KEY <private>               --prod
npx convex env set VAPID_SUBJECT     mailto:you@example.com  --prod
```

Then redeploy the frontend. `NEXT_PUBLIC_CONVEX_URL` already carries the public
key to the browser through `remind.get`, so no client env var is needed.

Email is an optional second channel for the same reminder plan (one mention,
both transports). Set these on Convex for the closed-tab sweep, and on the
Next.js host for demo / open-tab send:

```sh
npx convex env set RESEND_API_KEY     re_...                 --prod
npx convex env set REMIND_EMAIL_FROM  "Timento <onboarding@resend.dev>" --prod
```

Until those are set, the sweep logs one line naming the missing variables and
leaves every subscription untouched — nothing is marked delivered and no device
is charged a failure it did not earn, because the failure is the deployment's.
The tab says the same thing rather than showing a switch that lies. Demo can
send while the app is open if the same keys are on the Next.js process.

**Do not remove `web-push` from `dependencies`.** The import in `push.ts` is
static, so an uninstalled package fails `npx convex deploy` rather than quietly
sending nothing at 8am. That is deliberate: it was a dynamic import precisely so
it *could* degrade quietly, and moving the failure to deploy time is the point.

**Verifying it actually works** — the tab's "send a test" button draws a
notification from the worker already running in the browser. That proves the
worker, the icons and the permission; it does **not** prove the server can reach
a shut tab. For that, from a checkout:

```sh
npx convex run tm/push:sweep '{"windowMinutes": 1440}' --prod
```

It returns `{users, notifications, sent, reason}` — `reason: "no-vapid"` means
the keys are not set, `"nothing-due"` means nobody had anything owing in the
window, and `"sent"` with a non-zero `sent` means a push left the server.

### iOS

Notifications only work once the app is added to the Home Screen (Safari →
Share → Add to Home Screen). Apple allows no other route, and iOS has neither
Background Sync nor Periodic Sync — which is why the schedule lives on the
server and the device only receives.

**iOS**: notifications only work once the app is added to the Home Screen
(Safari → Share → Add to Home Screen). Apple allows no other route, and iOS has
neither Background Sync nor Periodic Sync — which is why the schedule lives on
the server and the device only receives.

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
