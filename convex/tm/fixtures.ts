import { MODE_CHECKS, addDays, type TmMode } from "./lib";
import { buildFuelFixtures, type FuelFixtures } from "./fixtures/fuel";
import { buildTrainFixtures, type TrainFixtures } from "./fixtures/train";
import { buildStackFixtures, type StackFixtures } from "./fixtures/stack";
import { buildLabsFixtures, type LabsFixtures } from "./fixtures/labs";
import { buildMindFixtures, type MindFixtures } from "./fixtures/mind";
import { buildConsentFixtures, type ConsentFixtures } from "./fixtures/consent";
import { buildSupplyFixtures, type SupplyFixtures } from "./fixtures/supply";
import { buildShopFixtures, type ShopFixtures } from "./fixtures/shop";

/**
 * Deterministic demo dataset for the two crew members, positioned relative to
 * `today`. Used by the Convex seed (convex/tm/seed.ts) and by the frontend
 * demo store, so both backends tell the same story.
 */

export type FixtureUser = {
  slug: string;
  name: string;
  passcode: string;
  mode: TmMode;
  modeSince: string;
  modeReason?: string;
  reviewDate?: string;
  ceilingKg: number;
  goalKg: number;
  startKg: number;
  startDate: string;
  kitchenClose: string;
  protocolTitle: string;
};

export type Fixtures = {
  users: FixtureUser[];
  days: {
    userSlug: string;
    date: string;
    weightKg?: number;
    stress?: number;
    energy?: number;
    ritualDone?: boolean;
    sessionDone?: boolean;
  }[];
  checks: { userSlug: string; date: string; key: string; done: boolean }[];
  cravings: {
    userSlug: string;
    date: string;
    time: string;
    signal: "tired" | "emotion" | "cue" | "bored" | "hungry";
    emotionWord?: string;
    afterState?: "relief" | "guilt" | "numb" | "satisfied";
    action?: "rode" | "substitute" | "ate";
  }[];
  lifts: { userSlug: string; date: string; exercise: string; topSetWeightKg: number; topSetReps: number }[];
  labs: { userSlug: string; date: string; marker: string; value: number; unit: string; note?: string; recheckDate?: string }[];
  markers: {
    userSlug: string;
    gene: string;
    csvCall: string;
    reportCall: string;
    status: "confirmed" | "disputed" | "resolved";
    resolvesVia: string;
  }[];
  experiments: {
    code: string;
    name: string;
    hypothesis: string;
    protocol: string;
    durationDays: number;
    metric: string;
    status: "queued" | "running" | "supported" | "refuted" | "unclear";
    startDate?: string;
    note?: string;
  }[];
  crewFeed: { userSlug: string; message: string }[];
  modeEvents: { userSlug: string; date: string; mode: TmMode; label: string }[];
} & FuelFixtures &
  TrainFixtures &
  StackFixtures &
  LabsFixtures &
  MindFixtures &
  ConsentFixtures &
  SupplyFixtures &
  ShopFixtures;

function wallChecks(userSlug: string, mode: TmMode, endDate: string, wall: number[]): Fixtures["checks"] {
  const keys = MODE_CHECKS[mode].map((c) => c.key);
  const rows: Fixtures["checks"] = [];
  wall.forEach((done, i) => {
    const date = addDays(endDate, i - (wall.length - 1));
    keys.slice(0, done).forEach((key) => rows.push({ userSlug, date, key, done: true }));
  });
  return rows;
}

export function buildFixtures(today: string): Fixtures {
  const liamStart = addDays(today, -42);
  const arturFloorSince = addDays(today, -12);

  const users: FixtureUser[] = [
    {
      slug: "liam",
      name: "Liam",
      passcode: "2580",
      mode: "cut",
      modeSince: liamStart,
      ceilingKg: 96,
      goalKg: 85,
      startKg: 95,
      startDate: liamStart,
      kitchenClose: "20:30",
      protocolTitle: "Cut protocol 95→85",
    },
    {
      slug: "artur",
      name: "Artur",
      passcode: "1379",
      mode: "survival",
      modeSince: arturFloorSince,
      modeReason: "ACL rehab",
      reviewDate: addDays(today, 2),
      ceilingKg: 96,
      goalKg: 88,
      startKg: 92,
      startDate: addDays(today, -60),
      kitchenClose: "20:30",
      protocolTitle: "Floor protocol — hold < 96",
    },
  ];

  // Liam: weekly weigh-ins through the early cut, then daily for the trailing
  // fortnight. That density is what lets adaptive TDEE separate a real trend
  // from water noise — weekly points alone leave the estimate unidentifiable.
  const liamWeekly = [95.0, 94.4, 94.1, 93.4];
  const days: Fixtures["days"] = liamWeekly.map((kg, i) => ({
    userSlug: "liam",
    date: addDays(liamStart, i * 7),
    weightKg: kg,
  }));
  // 93.6 → 92.8 over 14 days (~0.4 kg/wk) with believable day-to-day scatter.
  const scatter = [0.3, -0.1, 0.15, 0.0, 0.25, -0.2, 0.1, 0.35, -0.15, 0.05, 0.2, -0.1, 0.3, 0.0];
  for (let back = 14; back >= 1; back--) {
    const i = 14 - back;
    const trend = 93.6 - (0.8 * i) / 13;
    days.push({
      userSlug: "liam",
      date: addDays(today, -back),
      weightKg: Math.round((trend + scatter[i]) * 10) / 10,
      ...(back === 1 ? { stress: 2, energy: 4 } : {}),
    });
  }
  days.push({ userSlug: "liam", date: today, stress: 2, energy: 4 });
  // Artur: survival cadence — three weigh-ins a week, held under the ceiling.
  [8, 5, 3, 1].forEach((back, i) =>
    days.push({ userSlug: "artur", date: addDays(today, -back), weightKg: 94.8 - i * 0.1 }),
  );

  // Liam wall: streak of 9 full days before today; today 3 of 5 done.
  const liamWall = [5, 3, 5, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3];
  // Artur wall: floor held the last 4 days straight; today already 3/3.
  const arturWall = [2, 3, 3, 2, 3, 1, 2, 3, 2, 1, 3, 3, 3, 3];
  const checks = [
    ...wallChecks("liam", "cut", today, liamWall),
    ...wallChecks("artur", "survival", today, arturWall),
  ];

  // Craving logs — the enemy has a schedule: tired-dominant 21:00–22:00.
  const cravings: Fixtures["cravings"] = [];
  const pattern: [string, number, "tired" | "bored"][] = [
    ["18:20", 1, "tired"],
    ["19:10", 1, "tired"],
    ["19:40", 1, "bored"],
    ["20:15", 3, "tired"],
    ["20:45", 1, "bored"],
    ["21:05", 6, "tired"],
    ["21:35", 2, "bored"],
    ["22:10", 4, "tired"],
    ["22:40", 1, "bored"],
    ["23:05", 1, "tired"],
  ];
  let spread = 0;
  for (const [time, count, signal] of pattern) {
    for (let i = 0; i < count; i++) {
      spread = (spread + 5) % 13;
      cravings.push({
        userSlug: "liam",
        date: addDays(today, -1 - spread),
        time,
        signal,
        afterState: i % 3 === 0 ? "relief" : i % 3 === 1 ? "satisfied" : "guilt",
        action: i % 3 === 0 ? "rode" : i % 3 === 1 ? "substitute" : "ate",
      });
    }
  }

  // Lifts — barbell row earned the +2.5 kg flag (≥12 reps at 70 kg twice).
  const lifts: Fixtures["lifts"] = [
    { userSlug: "liam", date: addDays(today, -14), exercise: "Barbell row", topSetWeightKg: 70, topSetReps: 12 },
    { userSlug: "liam", date: addDays(today, -7), exercise: "Barbell row", topSetWeightKg: 70, topSetReps: 13 },
    { userSlug: "liam", date: addDays(today, -14), exercise: "Lat pulldown", topSetWeightKg: 65, topSetReps: 10 },
    { userSlug: "liam", date: addDays(today, -7), exercise: "Lat pulldown", topSetWeightKg: 65, topSetReps: 11 },
    { userSlug: "liam", date: addDays(today, -14), exercise: "Face pull", topSetWeightKg: 25, topSetReps: 14 },
    { userSlug: "liam", date: addDays(today, -7), exercise: "Face pull", topSetWeightKg: 25, topSetReps: 15 },
    { userSlug: "liam", date: addDays(today, -14), exercise: "Curl", topSetWeightKg: 15, topSetReps: 11 },
    { userSlug: "liam", date: addDays(today, -7), exercise: "Curl", topSetWeightKg: 15, topSetReps: 12 },
  ];

  const labs: Fixtures["labs"] = [
    {
      userSlug: "liam",
      date: addDays(today, -43),
      marker: "LDL-C",
      value: 3.4,
      unit: "mmol/L",
      note: "Recheck adds ApoB and Lp(a). Sat fat under 15 g is lever #1.",
      recheckDate: addDays(today, 41),
    },
    { userSlug: "liam", date: addDays(today, -43), marker: "HbA1c", value: 34, unit: "mmol/mol" },
    { userSlug: "liam", date: addDays(today, -43), marker: "BP (home avg)", value: 128, unit: "mmHg systolic", note: "Borderline — gate for cold-immersion experiment E4." },
  ];

  const markers: Fixtures["markers"] = [
    { userSlug: "liam", gene: "MTHFR C677T", csvCall: "CC", reportCall: "+/−", status: "disputed", resolvesVia: "homocysteine draw" },
    { userSlug: "liam", gene: "TCF7L2 rs7903146", csvCall: "clean", reportCall: "+/+", status: "disputed", resolvesVia: "CGM · E2" },
    { userSlug: "liam", gene: "ADORA2A ×3", csvCall: "insensitive", reportCall: "flagged", status: "disputed", resolvesVia: "caffeine curfew · E1" },
    { userSlug: "liam", gene: "COMT", csvCall: "+/+", reportCall: "+/+", status: "confirmed", resolvesVia: "—" },
    { userSlug: "liam", gene: "FTO ×3", csvCall: "+/+", reportCall: "+/+", status: "confirmed", resolvesVia: "— (hunger is signal noise, not weakness)" },
    { userSlug: "liam", gene: "PER3", csvCall: "+/+", reportCall: "+/+", status: "confirmed", resolvesVia: "— (winter layer arms 1 Oct)" },
    { userSlug: "liam", gene: "MCM6", csvCall: "+/+", reportCall: "+/+", status: "confirmed", resolvesVia: "— (dairy tolerant)" },
  ];

  const experiments: Fixtures["experiments"] = [
    {
      code: "E1",
      name: "Caffeine curfew 14:00",
      hypothesis: "Late caffeine drives evening cravings and poor sleep (ADORA2A/CYP1A2 dispute).",
      protocol: "No caffeine after 14:00 for 14 days.",
      durationDays: 14,
      metric: "Sleep quality + evening craving count",
      status: "running",
      startDate: addDays(today, -8),
      note: "Day 9 of 14 · cravings −38% vs baseline",
    },
    {
      code: "E2",
      name: "CGM fortnight",
      hypothesis: "Evening glucose response to the sweet habit settles the TCF7L2 dispute.",
      protocol: "Libre-class sensor for 14 days (~€60).",
      durationDays: 14,
      metric: "Evening glucose response",
      status: "queued",
      note: "Sensors arrive Thursday",
    },
    {
      code: "E3",
      name: "Kitchen close 20:30",
      hypothesis: "An early time-restricted eating window cuts evening cravings.",
      protocol: "Kitchen closed 20:30 for 14 days vs baseline fortnight.",
      durationDays: 14,
      metric: "Craving count + weight trend",
      status: "supported",
      note: "Verdict after 14 clean days",
    },
    {
      code: "E4",
      name: "Cold showers, morning slot",
      hypothesis: "Cold finish lifts morning energy and mood. Honest framing: fat-loss evidence is near zero.",
      protocol: "30–60 s cold finish, mornings only, never within 4 h after resistance training. Ice baths gated on BP < 130/80 — log BP that week.",
      durationDays: 14,
      metric: "Morning energy scalar + evening craving count",
      status: "queued",
    },
  ];

  const crewFeed: Fixtures["crewFeed"] = [
    { userSlug: "artur", message: "Floor's holding" },
    { userSlug: "liam", message: "Proud of the boring days" },
    { userSlug: "artur", message: "Kitchen closed. Day 12." },
  ];

  const modeEvents: Fixtures["modeEvents"] = [
    { userSlug: "artur", date: arturFloorSince, mode: "survival", label: "ACL rehab — executed as designed" },
  ];

  return {
    users,
    days,
    checks,
    cravings,
    lifts,
    labs,
    markers,
    experiments,
    crewFeed,
    modeEvents,
    ...buildFuelFixtures(today),
    ...buildTrainFixtures(today),
    ...buildStackFixtures(today),
    ...buildLabsFixtures(today),
    ...buildMindFixtures(today),
    ...buildConsentFixtures(today),
    ...buildSupplyFixtures(today),
    ...buildShopFixtures(today),
  };
}
