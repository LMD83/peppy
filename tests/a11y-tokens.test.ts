// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The accessibility floor, asserted against the real stylesheet.
 *
 * Contrast claims rot the moment someone nudges a hex, and a comment saying
 * "4.6:1" is worth nothing on its own. So: parse the actual token values out of
 * globals.css, recompute every ratio from the WCAG 2.x definition, and fail if
 * any pairing the app really renders drops below its threshold.
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

/* ---- token values, read out of the stylesheet ---------------------------- */

function tokens(): Record<string, string> {
  const found: Record<string, string> = {};
  // Only the Timento block declares --color-tm-*; the shadcn block is oklch.
  for (const [, name, hex] of CSS.matchAll(/--color-(tm-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    found[name] = hex.toLowerCase();
  }
  return found;
}

const T = tokens();
/** A hex literal used directly in a component, not (yet) a token. */
const LITERAL = {
  white: "#ffffff",
  "cut-chip": "#e8f1eb", // ui.tsx ModeBadge cut
  "maintain-chip": "#e9eff8", // ui.tsx ModeBadge maintain
  "error-chip": "#faeceb", // login.tsx error panel
  "header-body": "#c9cdd4", // login.tsx blurb, scoreboard mode chip
  "switch-body": "#e6e8ec", // scoreboard.tsx ModeSwitcher option
} as const;

function colour(ref: string): string {
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

describe("globals.css exposes the tokens the app is built on", () => {
  it("parses every Timento colour token", () => {
    for (const name of [
      "tm-paper", "tm-panel", "tm-ink", "tm-ink2", "tm-ink3", "tm-dim", "tm-dim2",
      "tm-onink", "tm-rule", "tm-rule-strong", "tm-grid", "tm-soft", "tm-blue",
      "tm-red", "tm-green", "tm-green-faint", "tm-yellow", "tm-amber",
      "tm-amber-bg", "tm-amber-ink", "tm-amber-lift", "tm-purple", "tm-focus",
    ]) {
      expect(T[name], `--color-${name} missing from globals.css`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("has not silently reverted to a value that fails", () => {
    const retired = ["#70747b", "#9ba0a8", "#c77d1f", "#b8860b", "#c7373f", "#2e7d4f", "#8a5a9e"];
    for (const [name, value] of Object.entries(T)) {
      expect(retired, `--color-${name} is back to a known-failing value`).not.toContain(value);
    }
  });
});

/* ---- the pairings the app actually renders ------------------------------- */

type Pair = [fg: string, bg: string, min: number, where: string];

/**
 * Every light surface a muted foreground lands on. tm-green-faint is the
 * darkest of them, so it is the binding constraint, and it is a real pairing
 * (the stack tab renders text-tm-green on bg-tm-green-faint).
 */
const LIGHT = ["tm-paper", "tm-panel", "tm-soft", "tm-grid", "tm-amber-bg", "tm-green-faint"];

const TEXT_PAIRS: Pair[] = [
  ...LIGHT.map((bg): Pair => ["tm-dim", bg, 4.5, "the colour of most small text in the app"]),
  ...LIGHT.map((bg): Pair => ["tm-dim2", bg, 4.5, "crew chips, mind pills"]),
  ...LIGHT.map((bg): Pair => ["tm-amber", bg, 4.5, "survival accents, evidence tiers, borderline labs"]),
  ...LIGHT.map((bg): Pair => ["tm-green", bg, 4.5, "adherence, taken doses, in-range markers"]),
  ...LIGHT.map((bg): Pair => ["tm-red", bg, 4.5, "tripwires, out-of-range labs"]),
  ...LIGHT.map((bg): Pair => ["tm-blue", bg, 4.5, "state check, weigh-in"]),
  ...LIGHT.map((bg): Pair => ["tm-purple", bg, 4.5, "mind instrument accents"]),
  ["tm-yellow", "tm-panel", 4.5, "research: unclear markers"],
  ["tm-yellow", "tm-grid", 4.5, "research: unclear markers"],
  ["tm-amber-ink", "tm-amber-bg", 4.5, "every survival/tripwire paragraph"],
  ["tm-amber-ink", "tm-panel", 4.5, "mind encouragement copy"],
  ["tm-green", "cut-chip", 4.5, "ModeBadge cut, kitchen ritual done"],
  ["tm-blue", "maintain-chip", 4.5, "ModeBadge maintain"],
  ["tm-red", "error-chip", 4.5, "login error panel"],

  // Reversed: white or ink sitting ON a filled control.
  ["white", "tm-amber", 4.5, "SURVIVAL: the ticked floor check — the worst screen in the app"],
  ["white", "tm-green", 4.5, "a ticked check in cut/maintain"],
  ["white", "tm-blue", 4.5, "filled blue controls"],
  ["white", "tm-ink", 4.5, "primary buttons, the header title"],
  ["tm-ink", "tm-amber-lift", 4.5, "the survival mode-switch chip in the header"],

  // The dark header (scoreboard + login banner).
  ["tm-onink", "tm-ink", 4.5, "eyebrow, stat labels, sign-out"],
  ["tm-onink", "tm-ink2", 4.5, "stat sub-labels"],
  ["tm-onink", "tm-ink3", 4.5, "mode switcher copy"],
  ["tm-amber-lift", "tm-ink", 4.5, "SURVIVAL: 'executing as designed' in the header"],
  ["header-body", "tm-ink", 4.5, "login blurb"],
  ["header-body", "tm-ink3", 4.5, "the mode chip label"],
  ["switch-body", "tm-ink2", 4.5, "mode switcher option name"],
];

describe("1.4.3 — text contrast", () => {
  it.each(TEXT_PAIRS)("%s on %s clears %s:1 (%s)", (fg, bg, min) => {
    const ratio = contrastRatio(colour(fg), colour(bg));
    expect(
      round(ratio),
      `${fg} (${colour(fg)}) on ${bg} (${colour(bg)}) is ${round(ratio)}:1, needs ${min}:1`,
    ).toBeGreaterThanOrEqual(min);
  });
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
  ["tm-focus", "tm-ink", 3, "focus ring on the dark header"],
  ["tm-focus", "tm-ink3", 3, "focus ring inside the mode switcher"],
];

describe("1.4.11 — non-text contrast", () => {
  it.each(UI_PAIRS)("%s against %s clears %s:1 (%s)", (fg, bg, min) => {
    const ratio = contrastRatio(colour(fg), colour(bg));
    expect(
      round(ratio),
      `${fg} (${colour(fg)}) against ${bg} (${colour(bg)}) is ${round(ratio)}:1, needs ${min}:1`,
    ).toBeGreaterThanOrEqual(min);
  });
});

describe("survival mode is not the least legible screen we ship", () => {
  // The whole point of the retune: the floor screen has to be at least as
  // legible as the cut screen, because it is the one someone reads on a bad day.
  it("holds the amber surface to the green surface's standard", () => {
    const amberOnFill = contrastRatio(colour("white"), colour("tm-amber"));
    const greenOnFill = contrastRatio(colour("white"), colour("tm-green"));
    expect(round(amberOnFill)).toBeGreaterThanOrEqual(4.5);
    expect(round(greenOnFill)).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(amberOnFill - greenOnFill)).toBeLessThan(1.5);
  });

  it("keeps the amber card readable end to end", () => {
    for (const fg of ["tm-amber", "tm-amber-ink", "tm-dim"]) {
      expect(round(contrastRatio(colour(fg), colour("tm-amber-bg")))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

/* ---- the rest of the floor, asserted structurally ------------------------ */

describe("the stylesheet carries the rest of the floor", () => {
  it("floors sub-11.5px type", () => {
    expect(CSS).toContain("--tm-type-floor: 11.5px");
    for (const size of ["8\\.5", "9", "9\\.5", "10", "10\\.5", "11"]) {
      expect(CSS, `no floor rule for text-[${size.replace("\\", "")}px]`).toContain(`.text-\\[${size}px\\]`);
    }
  });

  it("declares a :focus-visible ring from a token", () => {
    expect(CSS).toMatch(/button:focus-visible/);
    expect(CSS).toMatch(/outline:\s*3px solid var\(--tm-focus\)/);
    expect(CSS).toMatch(/outline-offset:\s*2px/);
  });

  it("answers the three user preferences that were entirely absent", () => {
    expect(CSS).toContain("@media (prefers-reduced-motion: reduce)");
    expect(CSS).toContain("@media (prefers-contrast: more)");
    expect(CSS).toContain("@media (forced-colors: active)");
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
