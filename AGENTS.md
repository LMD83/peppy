<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Timento

## What This Is
Timento — a two-person performance file (daily checks, protocol modes, craving
logging, crew accountability, evidence-first research view). The app is the
whole site: `/` is the app, `/why` the mechanism explainer. Started from a
website-clone template, which is where the scaffolding notes below come from.

## Tech Stack
- **Framework:** Next.js 16 (App Router, React 19, TypeScript strict)
- **UI:** shadcn/ui (Radix primitives, Tailwind CSS v4, `cn()` utility)
- **Icons:** Lucide React (default — will be replaced/supplemented by extracted SVGs)
- **Styling:** Tailwind CSS v4 with oklch design tokens
- **Deployment:** Vercel

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint check
- `npm run typecheck` — TypeScript check
- `npm run check` — Run lint + typecheck + build

## Code Style
- TypeScript strict mode, no `any`
- Named exports, PascalCase components, camelCase utils
- Tailwind utility classes, no inline styles
- 2-space indentation
- Responsive: mobile-first

## Product Invariants
- **Crew views share a projection only** — adherence and streaks, never absolute weights or another user's raw entries. `tests/timento.test.ts` asserts this at the query boundary; keep those tests passing when touching `convex/tm`.
- **Survival mode is a floor, not a lite mode** — exactly three checks, no macro tracking. See `/why` for the mechanism behind each design choice.
- **Demo mode must keep working** — `NEXT_PUBLIC_TIMENTO_DEMO=1` runs the app off an in-memory backend with fixtures, no Convex required. The e2e click-suite runs against it.
- **Verify by running it** — `npx vitest run` for backend logic, `node scripts/timento-e2e.mjs` for the click-suite across mobile and desktop.

## Project Structure
```
src/
  app/
    page.tsx        # the app shell (login + tabs)
    why/            # mechanism explainer
    _components/    # tab views, cards, dialogs
    _lib/           # demo backend, fixtures, shared client logic
    globals.css     # Tailwind v4 tokens (tm-* design tokens)
  components/
    ui/             # shadcn/ui primitives
  lib/
    utils.ts        # cn() utility (shadcn)
  types/            # TypeScript interfaces
convex/
  schema.ts         # tm_* tables
  tm/               # auth, today, crew, progress, research, seed
tests/              # vitest suite (logic + cross-user privacy proofs)
public/             # PWA manifest and icons
scripts/            # e2e click-suite, icon generation, sync scripts
```

## MOST IMPORTANT NOTES
- When launching Claude Code agent teams, ALWAYS have each teammate work in their own worktree branch and merge everyone's work at the end, resolving any merge conflicts smartly since you are basically serving the orchestrator role and have full context to our goals, work given, work achieved, and desired outcomes.
- After editing `AGENTS.md`, run `bash scripts/sync-agent-rules.sh` to regenerate platform-specific instruction files.
- After editing `.claude/skills/clone-website/SKILL.md`, run `node scripts/sync-skills.mjs` to regenerate the skill for all platforms.

@docs/research/INSPECTION_GUIDE.md

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
