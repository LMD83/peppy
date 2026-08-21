import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import {
  LB_PER_KG,
  MAX_IMPORT_ROWS,
  buildConnectView,
  labsCsv,
  mapRenphoCloudRecord,
  parseConnectCsv,
  parseDateTimeCell,
  planImport,
  readingsCsv,
  toCsv,
  trainingCsv,
  validateMeasurement,
  weighInsCsv,
  type ExistingReading,
  type MeasurementInput,
} from "../convex/tm/logicSync";

// Module map for convex-test (avoids import.meta.glob so repo-wide tsc stays clean).
const modules = {
  "./_generated/api.js": () => import("../convex/_generated/api"),
  "./_generated/server.js": () => import("../convex/_generated/server"),
  "./tm/auth.ts": () => import("../convex/tm/auth"),
  "./tm/crew.ts": () => import("../convex/tm/crew"),
  "./tm/seed.ts": () => import("../convex/tm/seed"),
  "./tm/sync.ts": () => import("../convex/tm/sync"),
  "./tm/today.ts": () => import("../convex/tm/today"),
};

const TODAY = "2026-08-13";

type TestHarness = ReturnType<typeof convexTest>;

async function loginOk(t: TestHarness, slug: string, passcode: string): Promise<string> {
  const res = await t.mutation(api.tm.auth.login, { slug, passcode });
  if (!res.ok) throw new Error(`login failed: ${res.code}`);
  return res.token;
}

async function seeded() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.tm.seed.run, { today: TODAY });
  const liam = await loginOk(t, "liam", "2580");
  const artur = await loginOk(t, "artur", "1379");
  return { t, liam, artur };
}

/* ===== parsing ===== */

describe("parseConnectCsv", () => {
  it("reads a Renpho export: dates with times, composition columns, kg as printed", () => {
    const text = [
      "Date,Weight(kg),BMI,Body Fat(%),Visceral Fat,Body Water(%),Muscle Mass(kg),BMR(kcal)",
      "2026-08-01 07:12:44,92.6,27.9,23.8,9,55.1,62.4,1897",
      "2026-08-02 07:03:10,92.4,27.8,23.7,9,55.2,62.3,1895",
    ].join("\n");
    const result = parseConnectCsv(text);
    expect(result.format).toBe("renpho");
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      date: "2026-08-01",
      time: "07:12",
      weightKg: 92.6,
      bodyFatPct: 23.8,
      visceralFat: 9,
      waterPct: 55.1,
      muscleMassKg: 62.4,
      bmrKcal: 1897,
    });
  });

  it("converts pounds only when the file's own header declares them", () => {
    const result = parseConnectCsv(["Date,Weight(lb),Visceral Fat", "2026-08-01,204.1,9"].join("\n"));
    expect(result.format).toBe("renpho");
    expect(result.rows[0].weightKg).toBeCloseTo(204.1 / LB_PER_KG, 2);
  });

  it("reads a Samsung Health download: title line skipped, certain columns only", () => {
    const text = [
      "com.samsung.health.weight,4021,2026-08-13 09:00:00.000",
      "start_time,weight,body_fat,skeletal_muscle_mass,basal_metabolic_rate,total_body_water,comment",
      "2026-08-01 07:30:00.000,92.6,23.8,37.9,1897,44.2,",
    ].join("\n");
    const result = parseConnectCsv(text);
    expect(result.format).toBe("samsung");
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      date: "2026-08-01",
      time: "07:30",
      weightKg: 92.6,
      bodyFatPct: 23.8,
      skeletalMuscleKg: 37.9,
      bmrKcal: 1897,
    });
    // total_body_water is litres, not a percentage — it must NOT be relabelled.
    expect(result.rows[0].waterPct).toBeUndefined();
  });

  it("reads a plain date/weight spreadsheet, comma decimals included", () => {
    const result = parseConnectCsv(["date,weight,body fat %", '2026-08-01,"92,6",23.8'].join("\n"));
    expect(result.format).toBe("generic");
    expect(result.rows[0]).toMatchObject({ date: "2026-08-01", weightKg: 92.6, bodyFatPct: 23.8 });
  });

  it("refuses an ambiguous slashed date rather than guess the order", () => {
    const result = parseConnectCsv(["date,weight", "03/08/2026,92.6", "13/08/2026,92.4"].join("\n"));
    expect(result.rows).toHaveLength(1); // 13/08 is unambiguous — day first
    expect(result.rows[0].date).toBe("2026-08-13");
    expect(result.errors.some((e) => e.includes("day-first or month-first"))).toBe(true);
  });

  it("refuses an implausible value with the band named, never clamps it", () => {
    const result = parseConnectCsv(["date,weight", "2026-08-01,926"].join("\n"));
    expect(result.rows).toEqual([]);
    expect(result.errors[0]).toMatch(/outside the plausible band/);
    expect(result.errors[0]).toMatch(/25–350/);
  });

  it("says what a usable header looks like when none matches", () => {
    const result = parseConnectCsv("foo,bar\n1,2");
    expect(result.format).toBeNull();
    expect(result.errors[0]).toMatch(/name the columns/);
  });

  it("reports rows beyond the import ceiling instead of dropping them silently", () => {
    const lines = ["date,weight"];
    for (let i = 0; i < MAX_IMPORT_ROWS + 5; i++) {
      const day = String((i % 28) + 1).padStart(2, "0");
      const monthIndex = Math.floor(i / 28);
      const month = String((monthIndex % 12) + 1).padStart(2, "0");
      const year = 2020 + Math.floor(monthIndex / 12);
      lines.push(`${year}-${month}-${day},80.0`);
    }
    const result = parseConnectCsv(lines.join("\n"));
    expect(result.rows).toHaveLength(MAX_IMPORT_ROWS);
    expect(result.errors.filter((e) => e.includes("at most"))).toHaveLength(5);
  });
});

describe("parseDateTimeCell", () => {
  it("handles ISO, slashed-unambiguous and datetime forms", () => {
    expect(parseDateTimeCell("2026-08-01")).toEqual({ date: "2026-08-01" });
    expect(parseDateTimeCell("2026/08/01 07:05:33")).toEqual({ date: "2026-08-01", time: "07:05" });
    expect(parseDateTimeCell("31/01/2026")).toEqual({ date: "2026-01-31" });
    expect(parseDateTimeCell("01/31/2026")).toEqual({ date: "2026-01-31" });
    expect(parseDateTimeCell("03/04/2026")).toBe("ambiguous");
    expect(parseDateTimeCell("not a date")).toBeNull();
  });
});

describe("validateMeasurement", () => {
  it("rejects a reading with no metrics — an empty row is not evidence", () => {
    expect(validateMeasurement({ date: "2026-08-01" })).toHaveLength(1);
  });
  it("accepts a plausible reading", () => {
    expect(validateMeasurement({ date: "2026-08-01", weightKg: 92.6 })).toEqual([]);
  });
});

/* ===== dedupe planning ===== */

describe("planImport", () => {
  const onFile: ExistingReading[] = [
    { date: "2026-08-01", time: "07:12", weightKg: 92.6, bodyFatPct: 23.8, source: "renpho-csv" },
  ];

  it("the same reading is a duplicate whatever route it arrives by", () => {
    const viaCloud: MeasurementInput[] = [
      { date: "2026-08-01", time: "07:12", weightKg: 92.6, bodyFatPct: 23.8 },
    ];
    const plan = planImport(onFile, viaCloud, "renpho-cloud", new Map());
    expect(plan.toWrite).toEqual([]);
    expect(plan.duplicates).toBe(1);
  });

  it("same source and moment with different numbers keeps the file's version", () => {
    const plan = planImport(
      onFile,
      [{ date: "2026-08-01", time: "07:12", weightKg: 90.0 }],
      "renpho-csv",
      new Map(),
    );
    expect(plan.toWrite).toEqual([]);
    expect(plan.conflicts).toBe(1);
  });

  it("fills only days that carry no weigh-in, from the first weight of the day", () => {
    const incoming: MeasurementInput[] = [
      { date: "2026-08-02", time: "21:40", weightKg: 92.9 },
      { date: "2026-08-02", time: "07:05", weightKg: 92.3 },
      { date: "2026-08-03", time: "07:00", weightKg: 92.2 },
    ];
    const dayHasWeight = new Map([["2026-08-03", true]]);
    const plan = planImport(onFile, incoming, "renpho-csv", dayHasWeight);
    expect(plan.toWrite).toHaveLength(3);
    expect(plan.fills).toEqual(["2026-08-02"]);
  });

  it("dedupes within one batch, not just against the file", () => {
    const twice: MeasurementInput[] = [
      { date: "2026-08-04", time: "07:00", weightKg: 92.1 },
      { date: "2026-08-04", time: "07:00", weightKg: 92.1 },
    ];
    const plan = planImport([], twice, "csv", new Map());
    expect(plan.toWrite).toHaveLength(1);
    expect(plan.duplicates).toBe(1);
  });
});

/* ===== the Renpho cloud record ===== */

describe("mapRenphoCloudRecord", () => {
  it("renders the epoch stamp in the household's zone and maps only certain fields", () => {
    // 2026-08-01T06:12:44Z is 07:12 in Dublin (IST, UTC+1).
    const reading = mapRenphoCloudRecord(
      { timeStamp: 1785564764, weight: 92.6, bodyfat: 23.8, water: 55.1, visfat: 9, bmr: 1897, muscle: 66.9 },
      "Europe/Dublin",
    );
    expect(reading).toMatchObject({
      date: "2026-08-01",
      time: "07:12",
      weightKg: 92.6,
      bodyFatPct: 23.8,
      waterPct: 55.1,
      visceralFat: 9,
      bmrKcal: 1897,
    });
    // The cloud's "muscle" is a percentage where the app tracks kg — never mapped.
    expect(reading?.muscleMassKg).toBeUndefined();
  });

  it("returns null for a record with no usable stamp or implausible values", () => {
    expect(mapRenphoCloudRecord({ weight: 92.6 }, "Europe/Dublin")).toBeNull();
    expect(mapRenphoCloudRecord({ timeStamp: 1785564764, weight: 926 }, "Europe/Dublin")).toBeNull();
  });
});

/* ===== files out ===== */

describe("csv builders", () => {
  it("writes a BOM, CRLF line ends and ISO dates — the Excel-on-IE-locale rules", () => {
    const text = toCsv(["date", "value"], [["2026-08-01", 1]]);
    expect(text.startsWith("\uFEFF")).toBe(true);
    expect(text).toContain("\r\n");
  });

  it("quotes cells that carry commas", () => {
    expect(toCsv(["a"], [['x, "y"']])).toContain('"x, ""y"""');
  });

  it("builds each export from its rows", () => {
    expect(weighInsCsv([{ date: "2026-08-01", weightKg: 92.6 }])).toContain("2026-08-01,92.6");
    expect(
      trainingCsv([{ date: "2026-08-01", exercise: "Row", setIndex: 1, weightKg: 70, reps: 10, rir: 2 }]),
    ).toContain("Row,1,70,10,2");
    expect(labsCsv([{ date: "2026-08-01", marker: "ldl_c", value: 2.7, unit: "mmol/L" }])).toContain(
      "ldl_c,2.7,mmol/L",
    );
    expect(
      readingsCsv([{ date: "2026-08-01", weightKg: 92.6, source: "renpho-csv" }]),
    ).toContain("2026-08-01,,renpho-csv,92.6");
  });
});

/* ===== the view ===== */

describe("buildConnectView", () => {
  const base = {
    date: TODAY,
    measurements: [
      { date: "2026-08-10", time: "07:00", weightKg: 92.8, source: "renpho-csv" },
      { date: "2026-08-12", time: "07:05", weightKg: 92.6, bodyFatPct: 23.6, source: "renpho-csv" },
    ] as ExistingReading[],
    lastRun: null,
    pollerConfigured: false,
  };

  it("newest first, latest per metric, sources summarised", () => {
    const view = buildConnectView({ ...base, mode: "cut" });
    expect(view.readings[0].date).toBe("2026-08-12");
    expect(view.latest.find((l) => l.key === "weightKg")).toMatchObject({ value: 92.6 });
    expect(view.sources[0]).toMatchObject({ source: "renpho-csv", count: 2, lastDate: "2026-08-12" });
  });

  it("survival is a floor: readings withheld, the poller's honesty kept", () => {
    const view = buildConnectView({ ...base, mode: "survival" });
    expect(view.survival).toBe(true);
    expect(view.readings).toEqual([]);
    expect(view.poller.configured).toBe(false);
  });
});

/* ===== end to end, both users ===== */

describe("sync slice (query + mutation level)", () => {
  it("import writes readings, fills only empty days, and is idempotent on re-import", async () => {
    const { t, liam } = await seeded();
    const rows: MeasurementInput[] = [
      // A fresh date long before the fixtures: fills the day.
      { date: "2026-06-01", time: "07:10", weightKg: 94.9, bodyFatPct: 24.6 },
      // The day before TODAY carries a fixture weigh-in of 92.8 — never overwritten.
      { date: "2026-08-12", time: "09:00", weightKg: 90.0 },
    ];
    const first = await t.mutation(api.tm.sync.importMeasurements, {
      token: liam,
      source: "csv",
      rows,
    });
    expect(first.wrote).toBe(2);
    expect(first.filledDays).toBe(1);
    expect(first.errors).toEqual([]);

    const again = await t.mutation(api.tm.sync.importMeasurements, {
      token: liam,
      source: "csv",
      rows,
    });
    expect(again.wrote).toBe(0);
    expect(again.duplicates).toBe(2);

    await t.run(async (ctx) => {
      // Artur also has a weigh-in on the 12th, so scope the check to Liam's rows.
      const liamUser = await ctx.db
        .query("tm_users")
        .withIndex("by_slug", (q) => q.eq("slug", "liam"))
        .unique();
      const days = (await ctx.db.query("tm_days").collect()).filter(
        (d) => d.userId === liamUser?._id,
      );
      const filled = days.find((d) => d.date === "2026-06-01");
      expect(filled?.weightKg).toBe(94.9);
      const kept = days.find((d) => d.date === "2026-08-12" && d.weightKg !== undefined);
      expect(kept?.weightKg).toBe(92.8);
    });
  });

  it("readings appear in the owner's view and never in the partner's", async () => {
    const { t, liam, artur } = await seeded();
    await t.mutation(api.tm.sync.importMeasurements, {
      token: liam,
      source: "inbody",
      device: "InBody 570",
      rows: [{ date: "2026-08-11", weightKg: 92.71, skeletalMuscleKg: 38.6, bodyFatPct: 23.5 }],
    });

    const liamView = await t.query(api.tm.sync.get, { token: liam, date: TODAY });
    expect(liamView.readings.some((r) => r.weightKg === 92.71)).toBe(true);

    // Artur is on the survival floor, so his own screen withholds readings —
    // and nothing of Liam's can be in it either way.
    const arturView = await t.query(api.tm.sync.get, { token: artur, date: TODAY });
    expect(JSON.stringify(arturView)).not.toContain("92.71");
  });

  it("the crew board still carries no absolute weights after an import", async () => {
    const { t, liam, artur } = await seeded();
    await t.mutation(api.tm.sync.importMeasurements, {
      token: liam,
      source: "csv",
      rows: [{ date: "2026-08-11", time: "06:55", weightKg: 91.27 }],
    });
    for (const token of [liam, artur]) {
      const board = await t.query(api.tm.crew.board, { token, date: TODAY });
      expect(JSON.stringify(board)).not.toContain("91.27");
    }
  });

  it("the export bundle is the caller's file only", async () => {
    const { t, liam, artur } = await seeded();
    await t.mutation(api.tm.sync.importMeasurements, {
      token: liam,
      source: "csv",
      rows: [{ date: "2026-08-11", time: "06:55", weightKg: 91.27 }],
    });
    const liamBundle = await t.query(api.tm.sync.exportBundle, { token: liam });
    expect(liamBundle.readings.some((r) => r.weightKg === 91.27)).toBe(true);
    const arturBundle = await t.query(api.tm.sync.exportBundle, { token: artur });
    expect(JSON.stringify(arturBundle)).not.toContain("91.27");
  });

  it("refuses an oversized import outright", async () => {
    const { t, liam } = await seeded();
    const rows: MeasurementInput[] = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => ({
      date: `2020-01-${String((i % 28) + 1).padStart(2, "0")}`,
      weightKg: 80,
    }));
    await expect(
      t.mutation(api.tm.sync.importMeasurements, { token: liam, source: "csv", rows }),
    ).rejects.toThrow();
  });

  it("implausible rows come back as named errors, plausible ones still land", async () => {
    const { t, liam } = await seeded();
    const report = await t.mutation(api.tm.sync.importMeasurements, {
      token: liam,
      source: "csv",
      rows: [
        { date: "2026-08-09", time: "07:00", weightKg: 92.9 },
        { date: "2026-08-09", time: "07:01", weightKg: 929 },
      ],
    });
    expect(report.wrote).toBe(1);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toMatch(/outside the plausible band/);
  });

  it("an unconfigured deployment says so instead of showing a sync that lies", async () => {
    const { t, liam } = await seeded();
    const view = await t.query(api.tm.sync.get, { token: liam, date: TODAY });
    expect(view.poller.configured).toBe(false);
    expect(view.poller.lastRun).toBeNull();
  });

  it("recordRun keeps a bounded honesty trail the view reads back", async () => {
    const { t, liam } = await seeded();
    for (let i = 0; i < 25; i++) {
      await t.mutation(internal.tm.sync.recordRun, {
        source: "renpho-cloud",
        at: 1000 + i,
        ok: i % 2 === 0,
        reason: i === 24 ? "imported" : "no-new-data",
        fetched: i,
        wrote: 0,
      });
    }
    const view = await t.query(api.tm.sync.get, { token: liam, date: TODAY });
    expect(view.poller.lastRun?.reason).toBe("imported");
    await t.run(async (ctx) => {
      const runs = await ctx.db.query("tm_syncRuns").collect();
      expect(runs.length).toBeLessThanOrEqual(20);
    });
  });
});
