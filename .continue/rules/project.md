<!-- AUTO-GENERATED from AGENTS.md — do not edit directly.
     Run `bash scripts/sync-agent-rules.sh` to regenerate. -->

---
description: Project conventions for AI Website Clone Template
alwaysApply: true
---
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
- **Nothing here diagnoses or prescribes** — the stack tracks only what the user configured, assessments are scored server-side and framed as tracked-and-correlated, and evidence strength is labelled wherever a claim is made. A PHQ-9 self-harm answer surfaces real support (999/112, Samaritans 116 123); it is never presented as a risk assessment.

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
    <slice>.ts      # query + mutations per domain slice
    logic-<slice>.ts# pure domain logic, shared with the demo backend
    data/           # static catalogues (foods, exercises, compounds, markers, instruments)
    fixtures/       # per-slice fixture builder + seeder, composed by fixtures.ts
tests/              # vitest suite (logic + cross-user privacy proofs)
public/             # PWA manifest and icons
scripts/            # e2e click-suite, icon generation, sync scripts
```

## Domain slices
Five verticals sit behind the Fuel, Train, Body (Stack/Bloods/Trend) and Mind tabs:
**fuel** (adaptive TDEE, macro targets, meal plan), **train** (mesocycle, RIR progression,
MEV/MAV/MRV volume), **stack** (meds/peptides/supplements, cycles, dose adherence,
reconstitution), **labs** (panels, reference vs optimal bands, trends, rechecks) and
**mind** (PHQ-9/GAD-7/PSS-10/WHO-5/ISI/AUDIT-C/PACS, implementation intentions, reflection).

Four more reach their own screens from the More shelf: **supply** (counts, run-out dates,
refill sheet), **shop** (aisle-ordered list, packs, retailer hand-off), **remind** (what is
worth interrupting someone for — quiet hours, once-only, the survival floor) and **capture**
(a photo as evidence, never as an identification). `remind` and `capture` share one Convex
module, `convex/tm/remind.ts`, because backend.tsx wires their mutations together; the rules
stay in their own `logic-remind.ts` / `logic-capture.ts`, and `remind.get` carries the whole
capture view through under `capture`.

Two things the reminder slice cannot do yet, deliberately: `web-push` is not a dependency, so
`convex/crons.ts` computes the correct plan and logs instead of sending; and without
`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` on the deployment, `remind.get` reports
`supported: false` so the tab says so rather than showing a switch that lies.

Each slice owns a fixed set of files and never edits another's. The rule that keeps the two
backends honest: **all arithmetic lives in `logic-<slice>.ts`**, and both `convex/tm/<slice>.ts`
and `src/app/_lib/demo/<slice>.ts` call it to build the same view model — the demo module
imports its return type from the Convex query, so a drift is a compile error, not a bug.
`src/app/_lib/demo/rows.ts` is the row-shape contract fixtures must match.

## MOST IMPORTANT NOTES
- When launching Claude Code agent teams, ALWAYS have each teammate work in their own worktree branch and merge everyone's work at the end, resolving any merge conflicts smartly since you are basically serving the orchestrator role and have full context to our goals, work given, work achieved, and desired outcomes.
- After editing `AGENTS.md`, run `bash scripts/sync-agent-rules.sh` to regenerate platform-specific instruction files.
- After editing `.claude/skills/clone-website/SKILL.md`, run `node scripts/sync-skills.mjs` to regenerate the skill for all platforms.

# Website Inspection Guide

## How to Reverse-Engineer Any Website

This guide outlines what to capture when inspecting a target website via Chrome MCP or browser DevTools.

## Phase 1: Visual Audit

### Screenshots to Capture
- [ ] Every distinct page — desktop, tablet, mobile
- [ ] Dark mode variants (if applicable)
- [ ] Light mode variants (if applicable)
- [ ] Key interaction states (hover, active, open menus, modals)
- [ ] Loading/skeleton states
- [ ] Empty states
- [ ] Error states

### Design Tokens to Extract
- [ ] **Colors** — background, text (primary/secondary/muted), accent, border, hover, error, success, warning
- [ ] **Typography** — font family, sizes (h1-h6, body, caption, label), weights, line heights, letter spacing
- [ ] **Spacing** — padding/margin patterns (look for a scale: 4px, 8px, 12px, 16px, 24px, 32px, etc.)
- [ ] **Border radius** — buttons, cards, avatars, inputs
- [ ] **Shadows/elevation** — card shadows, dropdown shadows, modal overlay
- [ ] **Breakpoints** — when does the layout shift? (inspect with DevTools responsive mode)
- [ ] **Icons** — which icon library? custom SVGs? sizes?
- [ ] **Avatars** — sizes, shapes, fallback behavior
- [ ] **Buttons** — all variants (primary, secondary, ghost, icon-only, danger)
- [ ] **Inputs** — text fields, textareas, selects, checkboxes, toggles

## Phase 2: Component Inventory

For each distinct UI component, document:
1. **Name** — what would you call this component?
2. **Structure** — what HTML elements / child components does it contain?
3. **Variants** — does it have different sizes, colors, or states?
4. **States** — default, hover, active, disabled, loading, error, empty
5. **Responsive behavior** — how does it change at different breakpoints?
6. **Interactions** — click, hover, focus, keyboard navigation
7. **Animations** — transitions, entrance/exit animations, micro-interactions

### Common Components to Look For
- Navigation (top bar, sidebar, bottom bar)
- Cards / list items
- Buttons and links
- Forms and inputs
- Modals and dialogs
- Dropdowns and menus
- Tabs and segmented controls
- Avatars and user badges
- Loading skeletons
- Toast notifications
- Tooltips and popovers

## Phase 3: Layout Architecture

- [ ] **Grid system** — CSS Grid? Flexbox? Fixed widths?
- [ ] **Column layout** — how many columns at each breakpoint?
- [ ] **Max-width** — main content area max-width
- [ ] **Sticky elements** — header, sidebar, floating buttons
- [ ] **Z-index layers** — navigation, modals, tooltips, overlays
- [ ] **Scroll behavior** — infinite scroll, pagination, virtual scrolling

## Phase 4: Technical Stack Analysis

- [ ] **Framework** — React? Vue? Angular? Check `__NEXT_DATA__`, `__NUXT__`, `ng-version`
- [ ] **CSS approach** — Tailwind (utility classes), CSS Modules, Styled Components, Emotion, vanilla CSS
- [ ] **State management** — Redux (check DevTools), React Query, Zustand, Pinia
- [ ] **API patterns** — REST, GraphQL (check network tab for `/graphql` requests)
- [ ] **Font loading** — Google Fonts, self-hosted, system fonts
- [ ] **Image strategy** — CDN, lazy loading, srcset, WebP/AVIF
- [ ] **Animation library** — Framer Motion, GSAP, CSS transitions only

## Phase 5: Documentation Output

After inspection, create these files in `docs/research/`:
1. `DESIGN_TOKENS.md` — All extracted colors, typography, spacing
2. `COMPONENT_INVENTORY.md` — Every component with structure notes
3. `LAYOUT_ARCHITECTURE.md` — Page layouts, grid system, responsive behavior
4. `INTERACTION_PATTERNS.md` — Animations, transitions, hover states
5. `TECH_STACK_ANALYSIS.md` — What the site uses and our chosen equivalents


<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
