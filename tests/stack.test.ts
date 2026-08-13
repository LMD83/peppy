import { describe, expect, it } from "vitest";
import {
  COMPOUNDS,
  EVIDENCE_ORDER,
  INTERACTIONS,
  compoundByKey,
  compoundByName,
  type CompoundDef,
} from "../convex/tm/data/compounds";
import {
  ReconstitutionError,
  STACK_DISCLAIMER,
  SURVIVAL_DEFER_NOTE,
  adherence,
  applySurvivalFloor,
  buildStackView,
  cyclePhase,
  dosesForDate,
  dueOn,
  interactionsFor,
  reconstitution,
  scheduleLabel,
  timingRank,
  type DoseLog,
  type StackItem,
} from "../convex/tm/logic-stack";
import { buildStackFixtures } from "../convex/tm/fixtures/stack";
import { addDays } from "../convex/tm/lib";

const TODAY = "2026-08-13"; // Thursday

function item(over: Partial<StackItem> = {}): StackItem {
  return {
    id: "i1",
    name: "Creatine monohydrate",
    kind: "supplement",
    dose: 5,
    unit: "g",
    route: "oral",
    timings: ["am"],
    scheduleType: "daily",
    startDate: addDays(TODAY, -30),
    withFood: false,
    evidence: "strong",
    cautions: [],
    active: true,
    ...over,
  };
}

/* ===== catalogue ===== */

describe("compound catalogue", () => {
  it("carries at least 24 compounds with unique keys", () => {
    expect(COMPOUNDS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(COMPOUNDS.map((c) => c.key)).size).toBe(COMPOUNDS.length);
  });

  it("covers all three kinds", () => {
    for (const kind of ["med", "peptide", "supplement"] as const) {
      expect(COMPOUNDS.some((c) => c.kind === kind), kind).toBe(true);
    }
  });

  it("gives every compound a unit, a route, a mechanism and a tier", () => {
    for (const c of COMPOUNDS) {
      expect(c.defaultUnit.length, c.key).toBeGreaterThan(0);
      expect(c.mechanism.length, c.key).toBeGreaterThan(10);
      expect(EVIDENCE_ORDER).toContain(c.evidence);
      expect(Array.isArray(c.cautions), c.key).toBe(true);
      expect(Array.isArray(c.monitor), c.key).toBe(true);
    }
  });

  it("states evidence honestly — strong for the proven, limited for the peptides", () => {
    const tier = (key: string): CompoundDef["evidence"] => {
      const c = compoundByKey(key);
      if (!c) throw new Error(`missing ${key}`);
      return c.evidence;
    };
    expect(tier("creatine_monohydrate")).toBe("strong");
    expect(tier("vitamin_d3")).toBe("strong");
    expect(tier("semaglutide")).toBe("strong");
    expect(tier("tirzepatide")).toBe("strong");
    expect(tier("omega_3")).toBe("moderate");
    expect(tier("magnesium_glycinate")).toBe("moderate");
    expect(["limited", "anecdotal"]).toContain(tier("bpc_157"));
    expect(["limited", "anecdotal"]).toContain(tier("tb_500"));
    expect(["limited", "anecdotal"]).toContain(tier("nad_plus"));
  });

  it("never lets a peptide claim strong or moderate evidence", () => {
    for (const c of COMPOUNDS.filter((x) => x.kind === "peptide")) {
      expect(["limited", "anecdotal"], c.key).toContain(c.evidence);
      expect(c.cautions.length, c.key).toBeGreaterThan(0);
    }
  });

  it("resolves names back to the catalogue, including the bare form", () => {
    expect(compoundByName("Creatine monohydrate")?.key).toBe("creatine_monohydrate");
    expect(compoundByName("  atorvastatin ")?.key).toBe("atorvastatin");
    expect(compoundByName("Atorvastatin (statin)")?.key).toBe("atorvastatin");
    expect(compoundByName("unicorn dust")).toBeUndefined();
  });

  it("only pairs compounds that exist, and never pairs one with itself", () => {
    for (const x of INTERACTIONS) {
      expect(compoundByKey(x.a), x.a).toBeDefined();
      expect(compoundByKey(x.b), x.b).toBeDefined();
      expect(x.a).not.toBe(x.b);
      expect(x.note.length).toBeGreaterThan(20);
    }
  });

  it("covers the pairs that actually bite", () => {
    const has = (a: string, b: string) =>
      INTERACTIONS.some((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    expect(has("levothyroxine", "magnesium_glycinate")).toBe(true);
    expect(has("omeprazole", "vitamin_b12")).toBe(true);
    expect(has("caffeine", "melatonin")).toBe(true);
  });

  it("keeps the grapefruit warning on the statin itself — food has no protocol row", () => {
    const statin = compoundByKey("atorvastatin");
    expect(statin?.cautions.some((c) => c.toLowerCase().includes("grapefruit"))).toBe(true);
  });
});

/* ===== schedules ===== */

describe("dueOn", () => {
  it("runs a daily item every day inside its window", () => {
    const it1 = item({ startDate: "2026-08-10", endDate: "2026-08-12" });
    expect(dueOn(it1, "2026-08-09")).toBe(false);
    expect(dueOn(it1, "2026-08-10")).toBe(true);
    expect(dueOn(it1, "2026-08-12")).toBe(true);
    expect(dueOn(it1, "2026-08-13")).toBe(false);
  });

  it("never runs an inactive item", () => {
    expect(dueOn(item({ active: false }), TODAY)).toBe(false);
  });

  it("matches weekdays by calendar day", () => {
    const weekly = item({ scheduleType: "weekdays", weekdays: [1, 4] });
    expect(dueOn(weekly, TODAY)).toBe(true); // Thursday
    expect(dueOn(weekly, addDays(TODAY, 1))).toBe(false); // Friday
    expect(dueOn(weekly, addDays(TODAY, 4))).toBe(true); // Monday
  });

  it("treats an empty weekday set as never due", () => {
    expect(dueOn(item({ scheduleType: "weekdays" }), TODAY)).toBe(false);
    expect(dueOn(item({ scheduleType: "weekdays", weekdays: [] }), TODAY)).toBe(false);
  });

  it("counts an interval from the start date", () => {
    const every3 = item({ scheduleType: "interval", intervalDays: 3, startDate: "2026-08-01" });
    expect(dueOn(every3, "2026-08-01")).toBe(true);
    expect(dueOn(every3, "2026-08-02")).toBe(false);
    expect(dueOn(every3, "2026-08-04")).toBe(true);
    expect(dueOn(every3, "2026-08-07")).toBe(true);
  });

  it("rejects a nonsense interval instead of guessing", () => {
    expect(dueOn(item({ scheduleType: "interval", intervalDays: 0 }), TODAY)).toBe(false);
    expect(dueOn(item({ scheduleType: "interval", intervalDays: -2 }), TODAY)).toBe(false);
    expect(dueOn(item({ scheduleType: "interval", intervalDays: 1.5 }), TODAY)).toBe(false);
    expect(dueOn(item({ scheduleType: "interval" }), TODAY)).toBe(false);
  });

  it("is due only in the on-phase of a cycle", () => {
    const cycled = item({
      scheduleType: "cycle",
      cycleOnWeeks: 5,
      cycleOffWeeks: 2,
      startDate: "2026-08-01",
    });
    expect(dueOn(cycled, "2026-08-11")).toBe(true); // day 10 — on
    expect(dueOn(cycled, "2026-09-05")).toBe(false); // day 35 — off
    expect(dueOn(cycled, "2026-09-19")).toBe(true); // day 49 — back on
  });

  it("never runs a cycle with no on-weeks", () => {
    expect(dueOn(item({ scheduleType: "cycle", cycleOffWeeks: 2 }), TODAY)).toBe(false);
  });
});

describe("cyclePhase", () => {
  const cycled = item({
    scheduleType: "cycle",
    cycleOnWeeks: 5,
    cycleOffWeeks: 2,
    startDate: "2026-08-01",
  });

  it("is null for anything that is not cycled", () => {
    expect(cyclePhase(item(), TODAY)).toBeNull();
    expect(cyclePhase(item({ scheduleType: "weekdays", weekdays: [1] }), TODAY)).toBeNull();
  });

  it("is null before the item starts", () => {
    expect(cyclePhase(cycled, "2026-07-31")).toBeNull();
  });

  it("reports the week inside the on-phase and the next switch", () => {
    expect(cyclePhase(cycled, "2026-08-11")).toEqual({
      phase: "on",
      weekInPhase: 2,
      nextSwitchDate: "2026-09-05",
    });
  });

  it("reports the off-phase and when it ends", () => {
    expect(cyclePhase(cycled, "2026-09-05")).toEqual({
      phase: "off",
      weekInPhase: 1,
      nextSwitchDate: "2026-09-19",
    });
  });

  it("repeats forever from the start date", () => {
    expect(cyclePhase(cycled, "2026-09-19")?.phase).toBe("on");
    expect(cyclePhase(cycled, "2026-09-19")?.weekInPhase).toBe(1);
  });
});

describe("scheduleLabel", () => {
  it("reads the way a person would say it", () => {
    expect(scheduleLabel(item(), TODAY)).toBe("daily");
    expect(scheduleLabel(item({ scheduleType: "weekdays", weekdays: [1, 4] }), TODAY)).toBe("Mon/Thu");
    expect(scheduleLabel(item({ scheduleType: "weekdays", weekdays: [1, 2, 3, 4, 5] }), TODAY)).toBe(
      "weekdays",
    );
    expect(scheduleLabel(item({ scheduleType: "weekdays", weekdays: [0, 6] }), TODAY)).toBe("weekends");
    expect(scheduleLabel(item({ scheduleType: "interval", intervalDays: 3 }), TODAY)).toBe(
      "every 3 days",
    );
    expect(scheduleLabel(item({ scheduleType: "interval", intervalDays: 7 }), TODAY)).toBe("weekly");
  });

  it("says where a cycle is standing today", () => {
    const cycled = item({
      scheduleType: "cycle",
      cycleOnWeeks: 5,
      cycleOffWeeks: 2,
      startDate: "2026-08-01",
    });
    expect(scheduleLabel(cycled, "2026-08-11")).toBe("5 on / 2 off — on week 2 of 5");
    expect(scheduleLabel(cycled, "2026-09-05")).toBe("5 on / 2 off — off week 1 of 2");
  });

  it("says so rather than inventing a schedule", () => {
    expect(scheduleLabel(item({ scheduleType: "weekdays" }), TODAY)).toBe("no days set");
    expect(scheduleLabel(item({ scheduleType: "interval" }), TODAY)).toBe("no interval set");
    expect(scheduleLabel(item({ scheduleType: "cycle" }), TODAY)).toBe("no cycle set");
  });
});

/* ===== doses ===== */

describe("dosesForDate", () => {
  const items: StackItem[] = [
    item({ id: "mag", name: "Magnesium glycinate", timings: ["pre-bed"], evidence: "moderate" }),
    item({ id: "caf", name: "Caffeine", timings: ["pre-workout"] }),
    item({ id: "cre", name: "Creatine monohydrate", timings: ["am"] }),
    item({ id: "off", name: "Zinc", active: false }),
  ];

  it("orders the day am → pre-workout → pm → pre-bed", () => {
    const doses = dosesForDate(items, [], TODAY);
    expect(doses.map((d) => d.timing)).toEqual(["am", "pre-workout", "pre-bed"]);
    expect(timingRank("am")).toBeLessThan(timingRank("pre-bed"));
    expect(timingRank("whenever")).toBeGreaterThan(timingRank("pre-bed"));
  });

  it("skips items that are not due and leaves untouched doses untaken", () => {
    const doses = dosesForDate(items, [], TODAY);
    expect(doses.some((d) => d.itemId === "off")).toBe(false);
    expect(doses.every((d) => d.taken === false && d.site === null)).toBe(true);
  });

  it("carries the log's taken flag and injection site through", () => {
    const logs: DoseLog[] = [
      { itemId: "cre", date: TODAY, timing: "am", taken: true, site: "n/a" },
      { itemId: "mag", date: addDays(TODAY, -1), timing: "pre-bed", taken: true },
    ];
    const doses = dosesForDate(items, logs, TODAY);
    const creatine = doses.find((d) => d.itemId === "cre");
    expect(creatine?.taken).toBe(true);
    expect(creatine?.site).toBe("n/a");
    // Yesterday's log must not colour today.
    expect(doses.find((d) => d.itemId === "mag")?.taken).toBe(false);
  });

  it("expands one dose per timing", () => {
    const twice = item({ id: "two", timings: ["am", "pm"] });
    expect(dosesForDate([twice], [], TODAY)).toHaveLength(2);
  });
});

describe("applySurvivalFloor", () => {
  const doses = dosesForDate(
    [
      item({ id: "med", name: "Levothyroxine", kind: "med", evidence: "strong" }),
      item({ id: "pep", name: "BPC-157", kind: "peptide", evidence: "limited" }),
      item({ id: "sup", name: "Omega-3 (EPA/DHA)", evidence: "moderate" }),
      item({ id: "cre", name: "Creatine monohydrate", evidence: "strong" }),
    ],
    [],
    TODAY,
  );

  it("defers nothing outside survival", () => {
    expect(applySurvivalFloor(doses, false).every((d) => !d.deferred)).toBe(true);
  });

  it("keeps meds and strong evidence, defers the rest with a reason", () => {
    const floor = applySurvivalFloor(doses, true);
    const byId = new Map(floor.map((d) => [d.itemId, d]));
    expect(byId.get("med")?.deferred).toBe(false);
    expect(byId.get("cre")?.deferred).toBe(false);
    expect(byId.get("pep")?.deferred).toBe(true);
    expect(byId.get("sup")?.deferred).toBe(true);
    expect(byId.get("pep")?.deferredNote).toBe(SURVIVAL_DEFER_NOTE);
    expect(byId.get("med")?.deferredNote).toBeNull();
  });

  it("never drops a dose from the list", () => {
    expect(applySurvivalFloor(doses, true)).toHaveLength(doses.length);
  });
});

/* ===== adherence ===== */

describe("adherence", () => {
  const daily = item({ id: "d", startDate: addDays(TODAY, -30) });

  const logsFor = (dates: string[], taken = true): DoseLog[] =>
    dates.map((date) => ({ itemId: "d", date, timing: "am", taken }));

  it("counts only the days the item was due", () => {
    const weekly = item({ id: "d", scheduleType: "weekdays", weekdays: [4], startDate: addDays(TODAY, -30) });
    const a = adherence([weekly], logsFor([TODAY]), addDays(TODAY, -6), TODAY);
    expect(a.dueCount).toBe(1);
    expect(a.takenCount).toBe(1);
    expect(a.pct).toBe(100);
  });

  it("scores a perfect week at 100 and a half week at 50", () => {
    const week = [6, 5, 4, 3, 2, 1, 0].map((b) => addDays(TODAY, -b));
    expect(adherence([daily], logsFor(week), addDays(TODAY, -6), TODAY).pct).toBe(100);
    expect(adherence([daily], logsFor(week.slice(0, 4)), addDays(TODAY, -6), TODAY).pct).toBe(57);
  });

  it("treats an explicit not-taken row the same as no row at all", () => {
    const week = [6, 5, 4, 3, 2, 1, 0].map((b) => addDays(TODAY, -b));
    const mixed = [...logsFor(week.slice(0, 5)), ...logsFor(week.slice(5), false)];
    expect(adherence([daily], mixed, addDays(TODAY, -6), TODAY).takenCount).toBe(5);
  });

  it("reports 100% when nothing was due — an empty window is not a failure", () => {
    const paused = item({ id: "d", active: false });
    const a = adherence([paused], [], addDays(TODAY, -6), TODAY);
    expect(a.dueCount).toBe(0);
    expect(a.pct).toBe(100);
  });

  it("builds a per-item streak that today cannot break", () => {
    const past = [4, 3, 2, 1].map((b) => addDays(TODAY, -b));
    // Four clean days, today not logged yet.
    const a = adherence([daily], logsFor(past), addDays(TODAY, -6), TODAY);
    expect(a.perItem[0].streak).toBe(4);
  });

  it("breaks the streak on a completed miss", () => {
    const past = [4, 3, 1].map((b) => addDays(TODAY, -b));
    const a = adherence([daily], logsFor([...past, TODAY]), addDays(TODAY, -6), TODAY);
    expect(a.perItem[0].streak).toBe(2); // today + yesterday, then the gap
  });

  it("needs every timing of a day before the day counts to the streak", () => {
    const twice = item({ id: "d", timings: ["am", "pm"] });
    const half: DoseLog[] = [{ itemId: "d", date: addDays(TODAY, -1), timing: "am", taken: true }];
    expect(adherence([twice], half, addDays(TODAY, -6), TODAY).perItem[0].streak).toBe(0);
  });
});

/* ===== reconstitution ===== */

describe("reconstitution", () => {
  it("does the standard 5 mg in 2 mL, 250 mcg draw", () => {
    expect(reconstitution({ vialMg: 5, bacMl: 2, doseMcg: 250, syringeUnitsPerMl: 100 })).toEqual({
      mgPerMl: 2.5,
      mlPerDose: 0.1,
      syringeUnits: 10,
    });
  });

  it("handles a concentration that does not divide cleanly", () => {
    const r = reconstitution({ vialMg: 10, bacMl: 3, doseMcg: 500, syringeUnitsPerMl: 100 });
    expect(r.mgPerMl).toBe(3.33);
    expect(r.mlPerDose).toBe(0.15);
    expect(r.syringeUnits).toBe(15);
  });

  it("rounds syringe marks to the half unit you can actually read", () => {
    const r = reconstitution({ vialMg: 5, bacMl: 2, doseMcg: 333, syringeUnitsPerMl: 100 });
    expect(r.syringeUnits).toBe(13.5);
    // Rounding happens once, at the end — not on the intermediate concentration.
    expect(r.mlPerDose).toBe(0.133);
  });

  it("scales with the syringe graduation", () => {
    const fifty = reconstitution({ vialMg: 5, bacMl: 2, doseMcg: 250, syringeUnitsPerMl: 50 });
    expect(fifty.syringeUnits).toBe(5);
  });

  it("doubling the diluent halves the volume drawn", () => {
    const thin = reconstitution({ vialMg: 5, bacMl: 4, doseMcg: 250, syringeUnitsPerMl: 100 });
    expect(thin.mgPerMl).toBe(1.25);
    expect(thin.mlPerDose).toBe(0.2);
    expect(thin.syringeUnits).toBe(20);
  });

  it("throws a typed error on zero, negative and non-finite inputs", () => {
    const bad = [
      { vialMg: 0, bacMl: 2, doseMcg: 250, syringeUnitsPerMl: 100 },
      { vialMg: 5, bacMl: 0, doseMcg: 250, syringeUnitsPerMl: 100 },
      { vialMg: 5, bacMl: 2, doseMcg: -250, syringeUnitsPerMl: 100 },
      { vialMg: 5, bacMl: 2, doseMcg: 250, syringeUnitsPerMl: 0 },
      { vialMg: Number.NaN, bacMl: 2, doseMcg: 250, syringeUnitsPerMl: 100 },
    ];
    for (const input of bad) {
      expect(() => reconstitution(input)).toThrow(ReconstitutionError);
    }
  });

  it("names the field that is wrong", () => {
    expect(() => reconstitution({ vialMg: 5, bacMl: -1, doseMcg: 250, syringeUnitsPerMl: 100 })).toThrow(
      /Bacteriostatic water/,
    );
  });

  it("refuses a dose bigger than the vial instead of printing a fantasy", () => {
    expect(() =>
      reconstitution({ vialMg: 5, bacMl: 2, doseMcg: 10_000, syringeUnitsPerMl: 100 }),
    ).toThrow(/larger than the whole vial/);
  });
});

/* ===== interactions ===== */

describe("interactionsFor", () => {
  it("matches only pairs where both compounds are on the file", () => {
    const matched = interactionsFor([
      { name: "Levothyroxine" },
      { name: "Magnesium glycinate" },
      { name: "Creatine monohydrate" },
    ]);
    expect(matched).toHaveLength(1);
    expect(matched[0].aName).toBe("Levothyroxine");
    expect(matched[0].severity).toBe("caution");
  });

  it("finds nothing when only one half of a pair is present", () => {
    expect(interactionsFor([{ name: "Levothyroxine" }])).toHaveLength(0);
  });

  it("ignores names the catalogue does not recognise", () => {
    expect(interactionsFor([{ name: "Mystery vial" }, { name: "Another vial" }])).toHaveLength(0);
  });

  it("puts cautions ahead of information", () => {
    const matched = interactionsFor([
      { name: "Levothyroxine" },
      { name: "Magnesium glycinate" },
      { name: "Omeprazole (PPI)" },
      { name: "Vitamin B12" },
    ]);
    expect(matched.length).toBeGreaterThan(1);
    expect(matched[0].severity).toBe("caution");
    expect(matched[matched.length - 1].severity).toBe("info");
  });
});

/* ===== the assembled view ===== */

describe("buildStackView", () => {
  const items: StackItem[] = [
    item({ id: "med", name: "Levothyroxine", kind: "med", evidence: "strong" }),
    item({ id: "mag", name: "Magnesium glycinate", evidence: "moderate", timings: ["pre-bed"] }),
    item({
      id: "pep",
      name: "BPC-157",
      kind: "peptide",
      evidence: "limited",
      route: "subcut",
      scheduleType: "cycle",
      cycleOnWeeks: 5,
      cycleOffWeeks: 2,
      startDate: addDays(TODAY, -10),
      recon: { vialMg: 5, bacMl: 2, syringeUnitsPerMl: 100 },
    }),
  ];

  it("groups by kind and carries the standing disclaimer", () => {
    const view = buildStackView({ mode: "cut", date: TODAY, items, logs: [] });
    expect(view.byKind.med.map((i) => i.id)).toEqual(["med"]);
    expect(view.byKind.peptide.map((i) => i.id)).toEqual(["pep"]);
    expect(view.byKind.supplement.map((i) => i.id)).toEqual(["mag"]);
    expect(view.disclaimer).toBe(STACK_DISCLAIMER);
    expect(view.survival).toBe(false);
  });

  it("counts today's doses and surfaces the running cycle", () => {
    const logs: DoseLog[] = [{ itemId: "med", date: TODAY, timing: "am", taken: true }];
    const view = buildStackView({ mode: "cut", date: TODAY, items, logs });
    expect(view.dueCount).toBe(3);
    expect(view.takenCount).toBe(1);
    expect(view.cycles).toEqual([
      { id: "pep", name: "BPC-157", phase: "on", weekInPhase: 2, nextSwitchDate: addDays(TODAY, 25) },
    ]);
  });

  it("carries the schedule label and the recon block onto the item view", () => {
    const view = buildStackView({ mode: "cut", date: TODAY, items, logs: [] });
    const peptide = view.items.find((i) => i.id === "pep");
    expect(peptide?.scheduleLabel).toBe("5 on / 2 off — on week 2 of 5");
    expect(peptide?.recon).toEqual({ vialMg: 5, bacMl: 2, syringeUnitsPerMl: 100 });
    expect(view.items.find((i) => i.id === "med")?.recon).toBeNull();
  });

  it("collapses to the floor in survival without hiding a single dose", () => {
    const view = buildStackView({ mode: "survival", date: TODAY, items, logs: [] });
    expect(view.survival).toBe(true);
    expect(view.dueToday).toHaveLength(3);
    expect(view.dueCount).toBe(1); // the med only
    const med = view.dueToday.find((d) => d.itemId === "med");
    expect(med?.deferred).toBe(false);
    expect(view.dueToday.filter((d) => d.deferred).map((d) => d.itemId).sort()).toEqual(["mag", "pep"]);
  });

  it("drops a paused item out of the schedule but keeps it on the list", () => {
    const paused = items.map((i) => (i.id === "mag" ? { ...i, active: false } : i));
    const view = buildStackView({ mode: "cut", date: TODAY, items: paused, logs: [] });
    expect(view.items.some((i) => i.id === "mag")).toBe(true);
    expect(view.dueToday.some((d) => d.itemId === "mag")).toBe(false);
    expect(view.items[view.items.length - 1].id).toBe("mag"); // paused sinks to the bottom
  });
});

/* ===== fixtures ===== */

describe("stack fixtures", () => {
  const fx = buildStackFixtures(TODAY);

  it("gives Liam a full stack and Conor the floor", () => {
    const liam = fx.protocolItems.filter((i) => i.userSlug === "liam");
    const conor = fx.protocolItems.filter((i) => i.userSlug === "conor");
    expect(liam.length).toBeGreaterThanOrEqual(7);
    expect(liam.some((i) => i.kind === "peptide" && i.recon !== undefined)).toBe(true);
    expect(liam.some((i) => i.kind === "med")).toBe(true);
    expect(liam.some((i) => i.scheduleType === "cycle")).toBe(true);
    expect(conor).toHaveLength(2);
    expect(conor.some((i) => i.kind === "med")).toBe(true);
    expect(conor.every((i) => i.kind !== "peptide")).toBe(true);
  });

  it("uses unique ids and only references real ones from the logs", () => {
    const ids = new Set(fx.protocolItems.map((i) => i.id));
    expect(ids.size).toBe(fx.protocolItems.length);
    for (const log of fx.doseLogs) expect(ids.has(log.itemId)).toBe(true);
  });

  it("logs three weeks at roughly 85% adherence", () => {
    const items: StackItem[] = fx.protocolItems
      .filter((i) => i.userSlug === "liam")
      .map(({ userSlug: _s, ...row }) => row);
    const logs: DoseLog[] = fx.doseLogs
      .filter((l) => l.userSlug === "liam")
      .map((l) => ({ itemId: l.itemId, date: l.date, timing: l.timing, taken: l.taken, site: l.site }));
    const a = adherence(items, logs, addDays(TODAY, -20), addDays(TODAY, -1));
    expect(a.dueCount).toBeGreaterThan(80);
    expect(a.pct).toBeGreaterThanOrEqual(78);
    expect(a.pct).toBeLessThanOrEqual(92);
  });

  it("leaves a visible run of misses to look at", () => {
    const missed = fx.doseLogs
      .filter((l) => l.itemId === "pi_liam_magnesium" && !l.taken)
      .map((l) => l.date)
      .sort();
    expect(missed).toEqual([addDays(TODAY, -9), addDays(TODAY, -8), addDays(TODAY, -7)]);
  });

  it("records an injection site for subcutaneous doses only", () => {
    const byId = new Map(fx.protocolItems.map((i) => [i.id, i]));
    for (const log of fx.doseLogs) {
      const route = byId.get(log.itemId)?.route;
      if (route === "subcut") expect(log.site, log.itemId).toBeDefined();
      else expect(log.site, log.itemId).toBeUndefined();
    }
  });

  it("leaves today's evening doses unlogged — the day is still in play", () => {
    const today = fx.doseLogs.filter((l) => l.date === TODAY);
    expect(today.length).toBeGreaterThan(0);
    expect(today.every((l) => l.timing === "am" || l.timing === "pre-workout")).toBe(true);
  });

  it("assembles into a view where Liam runs a cycle and Conor holds a floor", () => {
    const forUser = (slug: string) => ({
      items: fx.protocolItems
        .filter((i) => i.userSlug === slug)
        .map(({ userSlug: _s, ...row }) => row),
      logs: fx.doseLogs
        .filter((l) => l.userSlug === slug)
        .map((l) => ({ itemId: l.itemId, date: l.date, timing: l.timing, taken: l.taken, site: l.site })),
    });

    const liam = buildStackView({ mode: "cut", date: TODAY, ...forUser("liam") });
    expect(liam.survival).toBe(false);
    expect(liam.cycles).toHaveLength(1);
    expect(liam.cycles[0].phase).toBe("on");
    expect(liam.byKind.med.length).toBeGreaterThan(0);
    expect(liam.byKind.peptide[0].recon).not.toBeNull();
    expect(liam.adherence30.pct).toBeGreaterThan(70);

    const conor = buildStackView({ mode: "survival", date: TODAY, ...forUser("conor") });
    expect(conor.survival).toBe(true);
    // Both of Conor's items are essential — a floor that defers nothing still holds.
    expect(conor.dueToday.every((d) => !d.deferred)).toBe(true);
    expect(conor.dueToday.some((d) => d.kind === "med")).toBe(true);
    expect(conor.cycles).toHaveLength(0);
  });

  it("surfaces the statin pairs on Liam's file", () => {
    const liam = fx.protocolItems.filter((i) => i.userSlug === "liam" && i.active);
    const matched = interactionsFor(liam);
    expect(matched.length).toBeGreaterThanOrEqual(2);
    expect(matched.every((m) => m.note.length > 0)).toBe(true);
  });
});
