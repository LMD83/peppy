import {
  CUT_RATE_KG_PER_WEEK,
  HARD_TRIPWIRE_KG,
  OVERLOAD_INCREMENT_KG,
  OVERLOAD_REPS,
  SOFT_TRIPWIRE_KG,
  daysBetween,
  type TmMode,
} from "./lib";

/**
 * Pure Timento domain logic, shared verbatim between the Convex query
 * handlers and the frontend demo backend so both compute identical numbers.
 */

export type WallDay = { date: string; done: number; total: number };

export function computeStreakAndAdherence(wall: WallDay[], today: string) {
  // Adherence covers the last 7 COMPLETE days — today is still in play and
  // must not count against you (same rule the streak follows).
  const complete = wall.filter((d) => d.date !== today);
  const last7 = complete.slice(-7);
  const adherence7 = Math.round(
    (last7.reduce((s, d) => s + d.done, 0) / Math.max(1, last7.reduce((s, d) => s + d.total, 0))) *
      100,
  );
  let streak = 0;
  for (let i = wall.length - 1; i >= 0; i--) {
    const d = wall[i];
    if (d.done >= d.total) streak++;
    else if (d.date === today) continue; // today still in play — don't break the streak yet
    else break;
  }
  const todayRow = wall[wall.length - 1];
  return { adherence7, streak, todayDone: todayRow.done, todayTotal: todayRow.total };
}

export type LiftSet = { topSetWeightKg: number; topSetReps: number };

/** Top set ≥12 reps at the same load, two sessions running → "+2.5 kg" flag. */
export function overloadFlag(recentDesc: LiftSet[]): string | null {
  if (
    recentDesc.length === 2 &&
    recentDesc[0].topSetWeightKg === recentDesc[1].topSetWeightKg &&
    recentDesc[0].topSetReps >= OVERLOAD_REPS &&
    recentDesc[1].topSetReps >= OVERLOAD_REPS
  ) {
    return `+${OVERLOAD_INCREMENT_KG} kg → ${(recentDesc[0].topSetWeightKg + OVERLOAD_INCREMENT_KG).toFixed(1)}`;
  }
  return null;
}

export type CravingRow = { time: string; signal: "tired" | "emotion" | "cue" | "bored" | "hungry" };

const SIGNALS = ["tired", "emotion", "cue", "bored", "hungry"] as const;

export function buildTriggerMap(cravings: CravingRow[]) {
  const byHour = new Map<number, Record<string, number>>();
  for (const c of cravings) {
    const hour = Number(c.time.slice(0, 2));
    const bucket = byHour.get(hour) ?? {};
    bucket[c.signal] = (bucket[c.signal] ?? 0) + 1;
    byHour.set(hour, bucket);
  }
  return Array.from(byHour.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, counts]) => ({ hour, counts }));
}

export type EngineReadout = "depletion" | "emotion" | "cue" | "mixed" | "insufficient";

/** Which craving engine dominates — the fix differs per engine. */
export function classifyEngine(cravings: CravingRow[]): EngineReadout {
  const total = cravings.length;
  if (total < 6) return "insufficient";
  const bySignal: Record<string, number> = {};
  for (const c of cravings) bySignal[c.signal] = (bySignal[c.signal] ?? 0) + 1;
  const depletion = bySignal["tired"] ?? 0;
  const emotion = bySignal["emotion"] ?? 0;
  const cue = (bySignal["cue"] ?? 0) + (bySignal["bored"] ?? 0);
  const top = Math.max(depletion, emotion, cue);
  if (top / total < 0.5) return "mixed";
  return top === depletion ? "depletion" : top === emotion ? "emotion" : "cue";
}

export function findPeak(triggerMap: { hour: number; counts: Record<string, number> }[]) {
  if (triggerMap.length === 0) return null;
  const best = [...triggerMap].sort(
    (a, b) =>
      Object.values(b.counts).reduce((s, n) => s + n, 0) -
      Object.values(a.counts).reduce((s, n) => s + n, 0),
  )[0];
  const hourTotal = Object.values(best.counts).reduce((s, n) => s + n, 0);
  const topSignal = SIGNALS.reduce((acc, s) =>
    (best.counts[s] ?? 0) > (best.counts[acc] ?? 0) ? s : acc,
  );
  return {
    fromHour: best.hour,
    share: Math.round(((best.counts[topSignal] ?? 0) / hourTotal) * 100),
    signal: topSignal as string,
  };
}

export function targetKgFor(startKg: number, startDate: string, date: string): number {
  return (
    Math.round((startKg - (daysBetween(startDate, date) / 7) * CUT_RATE_KG_PER_WEEK) * 10) / 10
  );
}

export function tripwireFor(
  mode: TmMode,
  goalKg: number,
  latestKg: number | undefined,
): { level: "soft" | "hard"; message: string } | null {
  if (mode !== "maintain" || latestKg === undefined) return null;
  const over = latestKg - goalKg;
  if (over >= HARD_TRIPWIRE_KG)
    return {
      level: "hard",
      message: `Hard tripwire: ${over.toFixed(1)} kg over goal. Survival mode is the pre-written response — ceiling re-anchors to goal +4 kg. Executing it is a decision. Zero guilt clause applies.`,
    };
  if (over >= SOFT_TRIPWIRE_KG)
    return {
      level: "soft",
      message: `Soft tripwire: ${over.toFixed(1)} kg over goal. The 14-day mini-cut sub-routine is ready — same checks, small deficit, review in two weeks.`,
    };
  return null;
}

/** Seasonal layer (PER3 +/+): morning-light prompt October–February. */
export function isWinterWindow(date: string): boolean {
  const month = Number(date.slice(5, 7));
  return month >= 10 || month <= 2;
}
