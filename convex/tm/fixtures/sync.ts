import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { addDays } from "../lib";

/**
 * Connect fixtures — a run of Renpho readings mirroring Liam's daily
 * weigh-ins, one InBody sheet from a gym scan, and a pair of scale readings
 * for Artur.
 *
 * Row shapes are redeclared here rather than imported: Convex code must not
 * reach into src/. They are field-identical to src/app/_lib/demo/rows.ts,
 * which is the contract.
 *
 * The scale readings are derived from the tm_days rows the caller already
 * built, so the wall and the readings tell one story — a fixture where the
 * scale and the file disagree would be demonstrating a bug on purpose.
 */

export type BodyMeasurementRow = {
  userSlug: string;
  date: string;
  time?: string;
  weightKg?: number;
  bodyFatPct?: number;
  bodyFatMassKg?: number;
  skeletalMuscleKg?: number;
  muscleMassKg?: number;
  visceralFat?: number;
  waterPct?: number;
  bmrKcal?: number;
  source: "renpho-csv" | "samsung-csv" | "csv" | "inbody" | "renpho-cloud";
  device?: string;
  importedAt: number;
};

export type SyncFixtures = {
  bodyMeasurements: BodyMeasurementRow[];
};

type DayWeight = { userSlug: string; date: string; weightKg?: number };

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function buildSyncFixtures(today: string, days: readonly DayWeight[]): SyncFixtures {
  const bodyMeasurements: BodyMeasurementRow[] = [];

  // Liam's scale uploads: the trailing ten daily weigh-ins, as the Renpho CSV
  // import would have landed them. Composition drifts the way a cut does —
  // fat percentage easing down while water and BMR hold steady.
  const liamRecent = days
    .filter((d) => d.userSlug === "liam" && d.weightKg !== undefined && d.date >= addDays(today, -10))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  liamRecent.forEach((d, i) => {
    if (d.weightKg === undefined) return;
    bodyMeasurements.push({
      userSlug: "liam",
      date: d.date,
      time: `07:${String(2 + ((i * 3) % 7)).padStart(2, "0")}`,
      weightKg: d.weightKg,
      bodyFatPct: round1(24.1 - i * 0.08),
      waterPct: round1(55.2 + (i % 3) * 0.1),
      visceralFat: i < 4 ? 9 : 8,
      bmrKcal: 1895 + (i % 4) * 3,
      source: "renpho-csv",
      device: "Renpho scale",
      importedAt: 0,
    });
  });

  // One InBody sheet from a gym scan a month back — SMM and fat mass in kg,
  // the way the printout gives them, typed in off the sheet.
  bodyMeasurements.push({
    userSlug: "liam",
    date: addDays(today, -30),
    weightKg: 93.2,
    skeletalMuscleKg: 38.4,
    bodyFatMassKg: 21.8,
    bodyFatPct: 23.4,
    visceralFat: 9,
    bmrKcal: 1902,
    source: "inbody",
    device: "InBody 770",
    importedAt: 0,
  });

  // Artur: the floor asks for three weigh-ins a week, and the scale has two
  // of the recent ones.
  const arturRecent = days
    .filter((d) => d.userSlug === "artur" && d.weightKg !== undefined && d.date >= addDays(today, -6))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  arturRecent.forEach((d, i) => {
    if (d.weightKg === undefined) return;
    bodyMeasurements.push({
      userSlug: "artur",
      date: d.date,
      time: `08:${String(11 + i * 4).padStart(2, "0")}`,
      weightKg: d.weightKg,
      bodyFatPct: round1(26.8 - i * 0.1),
      waterPct: 53.9,
      visceralFat: 11,
      bmrKcal: 1870,
      source: "renpho-csv",
      device: "Renpho scale",
      importedAt: 0,
    });
  });

  return { bodyMeasurements };
}

export async function seedSync(
  ctx: MutationCtx,
  uid: (slug: string) => Id<"tm_users">,
  fx: SyncFixtures,
): Promise<void> {
  for (const { userSlug, ...row } of fx.bodyMeasurements) {
    await ctx.db.insert("tm_bodyMeasurements", { userId: uid(userSlug), ...row });
  }
}
