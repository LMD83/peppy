import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { plain } from "../convex/tm/logicEasy";

/**
 * The four-stamp story. Source-level so a later edit cannot fork easy mode
 * into a second IA, or put Fuel back on the thumb bar, without a red test.
 */

const APP = readFileSync(resolve(__dirname, "../src/app/_components/app.tsx"), "utf8");

describe("everyone gets the same four stamps", () => {
  it("names Today, Protocol, Crew, More — and nothing else", () => {
    const nav = APP.match(/const NAV:[\s\S]*?=\s*\[([\s\S]*?)\];/);
    expect(nav, "NAV constant").toBeTruthy();
    const labels = [...nav![1].matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(labels).toEqual(["Today", "Protocol", "Crew", "More"]);
  });

  it("does not keep a second easy-mode bar or a Body/Mind chip row", () => {
    expect(APP).not.toContain("NAV_EASY");
    expect(APP).not.toContain("NAV_STANDARD");
    expect(APP).not.toContain("function SubNav");
  });
});

describe("Protocol tells the day's work in order", () => {
  it("walks kitchen, then the body file, then the mind file", () => {
    const story = APP.match(/const PROTOCOL_STORY:[\s\S]*?=\s*\[([\s\S]*?)\];/);
    expect(story, "PROTOCOL_STORY").toBeTruthy();
    const labels = [...story![1].matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(labels).toEqual([
      "Fuel",
      "Train",
      "Stack",
      "Supply",
      "Bloods",
      "Trend",
      "Check-in",
      "Trigger map",
    ]);
  });

  it("keeps More as the appendix", () => {
    const appendix = APP.match(/const APPENDIX:[\s\S]*?=\s*\[([\s\S]*?)\];/);
    expect(appendix, "APPENDIX").toBeTruthy();
    const labels = [...appendix![1].matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
    // Connect joined the appendix with the device/file import work — a
    // deliberate fifth row, not drift back toward the thirteen-row More list.
    expect(labels).toEqual(["Shopping", "Hands-free", "Reminders", "Photos", "Connect"]);
  });
});

describe("easy plains the shelf, not the stamps", () => {
  it("has a phrase for Trigger map that is not the word Protocol", () => {
    expect(plain("Trigger map")).toBe("When urges hit");
    expect(plain("Trigger map")).not.toMatch(/protocol/i);
  });
});
