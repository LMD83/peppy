import { describe, expect, it } from "vitest";
import {
  CONFIRM_ESCAPE,
  CONFIRM_CHOICE_LIMIT,
  EASY_CHOICE_LIMIT,
  MAX_CAPTURES_PER_DAY,
  MAX_NOTE_LEN,
  buildCaptureView,
  canSaveCapture,
  captureKindLabel,
  captureKinds,
  captureLabel,
  captureSummary,
  confirmChoicesFor,
  doseChoices,
  groupByDate,
  isCaptureKind,
  mealChoices,
  noteForChoice,
  normaliseCaptureNote,
  retentionNote,
  type CaptureRow,
  type ConfirmFood,
  type ConfirmItem,
} from "../convex/tm/logicCapture";
import { SCOPES, isScope } from "../convex/tm/logicConsent";
import type { StackItem } from "../convex/tm/logicStack";
import { addDays } from "../convex/tm/lib";

const TODAY = "2026-08-13"; // Thursday

function item(over: Partial<StackItem> = {}): StackItem {
  return {
    id: "i1",
    name: "Metformin",
    kind: "med",
    dose: 500,
    unit: "mg",
    route: "oral",
    timings: ["pm"],
    scheduleType: "daily",
    startDate: addDays(TODAY, -60),
    withFood: true,
    evidence: "strong",
    cautions: [],
    active: true,
    ...over,
  };
}

function capture(over: Partial<CaptureRow> = {}): CaptureRow {
  return {
    id: "c1",
    date: TODAY,
    kind: "organiser",
    url: "blob:one",
    note: null,
    at: 1_000,
    ...over,
  };
}

/* ===== kinds: three plain words, and nothing the app inferred ===== */

describe("captureKinds", () => {
  it("offers exactly the three things worth photographing, in plain words", () => {
    expect(captureKinds().map((k) => k.label)).toEqual(["Pill organiser", "A meal", "A dose"]);
  });

  it("labels a stored row by kind without reading anything", () => {
    expect(captureKindLabel("dose")).toBe("A dose");
    expect(isCaptureKind("dose")).toBe(true);
    expect(isCaptureKind("prescription")).toBe(false);
  });
});

/* ===== grouping ===== */

describe("groupByDate", () => {
  it("puts the newest day first and the newest photo first inside a day", () => {
    const rows = [
      capture({ id: "a", date: "2026-08-11", at: 5 }),
      capture({ id: "b", date: TODAY, at: 10 }),
      capture({ id: "c", date: TODAY, at: 90 }),
    ];
    const days = groupByDate(rows);
    expect(days.map((d) => d.date)).toEqual([TODAY, "2026-08-11"]);
    expect(days[0].captures.map((c) => c.id)).toEqual(["c", "b"]);
  });

  it("is stable when two photos share a timestamp", () => {
    const rows = [capture({ id: "z", at: 5 }), capture({ id: "a", at: 5 })];
    expect(groupByDate(rows)[0].captures.map((c) => c.id)).toEqual(["a", "z"]);
  });

  it("returns nothing for nothing", () => {
    expect(groupByDate([])).toEqual([]);
  });
});

/* ===== the confirm list: only ever the user's own configured things ===== */

describe("doseChoices", () => {
  it("flattens the user's own schedule one row per timing, in order of the day", () => {
    const rows = doseChoices([item({ timings: ["pm", "am"] })], TODAY);
    expect(rows.map((r) => r.timing)).toEqual(["am", "pm"]);
    expect(rows.every((r) => r.name === "Metformin")).toBe(true);
  });

  it("never offers a paused item — a pause is not an obligation", () => {
    expect(doseChoices([item({ active: false })], TODAY)).toEqual([]);
  });

  it("defers to the schedule the stack tab uses, not an assumed daily dose", () => {
    const weekdayOnly = item({ scheduleType: "weekdays", weekdays: [1, 2, 3, 4, 5] });
    expect(doseChoices([weekdayOnly], "2026-08-15")).toEqual([]); // Saturday
    expect(doseChoices([weekdayOnly], TODAY)).toHaveLength(1); // Thursday
  });
});

describe("confirmChoicesFor", () => {
  const items: ConfirmItem[] = [
    { id: "i1:am", name: "Metformin", timing: "am" },
    { id: "i2:pm", name: "Atorvastatin", timing: "pm" },
    { id: "i3:pre-bed", name: "Magnesium", timing: "pre-bed" },
    { id: "i4:pm", name: "Creatine", timing: "pm" },
  ];
  const foods: ConfirmFood[] = [
    { id: "m1", name: "Porridge", slot: "breakfast" },
    { id: "m2", name: "Chicken and rice", slot: "lunch" },
  ];

  it("names a dose the way the user would say it, from their own stack", () => {
    const choices = confirmChoicesFor("dose", items, foods);
    expect(choices[0].label).toBe("Metformin — Morning");
    expect(choices[1].label).toBe("Atorvastatin — Evening");
  });

  it("keeps the list to three — a fourth answer is a menu", () => {
    expect(confirmChoicesFor("dose", items, foods)).toHaveLength(CONFIRM_CHOICE_LIMIT);
    expect(confirmChoicesFor("dose", items, foods, EASY_CHOICE_LIMIT)).toHaveLength(
      EASY_CHOICE_LIMIT,
    );
  });

  it("draws meals out of the plan that already exists", () => {
    expect(confirmChoicesFor("meal", items, foods).map((c) => c.label)).toEqual([
      "Breakfast — Porridge",
      "Lunch — Chicken and rice",
    ]);
  });

  it("offers an organiser only the times of day the user configured", () => {
    const choices = confirmChoicesFor("organiser", items, foods);
    expect(choices.map((c) => c.label)).toEqual(["Morning", "Evening", "Pre-bed"]);
    expect(choices[1].detail).toBe("2 things at this time");
  });

  it("invents nothing when there is nothing configured", () => {
    expect(confirmChoicesFor("dose", [], [])).toEqual([]);
    expect(confirmChoicesFor("meal", [], [])).toEqual([]);
    expect(confirmChoicesFor("organiser", [], [])).toEqual([]);
  });

  it("only ever returns labels built from the inputs it was handed", () => {
    const names = new Set([...items.map((i) => i.name), ...foods.map((f) => f.name)]);
    for (const kind of ["dose", "meal"] as const) {
      for (const choice of confirmChoicesFor(kind, items, foods)) {
        expect([...names].some((n) => choice.label.includes(n))).toBe(true);
      }
    }
  });

  it("sorts meals into the order the day actually runs", () => {
    const scrambled = mealChoices([
      { id: "m3", name: "Steak", slot: "dinner" },
      { id: "m1", name: "Porridge", slot: "breakfast" },
    ]);
    expect(scrambled.map((f) => f.slot)).toEqual(["breakfast", "dinner"]);
  });
});

/* ===== the note is the user's word, never the app's ===== */

describe("noteForChoice", () => {
  it("stamps the label as the user's own confirmation", () => {
    expect(noteForChoice({ id: "i1:am", label: "Metformin — Morning", detail: null })).toBe(
      "You confirmed: Metformin — Morning",
    );
  });

  it("stores no label at all when the user says it was something else", () => {
    expect(noteForChoice(CONFIRM_ESCAPE)).toBeUndefined();
  });

  it("trims and bounds a note, and treats an empty one as absent", () => {
    expect(normaliseCaptureNote("  hi  ")).toBe("hi");
    expect(normaliseCaptureNote("   ")).toBeUndefined();
    expect(normaliseCaptureNote(undefined)).toBeUndefined();
    expect(normaliseCaptureNote("x".repeat(500))).toHaveLength(MAX_NOTE_LEN);
  });

  it("says so plainly when a photo carries no label", () => {
    expect(captureLabel(capture({ kind: "dose" }))).toBe("A dose — not labelled");
    expect(captureLabel(capture({ note: "You confirmed: Lunch — Porridge" }))).toBe(
      "You confirmed: Lunch — Porridge",
    );
  });
});

/* ===== the Today card says nothing unless there is something to say ===== */

describe("captureSummary", () => {
  it("shows nothing when no photo was taken today", () => {
    expect(captureSummary([], TODAY).show).toBe(false);
    expect(captureSummary([capture({ date: "2026-08-11" })], TODAY).show).toBe(false);
  });

  it("counts today's photos and names the latest one", () => {
    const s = captureSummary(
      [capture({ id: "a", at: 1 }), capture({ id: "b", at: 2, note: "You confirmed: Lunch" })],
      TODAY,
    );
    expect(s.show).toBe(true);
    expect(s.todayCount).toBe(2);
    expect(s.line).toBe("2 photos saved today.");
    expect(s.detail).toBe("You confirmed: Lunch");
  });

  it("never speaks in the floor — capture is an aid, not another obligation", () => {
    const s = captureSummary([capture()], TODAY, true);
    expect(s.show).toBe(false);
    expect(s.line).toBe("");
  });
});

/* ===== retention, in words ===== */

describe("retentionNote", () => {
  it("says where a photo lives, that it is never shared, and how it goes", () => {
    const note = retentionNote();
    expect(note.where).toMatch(/stored/i);
    expect(note.sharing).toMatch(/never/i);
    expect(note.deleting).toMatch(/immediately/i);
    expect(note.care).toMatch(/name|address/i);
    expect(note.lines).toHaveLength(4);
  });
});

/* ===== the day's limit ===== */

describe("canSaveCapture", () => {
  it("stops at a day's worth of evidence rather than a camera roll", () => {
    expect(canSaveCapture(MAX_CAPTURES_PER_DAY - 1)).toBe(true);
    expect(canSaveCapture(MAX_CAPTURES_PER_DAY)).toBe(false);
  });
});

/* ===== the view both backends build ===== */

describe("buildCaptureView", () => {
  const items = doseChoices([item(), item({ id: "i2", name: "Vitamin D", timings: ["am"] })], TODAY);
  const foods: ConfirmFood[] = [{ id: "m1", name: "Porridge", slot: "breakfast" }];

  it("offers all three kinds and a confirm list for each", () => {
    const v = buildCaptureView({ mode: "cut", date: TODAY, captures: [], items, foods });
    expect(v.kinds).toHaveLength(3);
    expect(v.choices.dose.length).toBeGreaterThan(0);
    expect(v.choices.meal).toHaveLength(1);
    expect(v.escape).toEqual(CONFIRM_ESCAPE);
    expect(v.atLimit).toBe(false);
  });

  it("splits today from the rest without losing a day", () => {
    const v = buildCaptureView({
      mode: "cut",
      date: TODAY,
      captures: [capture({ id: "a" }), capture({ id: "b", date: "2026-08-10", at: 2 })],
      items,
      foods,
    });
    expect(v.today.map((c) => c.id)).toEqual(["a"]);
    expect(v.days.map((d) => d.date)).toEqual([TODAY, "2026-08-10"]);
    expect(v.date).toBe(TODAY);
  });

  it("keeps capture available in the floor but silent on Today", () => {
    const v = buildCaptureView({
      mode: "survival",
      date: TODAY,
      captures: [capture()],
      items,
      foods,
    });
    expect(v.survival).toBe(true);
    expect(v.kinds.length).toBeGreaterThan(0); // available
    expect(v.summary.show).toBe(false); // never prompted
  });

  it("easy mode shows fewer objects, not smaller ones", () => {
    const v = buildCaptureView({
      mode: "cut",
      date: TODAY,
      captures: [],
      items,
      foods,
      a11y: "easy",
    });
    expect(v.easy).toBe(true);
    expect(v.kinds).toHaveLength(1);
    expect(v.kinds[0].label).toBe("Pill organiser");
    expect(v.choices.dose.length).toBeLessThanOrEqual(EASY_CHOICE_LIMIT);
  });

  it("stops offering the camera once the day is full", () => {
    const full = Array.from({ length: MAX_CAPTURES_PER_DAY }, (_, i) =>
      capture({ id: `c${i}`, at: i }),
    );
    expect(buildCaptureView({ mode: "cut", date: TODAY, captures: full, items, foods }).atLimit).toBe(
      true,
    );
  });

  it("is a pure function of its input — same input, same view", () => {
    const input = { mode: "cut" as const, date: TODAY, captures: [capture()], items, foods };
    expect(buildCaptureView(input)).toEqual(buildCaptureView(input));
  });

  it("carries the words that matter and no inference of any kind", () => {
    const v = buildCaptureView({ mode: "cut", date: TODAY, captures: [capture()], items, foods });
    expect(v.note).toMatch(/never reads a photo/i);
    expect(v.neverShared).toMatch(/never part of a crew or carer view/i);
    // Nothing in the view claims to know what is in a picture.
    expect(JSON.stringify(v)).not.toMatch(/identif(y|ied|ication) as|looks like|probably/i);
  });
});

/* ===== the privacy proof: there is no way to share a photo ===== */

describe("captures are outside the consent surface", () => {
  it("has no crew or carer scope, so no projection can ever carry one", () => {
    expect([...SCOPES]).toEqual(["adherence", "mode", "supply"]);
    for (const word of ["capture", "captures", "photo", "photos", "image"]) {
      expect(isScope(word)).toBe(false);
    }
  });

  it("keeps every photo url inside the owner's own view", () => {
    const v = buildCaptureView({
      mode: "cut",
      date: TODAY,
      captures: [capture({ url: "blob:mine" })],
      items: [],
      foods: [],
    });
    // The only urls in the view are the rows the caller handed in themselves.
    const urls = v.days.flatMap((d) => d.captures.map((c) => c.url));
    expect(urls).toEqual(["blob:mine"]);
  });
});
