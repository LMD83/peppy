# Timento

A two-person performance file: daily checks, protocol modes, craving logging,
crew accountability, and an evidence-first research view. Built with Next.js 16
(App Router) and Convex.

## Run it locally

```bash
npm install
NEXT_PUBLIC_TIMENTO_DEMO=1 npm run dev:frontend
```

Open <http://localhost:3000>. Demo mode uses an in-memory backend and fixture
data — no Convex setup needed. Demo passcodes: **Liam 2580**, **Conor 1379**.

To run against a live Convex backend instead:

```bash
npm run dev            # starts `convex dev` and `next dev` together
npx convex run tm/seed:run '{"passcodes": {"liam": "…", "conor": "…"}}'
```

Leave `NEXT_PUBLIC_TIMENTO_DEMO` unset (or `0`) so the app talks to Convex.

## Routes

| Path   | What it is                                              |
| ------ | ------------------------------------------------------- |
| `/`    | The app — login, then Today / Crew / Progress / Research |
| `/why` | The mechanism explainer behind the design               |

## Commands

- `npm run dev` — Convex + Next dev servers
- `npm run dev:frontend` — Next only (pair with demo mode)
- `npm run check` — lint + typecheck + build
- `npx vitest run` — backend logic and privacy tests
- `node scripts/timento-e2e.mjs [baseUrl] [shotDir]` — Playwright click-suite
  across mobile and desktop viewports, writing screenshots

## Layout

```
src/app/
  page.tsx          # the app shell (login + tabs)
  why/              # mechanism explainer
  _components/      # tab views, cards, dialogs
  _lib/             # demo backend, fixtures, shared client logic
convex/
  schema.ts         # tm_* tables
  tm/               # auth, today, crew, progress, research, seed
tests/              # vitest suite (logic + cross-user privacy proofs)
```

## Privacy model

Crew views share a projection only — adherence and streaks, never absolute
weights or another user's raw entries. `tests/timento.test.ts` asserts this at
the query boundary; keep those tests passing when touching `convex/tm`.

## Deploying

See [DEPLOY.md](DEPLOY.md) for the Vercel and Convex production path.
