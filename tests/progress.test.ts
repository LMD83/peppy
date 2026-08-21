import { describe, expect, it } from "vitest";
import { projectGoal } from "../convex/tm/logic";
import { addDays } from "../convex/tm/lib";

const TODAY = "2026-08-21";

function weighInsFrom(startKg: number, perWeekKg: number, count: number, from = TODAY): { date: string; weightKg: number }[] {
  return Array.from({ length: count }, (_, i) => ({
    date: addDays(from, i),
    weightKg: Math.round((startKg + (perWeekKg / 7) * i) * 100) / 100,
  }));
}

describe("projectGoal", () => {
  it("makes no claim with fewer than the minimum weigh-ins", () => {
    const weighIns = weighInsFrom(95, -3.5, 3);
    expect(projectGoal(weighIns[weighIns.length - 1].weightKg, 85, weighIns)).toEqual({
      kind: "insufficient-data",
    });
  });

  it("makes no claim when the trend is flat", () => {
    // Same weight every day: zero slope.
    const weighIns = weighInsFrom(90, 0, 6);
    expect(projectGoal(90, 85, weighIns)).toEqual({ kind: "flat" });
  });

  it("reports away-from-goal when the trend points the wrong way", () => {
    // Losing weight while the goal is ABOVE the current weight (e.g. mid-bulk,
    // trending down) — same shape as trending down while cutting toward a
    // goal above goal weight would be wrong; here goal is higher than latest
    // and the slope is negative, so the gap is growing, not closing.
    const weighIns = weighInsFrom(90, -3.5, 6);
    const latest = weighIns[weighIns.length - 1].weightKg;
    const projection = projectGoal(latest, 95, weighIns);
    expect(projection).toEqual({ kind: "away-from-goal" });
  });

  it("projects a positive day count when trending toward a goal below current weight", () => {
    // -0.5 kg/week, 10 kg to lose -> 20 weeks -> 140 days.
    const weighIns = weighInsFrom(95, -0.5, 6);
    const latest = weighIns[weighIns.length - 1].weightKg;
    const projection = projectGoal(latest, 85, weighIns);
    expect(projection.kind).toBe("on-track");
    if (projection.kind === "on-track") {
      const remaining = latest - 85;
      expect(projection.days).toBeGreaterThan(0);
      // Loose bound: the fitted slope from 6 points won't be exactly -0.5,
      // but it must be in the right ballpark for a ~140-day-at-goal number.
      expect(projection.days).toBeGreaterThan(remaining * 7 * 0.5);
    }
  });

  it("projects toward a goal above current weight the same way (a future bulk)", () => {
    // +0.5 kg/week, gaining toward a goal above current weight.
    const weighIns = weighInsFrom(78, 0.5, 6);
    const latest = weighIns[weighIns.length - 1].weightKg;
    const projection = projectGoal(latest, 85, weighIns);
    expect(projection.kind).toBe("on-track");
  });

  it("reads zero remaining as already at goal", () => {
    const weighIns = weighInsFrom(85, -0.5, 6);
    const projection = projectGoal(85, 85, weighIns);
    expect(projection).toEqual({ kind: "on-track", days: 0 });
  });
});
