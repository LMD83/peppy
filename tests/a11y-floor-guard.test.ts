import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { axisFontSize, NARROWEST_COLUMN_PX, TYPE_FLOOR_PX } from "../src/app/_components/charts";

/**
 * The type floor, enforced at the source rather than hoped for.
 *
 * There used to be a net here: an unlayered rule in globals.css lifting every
 * sub-floor `text-[Npx]` class up to the token, plus a test proving the net's
 * coverage list was complete. On 2026-08-17 the source classes were raised —
 * the day the net's own comment promised — so the net is gone and the guard
 * got simpler and stronger. It asserts two things:
 *
 *  1. no `text-[Npx]` class below the floor exists anywhere in src/ — the
 *     floor is now a fact about the code, not a patch over it
 *  2. no SVG carries a raw fontSize below the floor — SVG text is painted
 *     through the viewBox transform, so it renders smallest on the smallest
 *     screen. It must come from axisFontSize.
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

describe("no type below the floor exists at the source", () => {
  const css = readFileSync(GLOBALS, "utf8");

  it("declares the floor token at the documented value", () => {
    // Easy mode still reads the token to lift 11.5px/13px type to 16px.
    expect(css).toContain(`--tm-type-floor: ${TYPE_FLOOR_PX}px`);
  });

  it("finds no sub-floor text class anywhere in src/", () => {
    const offenders = [
      ...new Set(
        usedTextClasses()
          .filter((u) => u.px < TYPE_FLOOR_PX)
          .map((u) => `${u.file.replace(process.cwd(), "")}: ${u.raw}`),
      ),
    ];
    expect(
      offenders,
      `type below ${TYPE_FLOOR_PX}px shipped once and was raised at the source on 2026-08-17 — ` +
        "there is no net to catch this any more, so raise the class, not the exception list",
    ).toEqual([]);
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
