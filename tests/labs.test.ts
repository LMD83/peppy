import { describe, expect, it } from "vitest";
import {
  GROUP_LABELS,
  GROUP_ORDER,
  MARKERS,
  PANEL_TEMPLATES,
  isKnownMarker,
  markerByKey,
  type MarkerDef,
} from "../convex/tm/data/markers";
import {
  BORDERLINE_FRACTION,
  CHOLESTEROL_FACTOR,
  FLAT_PCT,
  GLUCOSE_FACTOR,
  MAX_TREND_POINTS,
  RECHECK_DAYS,
  buildLabsView,
  convertUnit,
  deltaFor,
  flagFor,
  isOutOfRange,
  panelSummary,
  pctOutsideRange,
  recheckDue,
  recheckDueDays,
  severityOf,
  trendFor,
  type LabFlag,
  type LabsViewInput,
} from "../convex/tm/logic-labs";
import { buildLabsFixtures } from "../convex/tm/fixtures/labs";
import { addDays } from "../convex/tm/lib";

const TODAY = "2026-08-13";
const FX = buildLabsFixtures(TODAY);

function def(key: string): MarkerDef {
  const m = markerByKey(key);
  if (!m) throw new Error(`missing marker ${key}`);
  return m;
}

function viewFor(slug: string, mode: LabsViewInput["mode"], date = TODAY) {
  return buildLabsView({
    mode,
    date,
    panels: FX.labPanels.filter((p) => p.userSlug === slug),
    results: FX.labResults.filter((r) => r.userSlug === slug),
  });
}

describe("marker catalogue", () => {
  it("carries a broad panel with unique keys", () => {
    expect(MARKERS.length).toBeGreaterThanOrEqual(35);
    expect(new Set(MARKERS.map((m) => m.key)).size).toBe(MARKERS.length);
  });

  it("covers every group and labels each one", () => {
    for (const group of GROUP_ORDER) {
      expect(MARKERS.some((m) => m.group === group)).toBe(true);
      expect(GROUP_LABELS[group].length).toBeGreaterThan(0);
    }
    for (const m of MARKERS) expect(GROUP_ORDER).toContain(m.group);
  });

  it("keeps every reference interval coherent", () => {
    for (const m of MARKERS) {
      expect(m.refHigh, m.key).toBeGreaterThan(m.refLow);
      expect(m.unit.length, m.key).toBeGreaterThan(0);
      expect(m.blurb.endsWith("."), m.key).toBe(true);
      expect(m.movedBy.length, m.key).toBeGreaterThan(0);
    }
  });

  it("only ever states an optimal band as a pair inside the reference interval", () => {
    for (const m of MARKERS) {
      expect(m.optimalLow === undefined, m.key).toBe(m.optimalHigh === undefined);
      if (m.optimalLow === undefined || m.optimalHigh === undefined) continue;
      expect(m.optimalLow, m.key).toBeGreaterThanOrEqual(m.refLow);
      expect(m.optimalHigh, m.key).toBeLessThanOrEqual(m.refHigh);
      expect(m.optimalHigh, m.key).toBeGreaterThan(m.optimalLow);
    }
  });

  it("leaves the optimal band off where the evidence is weak", () => {
    // Marketing puts an "optimal" band on these; the evidence does not.
    for (const key of ["testosterone_total", "testosterone_free", "vitamin_b12", "lp_a"]) {
      expect(def(key).optimalLow, key).toBeUndefined();
    }
    // And keeps one where outcome data supports it.
    expect(def("apob").optimalHigh).toBe(0.8);
  });

  it("builds every panel template from real marker keys", () => {
    expect(PANEL_TEMPLATES.length).toBeGreaterThanOrEqual(9);
    for (const t of PANEL_TEMPLATES) {
      expect(t.markers.length, t.key).toBeGreaterThan(0);
      for (const key of t.markers) expect(isKnownMarker(key), `${t.key}/${key}`).toBe(true);
    }
  });

  it("returns null for an unknown key instead of throwing", () => {
    expect(markerByKey("not_a_marker")).toBeNull();
    expect(isKnownMarker("not_a_marker")).toBe(false);
  });
});

describe("flagFor", () => {
  const ldl = def("ldl_c"); // ref 1.2–3.0, optimal 1.2–2.0

  it("flags either side of the reference interval", () => {
    expect(flagFor(ldl, 3.4)).toBe("high");
    expect(flagFor(ldl, 1.0)).toBe("low");
  });

  it("names the optimal band only when the value sits inside it", () => {
    expect(flagFor(ldl, 1.8)).toBe("optimal");
    expect(flagFor(ldl, 2.4)).toBe("in-range");
  });

  it("calls borderline within a tenth of the interval width of a bound", () => {
    // width 1.8 → edge 0.18
    expect(BORDERLINE_FRACTION).toBe(0.1);
    expect(flagFor(ldl, 2.9)).toBe("borderline-high");
    expect(flagFor(ldl, 2.83)).toBe("borderline-high");
    expect(flagFor(ldl, 2.7)).toBe("in-range");
  });

  it("lets an evidence-backed optimal band outrank proximity to a bound", () => {
    const crp = def("hs_crp"); // ref 0–3.0, optimal 0–1.0
    expect(flagFor(crp, 0.9)).toBe("optimal");
  });

  it("never warns about being close to a floor of zero", () => {
    expect(flagFor(def("hs_crp"), 0.05)).toBe("optimal");
    expect(flagFor(def("esr"), 1)).toBe("in-range");
  });

  it("does not treat the good end of a higher-is-better marker as borderline", () => {
    const egfr = def("egfr"); // ref 90–120, higher is better
    expect(flagFor(egfr, 118)).toBe("in-range");
    expect(flagFor(egfr, 92)).toBe("borderline-low");
  });

  it("degrades safely for an unknown marker or a broken value", () => {
    expect(flagFor(null, 42)).toBe("in-range");
    expect(flagFor(undefined, 42)).toBe("in-range");
    expect(flagFor(ldl, Number.NaN)).toBe("in-range");
  });
});

describe("severityOf", () => {
  it("sorts optimal below in-range below borderline below out-of-range", () => {
    const order: LabFlag[] = ["optimal", "in-range", "borderline-high", "high"];
    const severities = order.map(severityOf);
    expect(severities).toEqual([0, 1, 2, 3]);
    expect(severityOf("borderline-low")).toBe(2);
    expect(severityOf("low")).toBe(3);
  });

  it("agrees with isOutOfRange", () => {
    for (const flag of [
      "low",
      "borderline-low",
      "in-range",
      "optimal",
      "borderline-high",
      "high",
    ] as LabFlag[]) {
      expect(isOutOfRange(flag)).toBe(severityOf(flag) === 3);
    }
  });
});

describe("deltaFor", () => {
  it("needs two draws", () => {
    expect(deltaFor([])).toBeNull();
    expect(deltaFor([{ date: "2026-01-01", value: 3.2 }])).toBeNull();
  });

  it("measures the latest against the draw before it", () => {
    const d = deltaFor([
      { date: "2026-01-01", value: 3.6 },
      { date: "2026-04-01", value: 3.2 },
      { date: "2026-08-01", value: 2.7 },
    ]);
    expect(d).not.toBeNull();
    expect(d?.change).toBe(-0.5);
    expect(d?.pctChange).toBe(-15.6);
    expect(d?.direction).toBe("down");
    expect(d?.sinceDate).toBe("2026-04-01");
  });

  it("calls a move under the noise floor flat", () => {
    const d = deltaFor([
      { date: "2026-01-01", value: 100 },
      { date: "2026-04-01", value: 101 },
    ]);
    expect(Math.abs(d?.pctChange ?? 0)).toBeLessThan(FLAT_PCT);
    expect(d?.direction).toBe("flat");
  });

  it("reports a rise as up", () => {
    expect(
      deltaFor([
        { date: "2026-01-01", value: 30 },
        { date: "2026-04-01", value: 42 },
      ])?.direction,
    ).toBe("up");
  });
});

describe("trendFor", () => {
  const history = [
    { date: "2026-01-01", value: 3.6 },
    { date: "2026-04-01", value: 3.2 },
    { date: "2026-08-01", value: 2.7 },
  ];

  it("normalises to 0..1 across the window", () => {
    const points = trendFor(history, 12);
    expect(points.map((p) => p.y01)).toEqual([1, 0.56, 0]);
    expect(points.map((p) => p.value)).toEqual([3.6, 3.2, 2.7]);
  });

  it("keeps only the last maxPoints", () => {
    const points = trendFor(history, 2);
    expect(points.map((p) => p.date)).toEqual(["2026-04-01", "2026-08-01"]);
  });

  it("plots a flat series down the middle", () => {
    const points = trendFor(
      [
        { date: "2026-01-01", value: 5 },
        { date: "2026-04-01", value: 5 },
      ],
      12,
    );
    expect(points.every((p) => p.y01 === 0.5)).toBe(true);
  });

  it("returns nothing for an empty history or a zero window", () => {
    expect(trendFor([], 12)).toEqual([]);
    expect(trendFor(history, 0)).toEqual([]);
  });
});

describe("panelSummary", () => {
  const results = [
    { marker: "ferritin", flag: "low" as LabFlag, value: 27, refLow: 30, refHigh: 400 },
    { marker: "ldl_c", flag: "high" as LabFlag, value: 4.8, refLow: 1.2, refHigh: 3.0 },
    { marker: "alt", flag: "borderline-high" as LabFlag, value: 47, refLow: 10, refHigh: 50 },
    { marker: "hs_crp", flag: "optimal" as LabFlag, value: 0.6, refLow: 0, refHigh: 3.0 },
    { marker: "urea", flag: "in-range" as LabFlag, value: 5.4, refLow: 2.5, refHigh: 7.8 },
  ];

  it("counts every flag", () => {
    const { counts } = panelSummary(results);
    expect(counts.low).toBe(1);
    expect(counts.high).toBe(1);
    expect(counts["borderline-high"]).toBe(1);
    expect(counts.optimal).toBe(1);
    expect(counts["in-range"]).toBe(1);
    expect(counts["borderline-low"]).toBe(0);
  });

  it("ranks concerns by severity, then by how far outside the interval they sit", () => {
    const { concerns } = panelSummary(results);
    // LDL is 100% of its interval width above the top; ferritin is 0.8% below.
    expect(concerns.map((c) => c.marker)).toEqual(["ldl_c", "ferritin", "alt"]);
  });

  it("leaves in-range and optimal results out of concerns", () => {
    expect(panelSummary(results).concerns.some((c) => c.marker === "hs_crp")).toBe(false);
  });

  it("measures distance outside as a share of the interval width", () => {
    expect(pctOutsideRange(4.8, 1.2, 3.0)).toBe(100);
    expect(pctOutsideRange(2.0, 1.2, 3.0)).toBe(0);
    expect(pctOutsideRange(5, null, null)).toBe(0);
  });
});

describe("recheck intervals", () => {
  it("brings an out-of-range marker back sooner than an in-range one", () => {
    expect(recheckDueDays(def("ferritin"), "low")).toBe(RECHECK_DAYS.outOfRange);
    expect(recheckDueDays(def("ferritin"), "borderline-low")).toBe(RECHECK_DAYS.borderline);
    expect(recheckDueDays(def("ferritin"), "optimal")).toBe(RECHECK_DAYS.routine);
    expect(RECHECK_DAYS.outOfRange).toBeLessThan(RECHECK_DAYS.borderline);
    expect(RECHECK_DAYS.borderline).toBeLessThan(RECHECK_DAYS.routine);
  });

  it("pulls acute-phase markers in faster still", () => {
    expect(recheckDueDays(def("hs_crp"), "high")).toBe(RECHECK_DAYS.outOfRangeInflammation);
  });

  it("falls back to routine for an unknown marker", () => {
    expect(recheckDueDays(null, "high")).toBe(RECHECK_DAYS.routine);
  });

  it("counts overdue days from the due date", () => {
    const due = recheckDue("2026-01-01", 90, "2026-05-01");
    expect(due.dueDate).toBe("2026-04-01");
    expect(due.overdueDays).toBe(30);
    expect(due.due).toBe(true);
  });

  it("never reports negative overdue days", () => {
    const due = recheckDue("2026-08-01", 90, "2026-08-13");
    expect(due.overdueDays).toBe(0);
    expect(due.due).toBe(false);
  });
});

describe("convertUnit", () => {
  it("converts glucose both ways", () => {
    expect(convertUnit("glucose_fasting", 5.4, "mmol/L", "mg/dL")).toBe(
      Math.round(5.4 * GLUCOSE_FACTOR * 100) / 100,
    );
    expect(convertUnit("glucose_fasting", 97, "mg/dL", "mmol/L")).toBe(
      Math.round((97 / GLUCOSE_FACTOR) * 100) / 100,
    );
  });

  it("converts cholesterol fractions both ways", () => {
    expect(convertUnit("ldl_c", 2.7, "mmol/L", "mg/dL")).toBe(
      Math.round(2.7 * CHOLESTEROL_FACTOR * 100) / 100,
    );
    expect(convertUnit("hdl_c", 50, "mg/dl", "mmol/l")).toBe(
      Math.round((50 / CHOLESTEROL_FACTOR) * 100) / 100,
    );
  });

  it("refuses to guess the pairs it does not know", () => {
    // Triglycerides use 88.57, not the cholesterol factor — silence beats a wrong number.
    expect(convertUnit("triglycerides", 1.7, "mmol/L", "mg/dL")).toBeNull();
    expect(convertUnit("ferritin", 40, "ug/L", "ng/mL")).toBeNull();
    expect(convertUnit("not_a_marker", 1, "mmol/L", "mg/dL")).toBeNull();
    expect(convertUnit("glucose_fasting", Number.NaN, "mmol/L", "mg/dL")).toBeNull();
  });

  it("passes a same-unit conversion straight through", () => {
    expect(convertUnit("ldl_c", 2.735, "mmol/L", "mmol/L")).toBe(2.74);
  });
});

describe("labs fixtures", () => {
  it("gives Liam three panels and Conor one", () => {
    expect(FX.labPanels.filter((p) => p.userSlug === "liam")).toHaveLength(3);
    expect(FX.labPanels.filter((p) => p.userSlug === "conor")).toHaveLength(1);
  });

  it("only ever records markers the catalogue knows", () => {
    for (const r of FX.labResults) expect(isKnownMarker(r.marker), r.marker).toBe(true);
  });

  it("stamps each result with the unit and interval of its marker", () => {
    for (const r of FX.labResults) {
      const m = def(r.marker);
      expect(r.unit, r.marker).toBe(m.unit);
      expect(r.refLow, r.marker).toBe(m.refLow);
      expect(r.refHigh, r.marker).toBe(m.refHigh);
    }
  });

  it("attaches every result to a panel of the same user and date", () => {
    for (const r of FX.labResults) {
      const panel = FX.labPanels.find((p) => p.id === r.panelId);
      expect(panel, r.panelId).toBeDefined();
      expect(panel?.userSlug).toBe(r.userSlug);
      expect(panel?.date).toBe(r.date);
    }
  });
});

describe("buildLabsView — cut", () => {
  const view = viewFor("liam", "cut");

  it("returns the panels newest first", () => {
    expect(view.panels.map((p) => p.name)).toEqual([
      "Cut checkpoint",
      "Mid-cut recheck",
      "Full baseline",
    ]);
    expect(view.panels[0].date).toBe(addDays(TODAY, -10));
    expect(view.panels[0].fasted).toBe(true);
    expect(view.panels[0].lab).toBe("Randox Health");
  });

  it("keeps one row per marker in latestByMarker, newest draw winning", () => {
    const keys = view.latestByMarker.map((r) => r.marker);
    expect(new Set(keys).size).toBe(keys.length);
    const ldl = view.latestByMarker.find((r) => r.marker === "ldl_c");
    expect(ldl?.value).toBe(2.7);
    expect(ldl?.date).toBe(addDays(TODAY, -10));
  });

  it("surfaces the markers genuinely outside the interval", () => {
    const out = view.outOfRange.map((r) => r.marker);
    expect(out).toContain("ferritin");
    expect(out).toContain("transferrin_sat");
    expect(out).toContain("vitamin_d");
    expect(view.outOfRange.every((r) => isOutOfRange(r.flag))).toBe(true);
    expect(view.outOfRange.length).toBeGreaterThanOrEqual(2);
  });

  it("puts the worst result first in every list", () => {
    const severities = view.latestByMarker.map((r) => severityOf(r.flag));
    expect(severities).toEqual([...severities].sort((a, b) => b - a));
  });

  it("groups markers under their catalogue group only when present", () => {
    const groups = view.byGroup.map((g) => g.group);
    expect(groups).toContain("lipids");
    expect(new Set(groups).size).toBe(groups.length);
    for (const g of view.byGroup) {
      expect(g.markers.length).toBeGreaterThan(0);
      for (const m of g.markers) expect(def(m.marker).group).toBe(g.group);
    }
  });

  it("carries the delta against the previous draw", () => {
    const ldl = view.latestByMarker.find((r) => r.marker === "ldl_c");
    expect(ldl?.delta?.change).toBe(-0.5);
    expect(ldl?.delta?.direction).toBe("down");
    expect(ldl?.delta?.sinceDate).toBe(addDays(TODAY, -90));
    // Nothing to compare a first-ever draw against.
    const homocysteine = view.latestByMarker.find((r) => r.marker === "homocysteine");
    expect(homocysteine?.delta).toBeNull();
  });

  it("tells the cut's story in the trends", () => {
    const ldl = view.trends.find((t) => t.marker === "ldl_c");
    expect(ldl?.points.map((p) => p.value)).toEqual([3.6, 3.2, 2.7]);
    const crp = view.trends.find((t) => t.marker === "hs_crp");
    expect(crp?.points.map((p) => p.value)).toEqual([3.8, 1.9, 0.8]);
    expect(view.trends.every((t) => t.points.length >= 2)).toBe(true);
    expect(view.trends.every((t) => t.points.length <= MAX_TREND_POINTS)).toBe(true);
  });

  it("lists the draws that are actually overdue, worst first", () => {
    const markers = view.dueRechecks.map((r) => r.marker);
    expect(markers).toContain("homocysteine");
    expect(markers).toContain("egfr");
    for (const r of view.dueRechecks) {
      expect(r.overdueDays).toBeGreaterThan(0);
      expect(r.dueDate < TODAY).toBe(true);
    }
    const overdue = view.dueRechecks.map((r) => r.overdueDays);
    expect(overdue).toEqual([...overdue].sort((a, b) => b - a));
  });

  it("offers the panel templates to the add-panel form", () => {
    expect(view.templates.length).toBe(PANEL_TEMPLATES.length);
    const lipid = view.templates.find((t) => t.key === "lipid");
    expect(lipid?.markers.some((m) => m.key === "apob" && m.unit === "g/L")).toBe(true);
  });

  it("ignores panels drawn after the date being viewed", () => {
    const earlier = viewFor("liam", "cut", addDays(TODAY, -80));
    expect(earlier.panels.map((p) => p.name)).toEqual(["Mid-cut recheck", "Full baseline"]);
    expect(earlier.latestByMarker.find((r) => r.marker === "ldl_c")?.value).toBe(3.2);
  });
});

describe("buildLabsView — survival is a floor", () => {
  const view = viewFor("conor", "survival");

  it("keeps what is already owed", () => {
    expect(view.survival).toBe(true);
    const out = view.outOfRange.map((r) => r.marker);
    expect(out).toContain("hs_crp");
    expect(out).toContain("vitamin_d");
  });

  it("withholds every browsing surface so the floor adds no obligation", () => {
    expect(view.panels).toEqual([]);
    expect(view.latestByMarker).toEqual([]);
    expect(view.byGroup).toEqual([]);
    expect(view.trends).toEqual([]);
    expect(view.templates).toEqual([]);
  });

  it("shows the same markers as out of range whatever the mode", () => {
    const cutView = viewFor("conor", "cut");
    expect(cutView.outOfRange.map((r) => r.marker)).toEqual(view.outOfRange.map((r) => r.marker));
    expect(cutView.panels.length).toBe(1);
  });
});

describe("buildLabsView — empty and unknown", () => {
  it("returns empty lists rather than throwing when there are no panels", () => {
    const view = buildLabsView({ mode: "cut", date: TODAY, panels: [], results: [] });
    expect(view.panels).toEqual([]);
    expect(view.latestByMarker).toEqual([]);
    expect(view.outOfRange).toEqual([]);
    expect(view.dueRechecks).toEqual([]);
    expect(view.templates.length).toBeGreaterThan(0);
  });

  it("records a marker outside the catalogue without inventing an interval", () => {
    const view = buildLabsView({
      mode: "cut",
      date: TODAY,
      panels: [{ id: "p1", date: addDays(TODAY, -1), name: "One-off" }],
      results: [
        { panelId: "p1", date: addDays(TODAY, -1), marker: "mystery_assay", value: 7, unit: "au" },
      ],
    });
    const row = view.latestByMarker[0];
    expect(row.name).toBe("mystery_assay");
    expect(row.flag).toBe("in-range");
    expect(row.refLow).toBeNull();
    expect(row.movedBy).toEqual([]);
    expect(view.byGroup).toEqual([]);
  });

  it("prefers the interval the lab printed over the catalogue default", () => {
    const view = buildLabsView({
      mode: "cut",
      date: TODAY,
      panels: [{ id: "p1", date: addDays(TODAY, -1), name: "Other lab" }],
      // This lab prints a narrower ferritin floor: 27 reads as merely close to it,
    // where the catalogue interval (30–400) would have called it low.
      results: [
        {
          panelId: "p1",
          date: addDays(TODAY, -1),
          marker: "ferritin",
          value: 27,
          unit: "ug/L",
          refLow: 20,
          refHigh: 300,
        },
      ],
    });
    expect(view.latestByMarker[0].refLow).toBe(20);
    expect(view.latestByMarker[0].refHigh).toBe(300);
    expect(view.latestByMarker[0].flag).toBe("borderline-low");
    expect(flagFor(def("ferritin"), 27)).toBe("low");
  });
});
