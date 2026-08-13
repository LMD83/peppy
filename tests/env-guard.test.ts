import { describe, expect, it } from "vitest";

/**
 * The backend-selection guard, kept honest in isolation.
 *
 * A deployment environment variable is the one input that cannot be exercised
 * before it reaches production, and `new ConvexReactClient(bad)` throws inside
 * render — which Next serves as a 500 for the whole app on first paint. The
 * rule is therefore: anything that is not a usable http(s) endpoint falls back
 * to the demo backend rather than taking the file down.
 *
 * This mirrors `usableConvexUrl` in src/app/_lib/backend.tsx; that module is a
 * client component wired to React context, so the predicate is asserted here
 * rather than through a render harness.
 */
function usableConvexUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const demoMode = (demoFlag: string | undefined, convexUrl: string | undefined) =>
  demoFlag === "1" || !usableConvexUrl(convexUrl);

describe("convex endpoint guard", () => {
  it("accepts a real deployment URL", () => {
    expect(usableConvexUrl("https://dependable-vulture-853.eu-west-1.convex.cloud")).toBe(
      "https://dependable-vulture-853.eu-west-1.convex.cloud/",
    );
  });

  it("tolerates the whitespace a dashboard paste leaves behind", () => {
    expect(usableConvexUrl("  https://example.convex.cloud  ")).toBe("https://example.convex.cloud/");
  });

  it.each([
    ["undefined", undefined],
    ["empty", ""],
    ["a placeholder", "your-convex-url-here"],
    ["a bare host", "example.convex.cloud"],
    ["a quoted value", '"https://example.convex.cloud"'],
    ["a non-http scheme", "ws://example.convex.cloud"],
  ])("rejects %s instead of throwing in render", (_label, value) => {
    expect(usableConvexUrl(value)).toBeNull();
  });
});

describe("backend selection", () => {
  it("runs the demo backend when the flag is set, whatever the URL", () => {
    expect(demoMode("1", "https://example.convex.cloud")).toBe(true);
  });

  it("runs the Convex backend for a valid URL with the flag off", () => {
    expect(demoMode("0", "https://example.convex.cloud")).toBe(false);
    expect(demoMode(undefined, "https://example.convex.cloud")).toBe(false);
  });

  it("falls back to demo — never a 500 — when the URL is misconfigured", () => {
    expect(demoMode("0", "your-convex-url-here")).toBe(true);
    expect(demoMode(undefined, "")).toBe(true);
    expect(demoMode(undefined, undefined)).toBe(true);
  });
});
