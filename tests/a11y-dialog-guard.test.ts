import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The two dialogs the audit named. Source-level so a later edit cannot drop
 * Escape, focus restore, or the disclosure contract without a red test.
 */

const SHEET = readFileSync(resolve(__dirname, "../src/app/_components/ui.tsx"), "utf8");
const BOARD = readFileSync(resolve(__dirname, "../src/app/_components/scoreboard.tsx"), "utf8");
const APP = readFileSync(resolve(__dirname, "../src/app/_components/app.tsx"), "utf8");

describe("TmSheet is a real modal", () => {
  it("moves focus, traps Tab, closes on Escape, and restores the opener", () => {
    expect(SHEET).toContain('e.key === "Escape"');
    expect(SHEET).toContain('e.key !== "Tab"');
    expect(SHEET).toContain("previous?.focus()");
    expect(SHEET).toContain("closeRef.current?.focus()");
    expect(SHEET).toContain('aria-modal="true"');
    expect(SHEET).toContain("aria-labelledby");
  });

  it("keeps the scrim out of the tab order", () => {
    expect(SHEET).toMatch(/tabIndex=\{-1\}/);
    expect(SHEET).toMatch(/aria-hidden/);
  });
});

describe("mode switcher is a disclosure, not a fake dialog", () => {
  it("does not claim role=dialog", () => {
    expect(BOARD).not.toContain('role="dialog"');
  });

  it("wires aria-controls / aria-expanded and Escape", () => {
    expect(BOARD).toContain("aria-controls={modePanelId}");
    expect(BOARD).toContain("aria-expanded={confirmMode}");
    expect(BOARD).toContain('e.key === "Escape"');
  });
});

describe("the shell has a skip link and a named auth splash", () => {
  it("skips to main", () => {
    expect(APP).toContain('href="#tm-main"');
    expect(APP).toContain('id="tm-main"');
    expect(APP).toContain("Skip to checks");
  });

  it("names the first busy paint", () => {
    expect(APP).toContain("Opening file…");
    expect(APP).toContain('role="status"');
  });
});
