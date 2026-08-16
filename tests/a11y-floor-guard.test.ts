import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { axisFontSize, NARROWEST_COLUMN_PX, TYPE_FLOOR_PX } from "../src/app/_components/charts";

/**
 * The type floor, enforced at the source rather than hoped for.
 *
 * The floor itself is a net in globals.css: an unlayered rule that lifts every
 * `text-[Npx]` class below 11.5px back up to the token. That net works, and it
 * has one failure mode — it only covers the class names somebody remembered to
 * list. Add `text-[7px]` to a component and nothing anywhere complains; the
 * class is not in the net, so the text simply renders at 7px.
 *
 * This is the guard the Phase 2 plan asked for ("enforced by lint so it cannot
 * regress") and never got, which is how 152 sub-floor classes and a 6px chart
 * axis shipped. It asserts two things a stylesheet cannot assert about itself:
 *
 *  1. every sub-floor utility class actually used in src/ is covered by the net
 *  2. no SVG carries a raw fontSize below the floor — SVG text is painted
 *     through the viewBox transform, so it is invisible to the CSS net *and*
 *     renders smallest on the smallest screen. It must come from axisFontSize.
 */

const SRC = join(process.cwd(), "src");
const GLOBALS = join(SRC, "app", "globals.css");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const tsxFiles = walk(SRC).filter((f) => f.endsWith(".tsx"));

/** Every `text-[Npx]` utility used anywhere in the app, with its file. */
function usedTextClasses(): { file: string; px: number; raw: string }[] {
  const out: { file: string; px: number; raw: string }[] = [];
  for (const file of tsxFiles) {
    const body = readFileSync(file, "utf8");
    for (const m of body.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
      out.push({ file, px: Number(m[1]), raw: m[0] });
    }
  }
  return out;
}

describe("the type floor cannot be escaped by a class the net does not know", () => {
  const css = readFileSync(GLOBALS, "utf8");

  it("declares the floor token at the documented value", () => {
    expect(css).toContain(`--tm-type-floor: ${TYPE_FLOOR_PX}px`);
  });

  it("covers every sub-floor class the app actually uses", () => {
    const used = usedTextClasses().filter((u) => u.px < TYPE_FLOOR_PX);
    // The escaped-bracket form Tailwind emits and the stylesheet must match.
    const uncovered = [
      ...new Set(
        used
          .filter((u) => {
            const selector = `.text-\\[${String(u.px).replace(".", "\\.")}px\\]`;
            return !css.includes(selector);
          })
          .map((u) => u.raw),
      ),
    ];
    expect(
      uncovered,
      `these classes render below ${TYPE_FLOOR_PX}px because the floor net in globals.css does not list them — ` +
        "either add them to the net or raise the class",
    ).toEqual([]);
  });

  it("still has sub-floor classes to cover, so the check is not vacuous", () => {
    // If this ever hits zero the net is dead code and the test above proves
    // nothing. That is a good day — delete both, and the net with them.
    expect(usedTextClasses().filter((u) => u.px < TYPE_FLOOR_PX).length).toBeGreaterThan(0);
  });
});

describe("SVG text is outside the net, so it is checked directly", () => {
  it("carries no raw fontSize below the floor", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles) {
      const body = readFileSync(file, "utf8");
      // fontSize="8.5" or fontSize={6} — a literal, not a call.
      for (const m of body.matchAll(/fontSize=(?:"(\d+(?:\.\d+)?)"|\{(\d+(?:\.\d+)?)\})/g)) {
        const px = Number(m[1] ?? m[2]);
        if (px < TYPE_FLOOR_PX) {
          offenders.push(`${file.replace(process.cwd() + "/", "")}: ${m[0]}`);
        }
      }
    }
    expect(
      offenders,
      "SVG text is painted through the viewBox transform, so a literal below the floor is both invisible to " +
        "the CSS net and smallest on the narrowest screen — size it with axisFontSize(viewBoxWidth) instead",
    ).toEqual([]);
  });
});

describe("axisFontSize", () => {
  it("puts the narrowest rendering exactly on the floor", () => {
    // A chart whose viewBox is the narrowest column renders 1:1 there.
    expect(axisFontSize(NARROWEST_COLUMN_PX)).toBe(TYPE_FLOOR_PX);
  });

  it("scales with the viewBox, so a wider chart authors a larger label", () => {
    // Every length inside a viewBox is multiplied by (rendered ÷ viewBox), so
    // holding the *rendered* size constant means authoring proportionally.
    const wide = axisFontSize(NARROWEST_COLUMN_PX * 2);
    expect(wide).toBeCloseTo(TYPE_FLOOR_PX * 2, 1);
  });

  it("clears the floor once the viewBox scale is applied, at every real chart width", () => {
    // The three charts in the app, at the narrowest column they ever render in.
    for (const viewBoxWidth of [140, 340, 360]) {
      const rendered = axisFontSize(viewBoxWidth) * (NARROWEST_COLUMN_PX / viewBoxWidth);
      expect(rendered, `viewBox ${viewBoxWidth}`).toBeGreaterThanOrEqual(TYPE_FLOOR_PX);
    }
  });
});
