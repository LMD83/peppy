// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The accessibility floor, asserted against the real stylesheet.
 *
 * Contrast claims rot the moment someone nudges a hex, and a comment saying
 * "4.6:1" is worth nothing on its own. So: parse the actual token values out of
 * globals.css — BOTH colour schemes, since the dark media query re-points every
 * var — recompute every ratio from the WCAG 2.x definition, and fail if any
 * pairing the app really renders drops below its threshold in either scheme.
 *
 * WCAG 2.2:
 *   1.4.3 Contrast (Minimum)      — 4.5:1 for body text, 3:1 for large text
 *   1.4.11 Non-text Contrast      — 3:1 for UI component boundaries and states
 */

const CSS = readFileSync(resolve(__dirname, "../src/app/globals.css"), "utf8");

/* ---- WCAG relative luminance and contrast ratio (no library, no hand-waving) */

function channel(value8Bit: number): number {
  const s = value8Bit / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance of an #rrggbb colour. */
export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return (
    0.2126 * channel((n >> 16) & 0xff) +
    0.7152 * channel((n >> 8) & 0xff) +
    0.0722 * channel(n & 0xff)
  );
}

/** WCAG 2.x contrast ratio, 1.0 … 21.0. Order-independent. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const round = (n: number) => Math.round(n * 100) / 100;

/* ---- token values, read out of the stylesheet, per scheme ----------------- */

const DARK_MARKER = "@media (prefers-color-scheme: dark)";

function parseTokens(src: string): Record<string, string> {
  const found: Record<string, string> = {};
  // Raw scheme vars: --tm-name: #hex;  (the @theme block holds only var()
  // references, and the shadcn block above it is oklch — neither matches.)
  for (const [, name, hex] of src.matchAll(/--(tm-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    found[name] = hex.toLowerCase();
  }
  return found;
}

const darkStart = CSS.indexOf(DARK_MARKER);
const LIGHT_T = parseTokens(CSS.slice(0, darkStart));
// Everything after the dark marker: the only --tm-*: #hex declarations there
// are the dark :root's (the later preference blocks re-declare utilities, and
// easy mode's --tm-type-floor is not a hex).
const DARK_ONLY = parseTokens(CSS.slice(darkStart));
// A token the dark block does not re-declare falls through to its light value.
const DARK_T = { ...LIGHT_T, ...DARK_ONLY };

const SCHEMES: [string, Record<string, string>][] = [
  ["light", LIGHT_T],
  ["dark", DARK_T],
];

/** A hex literal used directly in a component, not (yet) a token. Only board
 * text still does this, and the board is dark in both schemes. */
const LITERAL = {
  white: "#ffffff",
} as const;

function colour(T: Record<string, string>, ref: string): string {
  const value = T[ref] ?? LITERAL[ref as keyof typeof LITERAL];
  if (!value) throw new Error(`no such colour: ${ref}`);
  return value;
}

describe("the contrast function itself", () => {
  it("reproduces the WCAG reference values", () => {
    expect(round(contrastRatio("#ffffff", "#000000"))).toBe(21);
    expect(round(contrastRatio("#ffffff", "#ffffff"))).toBe(1);
    // sRGB primaries, per the WCAG technique worked examples.
    expect(round(contrastRatio("#ff0000", "#ffffff"))).toBe(4);
    expect(round(contrastRatio("#0000ff", "#ffffff"))).toBe(8.59);
  });

  it("reproduces the failures this work was commissioned to fix", () => {
    // The measured findings, from the palette as it shipped.
    expect(round(contrastRatio("#70747b", "#fafaf8"))).toBe(4.49); // old tm-dim on paper
    expect(round(contrastRatio("#9ba0a8", "#ffffff"))).toBe(2.63); // old tm-dim2 on panel
    expect(round(contrastRatio("#ffffff", "#c77d1f"))).toBe(3.29); // white on old survival amber
    expect(round(contrastRatio("#c77d1f", "#fbf3e4"))).toBe(2.98); // old amber on amber-bg
    expect(round(contrastRatio("#b8860b", "#ffffff"))).toBe(3.25); // old tm-yellow on panel
  });
});

const TOKEN_NAMES = [
  "tm-paper", "tm-panel", "tm-ink", "tm-ink2", "tm-ink3", "tm-inkrule", "tm-dim",
  "tm-dim2", "tm-onink", "tm-rule", "tm-rule-strong", "tm-grid", "tm-soft",
  "tm-blue", "tm-red", "tm-green", "tm-green-faint", "tm-blue-faint", "tm-red-bg",
  "tm-yellow", "tm-amber", "tm-amber-bg", "tm-amber-ink", "tm-amber-lift",
  "tm-purple", "tm-focus",
  // The fill roles: the board is dark in both schemes; stamps and semantic
  // fills flip light in dark with deep text on them.
  "tm-board", "tm-stamp", "tm-onstamp", "tm-ongreen", "tm-onamber", "tm-onred",
  "tm-onblue", "tm-scrim",
];

describe("globals.css exposes the tokens the app is built on", () => {
  it.each(SCHEMES)("%s scheme declares every Timento colour token", (_scheme, T) => {
    for (const name of TOKEN_NAMES) {
      expect(T[name], `--${name} missing`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("maps every utility token onto its scheme var", () => {
    // The @theme block must reference vars, not literals — a literal there is
    // baked into the utility and the dark block silently stops applying to it.
    const theme = CSS.slice(CSS.indexOf("--color-tm-paper"), CSS.indexOf("--font-tm-disp"));
    for (const [, name] of theme.matchAll(/--color-(tm-[a-z0-9-]+):/g)) {
      expect(theme, `--color-${name} must resolve to var(--${name})`).toContain(
        `--color-${name}: var(--${name});`,
      );
    }
  });

  it("re-points the whole palette in the dark scheme, not a subset", () => {
    // Silent fall-through is how a half-dark theme ships: assert the dark
    // block re-declares every light token (same value is fine — amber-lift,
    // onink and scrim are shared on purpose).
    for (const name of Object.keys(LIGHT_T)) {
      if (name === "tm-type-floor") continue;
      expect(DARK_ONLY[name], `dark block does not re-declare --${name}`).toBeDefined();
    }
  });

  it.each(SCHEMES)("%s scheme has not silently reverted to a value that fails", (_scheme, T) => {
    const retired = ["#70747b", "#9ba0a8", "#c77d1f", "#b8860b", "#c7373f", "#2e7d4f", "#8a5a9e"];
    for (const [name, value] of Object.entries(T)) {
      expect(retired, `--${name} is back to a known-failing value`).not.toContain(value);
    }
  });
});

/* ---- the pairings the app actually renders ------------------------------- */

type Pair = [fg: string, bg: string, min: number, where: string];

/**
 * Every page surface a muted foreground lands on. In the light scheme grid is
 * the darkest and binds; in dark the same six names hold the dark surfaces and
 * the loop checks them all the same way.
 */
const SURFACES = ["tm-paper", "tm-panel", "tm-soft", "tm-grid", "tm-amber-bg", "tm-green-faint"];

const TEXT_PAIRS: Pair[] = [
  ...SURFACES.map((bg): Pair => ["tm-ink", bg, 4.5, "body ink everywhere"]),
  ...SURFACES.map((bg): Pair => ["tm-dim", bg, 4.5, "the colour of most small text in the app"]),
  ...SURFACES.map((bg): Pair => ["tm-dim2", bg, 4.5, "crew chips, mind pills"]),
  ...SURFACES.map((bg): Pair => ["tm-amber", bg, 4.5, "survival accents, evidence tiers, borderline labs"]),
  ...SURFACES.map((bg): Pair => ["tm-green", bg, 4.5, "adherence, taken doses, in-range markers"]),
  ...SURFACES.map((bg): Pair => ["tm-red", bg, 4.5, "tripwires, out-of-range labs"]),
  ...SURFACES.map((bg): Pair => ["tm-blue", bg, 4.5, "state check, weigh-in"]),
  ...SURFACES.map((bg): Pair => ["tm-purple", bg, 4.5, "mind instrument accents"]),
  ["tm-yellow", "tm-panel", 4.5, "research: unclear markers"],
  ["tm-yellow", "tm-grid", 4.5, "research: unclear markers"],
  ["tm-amber-ink", "tm-amber-bg", 4.5, "every survival/tripwire paragraph"],
  ["tm-amber-ink", "tm-panel", 4.5, "mind encouragement copy"],
  ["tm-green", "tm-green-faint", 4.5, "ModeBadge cut, kitchen ritual done"],
  ["tm-blue", "tm-blue-faint", 4.5, "ModeBadge maintain"],
  ["tm-red", "tm-red-bg", 4.5, "login error panel"],

  // Text sitting ON a filled control — via the on-* role tokens, so the fills
  // can flip light in dark while the text flips deep.
  ["tm-onamber", "tm-amber", 4.5, "SURVIVAL: the ticked floor check — the worst screen in the app"],
  ["tm-ongreen", "tm-green", 4.5, "a ticked check in cut/maintain"],
  ["tm-onblue", "tm-blue", 4.5, "filled blue controls"],
  ["tm-onstamp", "tm-stamp", 4.5, "primary buttons, selected chips and rows"],
  ["tm-onred", "tm-red", 4.5, "danger buttons"],
  ["tm-board", "tm-amber-lift", 4.5, "the survival mode-switch chip in the header"],

  // The board (scoreboard + login banner) is dark in both schemes, so its
  // white title and muted onink text hold without flipping.
  ["tm-onink", "tm-board", 4.5, "eyebrow, stat labels, sign-out"],
  ["tm-onink", "tm-ink2", 4.5, "stat sub-labels"],
  ["tm-onink", "tm-ink3", 4.5, "mode switcher copy"],
  ["tm-amber-lift", "tm-board", 4.5, "SURVIVAL: 'executing as designed' in the header"],
  ["white", "tm-board", 4.5, "the header title"],
  ["white", "tm-ink2", 4.5, "mode switcher option name"],
];

describe("1.4.3 — text contrast", () => {
  for (const [scheme, T] of SCHEMES) {
    it.each(TEXT_PAIRS)(`${scheme}: %s on %s clears %s:1 (%s)`, (fg, bg, min) => {
      const ratio = contrastRatio(colour(T, fg), colour(T, bg));
      expect(
        round(ratio),
        `[${scheme}] ${fg} (${colour(T, fg)}) on ${bg} (${colour(T, bg)}) is ${round(ratio)}:1, needs ${min}:1`,
      ).toBeGreaterThanOrEqual(min);
    });
  }
});

const UI_PAIRS: Pair[] = [
  ["tm-rule-strong", "tm-panel", 3, "input and chip boundaries"],
  ["tm-rule-strong", "tm-paper", 3, "input and chip boundaries"],
  ["tm-rule-strong", "tm-soft", 3, "chips on the soft fill"],
  ["tm-amber", "tm-panel", 3, "survival card border"],
  ["tm-green", "tm-panel", 3, "ticked-check border, nav indicator"],
  ["tm-focus", "tm-paper", 3, "focus ring on the page"],
  ["tm-focus", "tm-panel", 3, "focus ring on a card"],
  ["tm-focus", "tm-soft", 3, "focus ring on the soft fill"],
  ["tm-focus", "tm-board", 3, "focus ring on the dark header"],
  ["tm-focus", "tm-ink3", 3, "focus ring inside the mode switcher"],
];

describe("1.4.11 — non-text contrast", () => {
  for (const [scheme, T] of SCHEMES) {
    it.each(UI_PAIRS)(`${scheme}: %s against %s clears %s:1 (%s)`, (fg, bg, min) => {
      const ratio = contrastRatio(colour(T, fg), colour(T, bg));
      expect(
        round(ratio),
        `[${scheme}] ${fg} (${colour(T, fg)}) against ${bg} (${colour(T, bg)}) is ${round(ratio)}:1, needs ${min}:1`,
      ).toBeGreaterThanOrEqual(min);
    });
  }
});

describe("survival mode is not the least legible screen we ship", () => {
  // The whole point of the retune: the floor screen has to be at least as
  // legible as the cut screen, because it is the one someone reads on a bad day.
  it.each(SCHEMES)("%s: holds the amber surface to the green surface's standard", (_scheme, T) => {
    const amberOnFill = contrastRatio(colour(T, "tm-onamber"), colour(T, "tm-amber"));
    const greenOnFill = contrastRatio(colour(T, "tm-ongreen"), colour(T, "tm-green"));
    expect(round(amberOnFill)).toBeGreaterThanOrEqual(4.5);
    expect(round(greenOnFill)).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(amberOnFill - greenOnFill)).toBeLessThan(1.5);
  });

  it.each(SCHEMES)("%s: keeps the amber card readable end to end", (_scheme, T) => {
    for (const fg of ["tm-amber", "tm-amber-ink", "tm-dim"]) {
      expect(round(contrastRatio(colour(T, fg), colour(T, "tm-amber-bg")))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

/* ---- the rest of the floor, asserted structurally ------------------------ */

describe("the stylesheet carries the rest of the floor", () => {
  it("keeps the floor token easy mode reads", () => {
    // The sub-floor net is gone — the classes it caught were raised at the
    // source on 2026-08-17, and a11y-floor-guard.test.ts bans their return.
    // What remains load-bearing here is the token easy mode re-points to 16px.
    expect(CSS).toContain("--tm-type-floor: 11.5px");
  });

  it("declares a :focus-visible ring from a token", () => {
    expect(CSS).toMatch(/button:focus-visible/);
    expect(CSS).toMatch(/outline:\s*3px solid var\(--tm-focus\)/);
    expect(CSS).toMatch(/outline-offset:\s*2px/);
  });

  it("answers the four user preferences", () => {
    expect(CSS).toContain("@media (prefers-reduced-motion: reduce)");
    expect(CSS).toContain("@media (prefers-contrast: more)");
    expect(CSS).toContain("@media (forced-colors: active)");
    expect(CSS).toContain("@media (prefers-color-scheme: dark)");
  });

  it("gives contrast-more a dark answer too", () => {
    // The light overrides are near-black text; without a dark counterpart,
    // dark + contrast-more would collapse muted text INTO the background.
    expect(CSS).toContain("@media (prefers-contrast: more) and (prefers-color-scheme: dark)");
  });

  it("stills pulse and the breathe fill without a global 0.01ms kill", () => {
    const reduced = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
    const block = reduced.slice(0, reduced.indexOf("@media (prefers-contrast"));
    expect(block).toContain(".animate-pulse");
    expect(block).toContain('[role="timer"] .transition-all');
    expect(block).not.toMatch(/\*\s*,\s*\n\s*\*::before/);
    expect(block).not.toContain("0.01ms");
  });

  it("restores a state boundary when forced colours drop the background", () => {
    const forced = CSS.slice(CSS.indexOf("@media (forced-colors: active)"));
    for (const state of ['[aria-pressed="true"]', '[aria-selected="true"]', '[aria-checked="true"]', "[aria-current]"]) {
      expect(forced).toContain(state);
    }
    expect(forced).toMatch(/outline:\s*3px solid Highlight/);
  });

  it("gives body copy the spacing the dyslexia evidence supports, and no novelty font", () => {
    expect(CSS).toMatch(/line-height:\s*1\.55/);
    expect(CSS).toMatch(/letter-spacing:\s*0\.01em/);
    expect(CSS).not.toMatch(/OpenDyslexic|Dyslexie/i);
  });
});
