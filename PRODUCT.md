# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are a two-person crew holding a shared performance protocol together — typically training partners or household co-holders under sleep debt, evening craving pressure, and seasonal load. The job: open the file, complete today's checks, log the urge without spiraling, and keep the partner accountable without exposing private body data. Seeded names (Liam / Artur) are fixtures for demo and tests, not the permanent cast of the product.

## Product Purpose

Timento is a two-person **performance file**: daily checks, protocol modes (cut / maintain / survival), craving logging into a trigger map, crew accountability, and an evidence-first research view. Success is boring consistency — the day is executed as designed; a lapse is logged and the loop continues. The site *is* the app (`/`); `/why` explains the mechanism.

## Positioning

Shared crew views expose a projection only (adherence, streaks, today's score, mode) — never absolute weights, labs, or another user's raw entries. Survival mode is a floor (exactly three checks, no macros), not a lite diet mode. Mechanism over vibes: craving taps build a schedule you can defend against; modes are pre-committed circuit breakers.

## Operating Context

Mobile-first daily use (PWA). Typical evening window: kitchen close, 20:15 close-out ritual, craving hits, optional 2-minute breathing. Modes change with life load (e.g. newborn week, rehab). Demo mode (`NEXT_PUBLIC_TIMENTO_DEMO=1`) must keep working without Convex for local and e2e verification.

## Capabilities and Constraints

Confirmed: passcode login for crew members; Today checks + kitchen/ritual/weigh-in/state; craving multi-step log + undo; session plan with overload flags; crew board + nudges; Progress mass/consistency; Research trigger map, experiments, markers, owner-only labs; mode switch with survival review dates; Convex backend with mirrored demo store.

Hard invariants for future work:
- Crew privacy at the query boundary (tests in `tests/timento.test.ts`).
- Survival stays exactly three checks.
- No fabricating macros, partner weights, or medical diagnosis language.
- Leftover clone/shop routes are out of product scope.

Undecided: multi-crew beyond two, public signup, notifications — not claimed.

## Brand Commitments

Name: **Timento**. Framing: "performance file." Voice: evidence over pep talk; mono uppercase labels; paper/ink file metaphor. Binding identity language already in product: kitchen close, ritual, tripwire, floor protocol, "executed as designed," "loop continues." Do not rebrand to generic fitness/wellness chrome without an explicit redesign brief.

## Evidence on Hand

Mechanism explainer at `/why`. Design tokens and fonts in `src/app/globals.css` + layout (`Archivo Black`, `IBM Plex Mono/Sans`). Fixtures and seed story in `convex/tm/fixtures.ts`. Inspection notes in `docs/research/INSPECTION_GUIDE.md`. No customer testimonials or press assets — future marketing must not invent them.

## Product Principles

1. **Projection, not surveillance** — share adherence; never share the body file.
2. **Floor before ambition** — survival is an executed decision, not failure theater.
3. **Schedule over character** — cravings get a map; willpower is not the product.
4. **Evidence over vibes** — experiments and markers stay n=1 and disputed until tested.
5. **Demo must run** — any UI change that breaks demo/e2e is unfinished.

## Accessibility & Inclusion

No product-specific WCAG mandate recorded yet. Practical baseline: 44px touch targets on primary controls, visible keyboard focus, respect reduced motion for breathing/timers, never rely on color alone for check/mode state.
