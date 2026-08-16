import { describe, expect, it } from "vitest";
import {
  DEFAULT_HORIZON_DAYS,
  EXPIRY_WARN_DAYS,
  ROUTE_NOTE,
  buildRefillMessage,
  buildSupplyView,
  countAfterDays,
  dosesPerDay,
  projectRunOut,
  refillRoute,
  runOutStatus,
  schedulePeriodDays,
  scriptStatus,
  sortByUrgency,
  unitsOn,
  unitsPerDay,
  type SupplyItemView,
  type SupplyRow,
} from "../convex/tm/logicSupply";
import type { StackItem } from "../convex/tm/logicStack";
import { buildStackFixtures } from "../convex/tm/fixtures/stack";
import { buildSupplyFixtures } from "../convex/tm/fixtures/supply";
import { addDays } from "../convex/tm/lib";

const TODAY = "2026-08-13"; // Thursday

function item(over: Partial<StackItem> = {}): StackItem {
  return {
    id: "i1",
    name: "Atorvastatin",
    kind: "med",
    dose: 10,
    unit: "mg",
    route: "oral",
    timings: ["pre-bed"],
    scheduleType: "daily",
    startDate: addDays(TODAY, -60),
    withFood: false,
    evidence: "strong",
    cautions: [],
    active: true,
    ...over,
  };
}

function supply(over: Partial<SupplyRow> = {}): SupplyRow {
  return {
    itemId: "i1",
    onHand: 30,
    unitsPerDose: 1,
    packSize: 28,
    lastCountedDate: TODAY,
    reorderLeadDays: 5,
    ...over,
  };
}

/* ===== consumption: the schedule decides, never an assumed one-a-day ===== */

describe("dosesPerDay", () => {
  it("counts a daily item as one dose a day, and two timings as two", () => {
    expect(dosesPerDay(item(), TODAY)).toBe(1);
    expect(dosesPerDay(item({ timings: ["am", "pre-bed"] }), TODAY)).toBe(2);
  });

  it("counts a weekdays item over its own seven-day period", () => {
    const weekdays = item({ scheduleType: "weekdays", weekdays: [1, 2, 3, 4, 5] });
    expect(schedulePeriodDays(weekdays)).toBe(7);
    expect(dosesPerDay(weekdays, TODAY)).toBeCloseTo(5 / 7, 10);
  });

  it("counts an every-three-days item as a third of a dose a day", () => {
    const interval = item({ scheduleType: "interval", intervalDays: 3, startDate: TODAY });
    expect(schedulePeriodDays(interval)).toBe(3);
    expect(dosesPerDay(interval, TODAY)).toBeCloseTo(1 / 3, 10);
  });

  it("averages a 5-on/2-off cycle over the whole 49-day period", () => {
    const cycled = item({
      scheduleType: "cycle",
      cycleOnWeeks: 5,
      cycleOffWeeks: 2,
      startDate: TODAY,
    });
    expect(schedulePeriodDays(cycled)).toBe(49);
    expect(dosesPerDay(cycled, TODAY)).toBeCloseTo(35 / 49, 10);
  });

  it("orders consumption daily > cycled > every-three-days", () => {
    const daily = dosesPerDay(item(), TODAY);
    const cycled = dosesPerDay(
      item({ scheduleType: "cycle", cycleOnWeeks: 5, cycleOffWeeks: 2, startDate: TODAY }),
      TODAY,
    );
    const interval = dosesPerDay(
      item({ scheduleType: "interval", intervalDays: 3, startDate: TODAY }),
      TODAY,
    );
    expect(daily).toBeGreaterThan(cycled);
    expect(cycled).toBeGreaterThan(interval);
  });

  it("is zero for a paused item, an ended item and an item with no timings", () => {
    expect(dosesPerDay(item({ active: false }), TODAY)).toBe(0);
    expect(dosesPerDay(item({ endDate: addDays(TODAY, -1) }), TODAY)).toBe(0);
    expect(dosesPerDay(item({ timings: [] }), TODAY)).toBe(0);
  });

  it("scales into units by the units each dose takes out of the box", () => {
    expect(unitsPerDay(item(), supply({ unitsPerDose: 2 }), TODAY)).toBe(2);
    expect(unitsOn(item(), supply({ unitsPerDose: 2 }), TODAY)).toBe(2);
    expect(unitsOn(item({ active: false }), supply({ unitsPerDose: 2 }), TODAY)).toBe(0);
  });
});

/* ===== a stale count, projected forward ===== */

describe("countAfterDays", () => {
  it("counted 24 on the Monday, about 19 by the Saturday", () => {
    const monday = "2026-08-10";
    const saturday = "2026-08-15";
    const stale = supply({ onHand: 24, lastCountedDate: monday });
    expect(countAfterDays(item(), stale, saturday)).toBe(19);
  });

  it("leaves a count taken today alone", () => {
    expect(countAfterDays(item(), supply({ onHand: 24, lastCountedDate: TODAY }), TODAY)).toBe(24);
  });

  it("never projects below zero, however stale the count", () => {
    const ancient = supply({ onHand: 4, lastCountedDate: addDays(TODAY, -40) });
    expect(countAfterDays(item(), ancient, TODAY)).toBe(0);
  });

  it("only subtracts on days the schedule actually falls", () => {
    const cycled = item({
      scheduleType: "cycle",
      cycleOnWeeks: 5,
      cycleOffWeeks: 2,
      // 38 days in: three days into the off phase.
      startDate: addDays(TODAY, -38),
    });
    const counted = supply({ onHand: 20, lastCountedDate: addDays(TODAY, -5) });
    // Of the five days since the count, only one fell inside the on phase.
    expect(countAfterDays(cycled, counted, TODAY)).toBe(19);
  });
});

/* ===== the projection ===== */

describe("projectRunOut", () => {
  it("names the run-out date and backs the order-by date off by the lead", () => {
    const run = projectRunOut(item(), supply({ onHand: 10, reorderLeadDays: 5 }), TODAY);
    expect(run.daysRemaining).toBe(11);
    expect(run.runOutDate).toBe(addDays(TODAY, 11));
    expect(run.orderByDate).toBe(addDays(TODAY, 6));
    expect(run.status).toBe("ok");
  });

  it("flips to order-now on the day the order-by date is reached, not before", () => {
    // Six units, one a day: covers today+1..today+6, fails on today+7.
    const before = projectRunOut(item(), supply({ onHand: 6, reorderLeadDays: 5 }), TODAY);
    expect(before.orderByDate).toBe(addDays(TODAY, 2));
    expect(before.status).toBe("ok");

    const crossing = projectRunOut(item(), supply({ onHand: 4, reorderLeadDays: 5 }), TODAY);
    expect(crossing.daysRemaining).toBe(5);
    expect(crossing.orderByDate).toBe(TODAY);
    expect(crossing.status).toBe("order-now");
  });

  it("escalates to urgent inside half the lead time and to out at zero", () => {
    expect(projectRunOut(item(), supply({ onHand: 2, reorderLeadDays: 6 }), TODAY).status).toBe(
      "urgent",
    );
    const out = projectRunOut(item(), supply({ onHand: 0, reorderLeadDays: 6 }), TODAY);
    expect(out.status).toBe("out");
    expect(out.daysRemaining).toBe(0);
    expect(out.runOutDate).toBe(TODAY);
  });

  it("stretches the same stock further on a cycled schedule than a daily one", () => {
    // Enough stock to reach the first off-week, where the schedules diverge.
    const stock = supply({ onHand: 40, reorderLeadDays: 5 });
    const daily = projectRunOut(item(), stock, TODAY);
    const cycled = projectRunOut(
      item({ scheduleType: "cycle", cycleOnWeeks: 5, cycleOffWeeks: 2, startDate: TODAY }),
      stock,
      TODAY,
    );
    const interval = projectRunOut(
      item({ scheduleType: "interval", intervalDays: 3, startDate: TODAY }),
      stock,
      TODAY,
    );
    expect(daily.daysRemaining).toBe(41);
    expect(cycled.daysRemaining).toBeGreaterThan(daily.daysRemaining);
    expect(interval.daysRemaining).toBeGreaterThan(cycled.daysRemaining);
  });

  it("consumes nothing while a cycle is off, and resumes when it switches back on", () => {
    const offNow = item({
      scheduleType: "cycle",
      cycleOnWeeks: 5,
      cycleOffWeeks: 2,
      startDate: addDays(TODAY, -38),
    });
    const run = projectRunOut(offNow, supply({ onHand: 10 }), TODAY);
    // Eleven quiet days, then ten days of doses, then the eleventh finds nothing.
    expect(run.daysRemaining).toBe(21);
    expect(run.runOutDate).toBe(addDays(TODAY, 21));
  });

  it("reports no run-out at all for a paused item or a zero-consumption row", () => {
    const paused = projectRunOut(item({ active: false }), supply({ onHand: 3 }), TODAY);
    expect(paused.runOutDate).toBeNull();
    expect(paused.orderByDate).toBeNull();
    expect(paused.status).toBe("ok");

    const noUnits = projectRunOut(item(), supply({ onHand: 3, unitsPerDose: 0 }), TODAY);
    expect(noUnits.status).toBe("ok");
    expect(noUnits.runOutDate).toBeNull();
  });

  it("treats a negative or nonsense count as nothing in the house", () => {
    expect(projectRunOut(item(), supply({ onHand: -12 }), TODAY).status).toBe("out");
    expect(projectRunOut(item(), supply({ onHand: Number.NaN }), TODAY).status).toBe("out");
    expect(projectRunOut(item(), supply({ onHand: -12 }), TODAY).onHand).toBe(0);
  });

  it("survives a nonsense lead time by treating it as none", () => {
    const run = projectRunOut(item(), supply({ onHand: 10, reorderLeadDays: -4 }), TODAY);
    expect(run.orderByDate).toBe(run.runOutDate);
    expect(run.status).toBe("ok");
  });

  it("stops at the horizon rather than walking forever", () => {
    const run = projectRunOut(item(), supply({ onHand: 10_000 }), TODAY, 30);
    expect(run.daysRemaining).toBe(30);
    expect(run.runOutDate).toBeNull();
    expect(run.status).toBe("ok");
  });

  it("ranks urgent above order-now for the same day count", () => {
    expect(runOutStatus(3, TODAY, addDays(TODAY, -2), 8)).toBe("urgent");
    expect(runOutStatus(6, TODAY, addDays(TODAY, -2), 8)).toBe("order-now");
    expect(runOutStatus(0, TODAY, TODAY, 8)).toBe("out");
  });
});

/* ===== the script: pharmacy call or doctor's appointment ===== */

describe("scriptStatus", () => {
  it("leaves a live script with repeats to the pharmacy", () => {
    const s = scriptStatus(
      supply({ repeatsRemaining: 2, scriptExpiryDate: addDays(TODAY, 120) }),
      TODAY,
    );
    expect(s.needsGp).toBe(false);
    expect(s.hasScript).toBe(true);
    expect(s.expiringSoon).toBe(false);
    expect(refillRoute("med", s)).toBe("pharmacy");
    expect(ROUTE_NOTE[refillRoute("med", s)]).toBe("The pharmacy can repeat this.");
  });

  it("sends an exhausted script to the doctor and says why", () => {
    const s = scriptStatus(
      supply({ repeatsRemaining: 0, scriptExpiryDate: addDays(TODAY, 40) }),
      TODAY,
    );
    expect(s.needsGp).toBe(true);
    expect(s.gpReason).toBe("no repeats left on the script");
    expect(refillRoute("med", s)).toBe("gp");
  });

  it("sends an expired script to the doctor even with repeats printed on it", () => {
    const expiry = addDays(TODAY, -3);
    const s = scriptStatus(supply({ repeatsRemaining: 2, scriptExpiryDate: expiry }), TODAY);
    expect(s.expired).toBe(true);
    expect(s.needsGp).toBe(true);
    expect(s.gpReason).toContain(expiry);
  });

  it("flags a script expiring soon without pretending it is already dead", () => {
    const s = scriptStatus(
      supply({ repeatsRemaining: 3, scriptExpiryDate: addDays(TODAY, EXPIRY_WARN_DAYS - 1) }),
      TODAY,
    );
    expect(s.expiringSoon).toBe(true);
    expect(s.expired).toBe(false);
    expect(s.needsGp).toBe(false);
  });

  it("has no script at all for something bought off a shelf", () => {
    const s = scriptStatus(supply(), TODAY);
    expect(s.hasScript).toBe(false);
    expect(s.needsGp).toBe(false);
    expect(s.repeatsRemaining).toBeNull();
    expect(refillRoute("supplement", s)).toBe("self");
  });
});

/* ===== ordering ===== */

describe("sortByUrgency", () => {
  it("puts out first, then urgent, then order-now, then soonest inside a tier", () => {
    const rows = [
      { name: "D", status: "ok" as const, daysRemaining: 40 },
      { name: "B", status: "order-now" as const, daysRemaining: 6 },
      { name: "A", status: "out" as const, daysRemaining: 0 },
      { name: "C", status: "order-now" as const, daysRemaining: 4 },
      { name: "E", status: "urgent" as const, daysRemaining: 2 },
    ];
    expect(sortByUrgency(rows).map((r) => r.name)).toEqual(["A", "E", "C", "B", "D"]);
  });

  it("does not mutate the array it was given", () => {
    const rows = [
      { name: "B", status: "ok" as const, daysRemaining: 40 },
      { name: "A", status: "out" as const, daysRemaining: 0 },
    ];
    sortByUrgency(rows);
    expect(rows.map((r) => r.name)).toEqual(["B", "A"]);
  });
});

/* ===== the refill message ===== */

describe("buildRefillMessage", () => {
  const view = buildSupplyView({
    mode: "cut",
    date: TODAY,
    userName: "Liam",
    items: [
      item({ id: "med1", name: "Atorvastatin", kind: "med" }),
      item({ id: "sup1", name: "Magnesium glycinate", kind: "supplement", dose: 400 }),
    ],
    supply: [
      supply({ itemId: "med1", onHand: 3, repeatsRemaining: 0 }),
      supply({ itemId: "sup1", onHand: 4 }),
    ],
    contacts: [],
  });

  it("names the person, the item, the dose and how long is left", () => {
    expect(view.refillMessage).toContain("Hello, this is Liam.");
    expect(view.refillMessage).toContain("Atorvastatin 10 mg");
    expect(view.refillMessage).toContain("about 4 days left");
    expect(view.refillMessage).toContain(`runs out ${addDays(TODAY, 4)}`);
  });

  it("separates what the practice has to do from what the shelf covers", () => {
    expect(view.refillMessage).toContain("These have no repeat left, so they need the practice:");
    expect(view.refillMessage).toContain("Also running low (no prescription):");
  });

  it("asks for nothing that is not already on the file", () => {
    const text = view.refillMessage.toLowerCase();
    for (const word of ["increase", "prescribe", "should", "recommend", "start", "stop"]) {
      expect(text).not.toContain(word);
    }
  });

  it("is empty when nothing needs ordering", () => {
    expect(buildRefillMessage("Liam", [])).toBe("");
  });
});

/* ===== the whole view ===== */

describe("buildSupplyView", () => {
  const base = {
    mode: "cut" as const,
    date: TODAY,
    userName: "Liam",
    contacts: [
      { id: "c1", kind: "gp" as const, name: "Rathgar Family Practice", phone: "01 497 8820", note: null },
      { id: "c2", kind: "pharmacy" as const, name: "Ashfield Pharmacy", phone: "01 496 3145", note: null },
    ],
  };

  it("drops a paused item entirely — a pause is not a reorder", () => {
    const view = buildSupplyView({
      ...base,
      items: [item({ id: "i1", active: false })],
      supply: [supply({ itemId: "i1", onHand: 0 })],
    });
    expect(view.items).toHaveLength(0);
    expect(view.attention).toHaveLength(0);
    expect(view.refillMessage).toBe("");
  });

  it("drops a supply row whose item is not on the file", () => {
    const view = buildSupplyView({ ...base, items: [], supply: [supply({ itemId: "ghost" })] });
    expect(view.items).toHaveLength(0);
  });

  it("splits attention from the quiet majority and surfaces both contacts", () => {
    const view = buildSupplyView({
      ...base,
      items: [item({ id: "a", name: "Atorvastatin" }), item({ id: "b", name: "Vitamin D3" })],
      supply: [supply({ itemId: "a", onHand: 3 }), supply({ itemId: "b", onHand: 80 })],
    });
    expect(view.attention.map((r) => r.name)).toEqual(["Atorvastatin"]);
    expect(view.okCount).toBe(1);
    expect(view.contacts.gp?.phone).toBe("01 497 8820");
    expect(view.contacts.pharmacy?.name).toBe("Ashfield Pharmacy");
  });

  it("writes a line a tired person can act on", () => {
    const view = buildSupplyView({
      ...base,
      items: [item({ id: "a", name: "Atorvastatin" })],
      supply: [supply({ itemId: "a", onHand: 4, reorderLeadDays: 5 })],
    });
    expect(view.attention[0].line).toBe(`Atorvastatin · 5 days left · order by ${TODAY}`);
  });

  it("collapses to the attention list at the floor, and nothing else", () => {
    const items = [item({ id: "a", name: "Atorvastatin" }), item({ id: "b", name: "Vitamin D3" })];
    const rows = [supply({ itemId: "a", onHand: 3 }), supply({ itemId: "b", onHand: 80 })];
    const floor = buildSupplyView({ ...base, mode: "survival", items, supply: rows });
    expect(floor.survival).toBe(true);
    expect(floor.items).toHaveLength(0);
    expect(floor.attention.map((r) => r.name)).toEqual(["Atorvastatin"]);
    // The one reassuring number survives; the inventory does not.
    expect(floor.okCount).toBe(1);
    // The action is still reachable at the floor.
    expect(floor.contacts.pharmacy).not.toBeNull();
    expect(floor.refillMessage).not.toBe("");
  });

  it("keeps the floor silent when nothing is running out", () => {
    const floor = buildSupplyView({
      ...base,
      mode: "survival",
      items: [item({ id: "b", name: "Vitamin D3" })],
      supply: [supply({ itemId: "b", onHand: 80 })],
    });
    expect(floor.attention).toHaveLength(0);
    expect(floor.refillMessage).toBe("");
  });

  it("carries a note that says what the numbers are and are not", () => {
    const view = buildSupplyView({ ...base, items: [], supply: [] });
    expect(view.note).toContain("Nothing here changes a prescription");
  });
});

/* ===== the fixtures tell the intended story ===== */

describe("fixtures", () => {
  const stack = buildStackFixtures(TODAY);
  const fx = buildSupplyFixtures(TODAY);

  const itemsFor = (slug: string): StackItem[] =>
    stack.protocolItems.filter((r) => r.userSlug === slug).map(({ userSlug: _s, ...row }) => row);
  const supplyFor = (slug: string): SupplyRow[] =>
    fx.supplyRows.filter((r) => r.userSlug === slug).map(({ id: _i, userSlug: _s, ...row }) => row);
  const contactsFor = (slug: string) =>
    fx.contacts
      .filter((r) => r.userSlug === slug)
      .map((r) => ({ id: r.id, kind: r.kind, name: r.name, phone: r.phone, note: r.note ?? null }));

  const liam = buildSupplyView({
    mode: "cut",
    date: TODAY,
    userName: "Liam",
    items: itemsFor("liam"),
    supply: supplyFor("liam"),
    contacts: contactsFor("liam"),
  });

  it("points every supply row at an item that exists", () => {
    const ids = new Set(stack.protocolItems.map((r) => r.id));
    for (const row of fx.supplyRows) expect(ids.has(row.itemId)).toBe(true);
  });

  const byName = (name: string): SupplyItemView => {
    const row = liam.items.find((r) => r.name.toLowerCase().startsWith(name));
    if (!row) throw new Error(`No supply row for ${name}`);
    return row;
  };

  it("has one item comfortably stocked", () => {
    const vitd = byName("vitamin d");
    expect(vitd.status).toBe("ok");
    expect(vitd.daysRemaining).toBeGreaterThan(60);
  });

  it("has one item crossing its order-by date today", () => {
    const mag = byName("magnesium");
    expect(mag.orderByDate).toBe(TODAY);
    expect(mag.status).toBe("order-now");
    expect(mag.daysRemaining).toBe(5);
    // Two capsules a night, not one — the per-dose count is doing real work.
    expect(mag.unitsPerDay).toBe(2);
    expect(mag.route).toBe("self");
  });

  it("has one prescription the pharmacy cannot help with", () => {
    const statin = byName("atorvastatin");
    expect(statin.repeatsRemaining).toBe(0);
    expect(statin.needsGp).toBe(true);
    expect(statin.route).toBe("gp");
    expect(statin.routeNote).toBe("This one needs the doctor.");
  });

  it("sorts the soonest run-out to the top of the attention list", () => {
    expect(liam.attention.map((r) => r.name.toLowerCase().slice(0, 4))).toEqual(["ator", "magn"]);
    expect(liam.okCount).toBe(2);
  });

  it("gives Liam a GP and a pharmacy to ring", () => {
    expect(liam.contacts.gp?.phone).toMatch(/^01 /);
    expect(liam.contacts.pharmacy?.phone).toMatch(/^01 /);
  });

  it("leaves Artur's floor silent — his med has plenty left", () => {
    const artur = buildSupplyView({
      mode: "survival",
      date: TODAY,
      userName: "Artur",
      items: itemsFor("artur"),
      supply: supplyFor("artur"),
      contacts: contactsFor("artur"),
    });
    expect(artur.attention).toHaveLength(0);
    expect(artur.items).toHaveLength(0);
    expect(artur.okCount).toBe(1);
    expect(artur.refillMessage).toBe("");
  });

  it("holds the story on any date the fixtures are built for", () => {
    for (const date of ["2026-01-01", "2026-02-28", "2027-11-30"]) {
      const s = buildStackFixtures(date);
      const f = buildSupplyFixtures(date);
      const view = buildSupplyView({
        mode: "cut",
        date,
        userName: "Liam",
        items: s.protocolItems
          .filter((r) => r.userSlug === "liam")
          .map(({ userSlug: _s, ...row }) => row),
        supply: f.supplyRows
          .filter((r) => r.userSlug === "liam")
          .map(({ id: _i, userSlug: _u, ...row }) => row),
        contacts: [],
      });
      expect(view.attention).toHaveLength(2);
      expect(view.attention.every((r) => r.daysRemaining <= DEFAULT_HORIZON_DAYS)).toBe(true);
    }
  });
});
