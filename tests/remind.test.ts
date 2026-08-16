import { describe, expect, it } from "vitest";
import {
  APP_TIMEZONE,
  ASSESSMENT_CADENCE_DAYS,
  CHECKIN_AT,
  DEFAULT_PREFS,
  MAX_CONSECUTIVE_FAILURES,
  MAX_PER_DAY,
  SUPPLY_AT,
  TIMING_AT,
  buildRemindView,
  checkinsFor,
  coalesce,
  copyFor,
  dueReminders,
  inQuietHours,
  localNow,
  minutesOf,
  normalisePrefs,
  planReminders,
  subscriptionView,
  survivalFilter,
  throttle,
  type DueCheckin,
  type DueDose,
  type DueSupply,
  type Now,
  type Reminder,
  type ReminderPrefs,
} from "../convex/tm/logicRemind";
import { MODE_CHECKS, daysBetween } from "../convex/tm/lib";
import { buildCaptureView } from "../convex/tm/logicCapture";

const DATE = "2026-08-13";

function prefs(over: Partial<ReminderPrefs> = {}): ReminderPrefs {
  return { ...DEFAULT_PREFS, enabled: true, ...over };
}

function dose(over: Partial<DueDose> = {}): DueDose {
  return { itemId: "i1", name: "Metformin", timing: "am", taken: false, ...over };
}

function supplyRow(over: Partial<DueSupply> = {}): DueSupply {
  return { itemId: "i1", name: "Metformin", status: "order-now", daysRemaining: 6, reorderLeadDays: 5, ...over };
}

function checkin(over: Partial<DueCheckin> = {}): DueCheckin {
  return { key: "protein", label: "Protein hit", done: false, at: CHECKIN_AT, ...over };
}

/** The whole day, which is what the tab previews. */
function wholeDay(): Now {
  return { date: DATE, time: "23:59", windowMinutes: 24 * 60 };
}

/* ===== nothing fires when it is switched off ===== */

describe("the off switch", () => {
  it("returns nothing at all when reminders are disabled", () => {
    const out = dueReminders(prefs({ enabled: false }), [dose()], [supplyRow()], [checkin()], wholeDay());
    expect(out).toEqual([]);
  });

  it("defaults to off — a permission nobody asked for is a permission denied", () => {
    expect(DEFAULT_PREFS.enabled).toBe(false);
  });
});

/* ===== rule 1: never remind about something already logged ===== */

describe("never remind about something already done", () => {
  it("says nothing about a dose that is already taken", () => {
    const out = dueReminders(prefs(), [dose({ taken: true })], [], [], wholeDay());
    expect(out).toEqual([]);
  });

  it("still speaks about the untaken one beside it", () => {
    const out = dueReminders(
      prefs(),
      [dose({ itemId: "i1", name: "Metformin", taken: true }), dose({ itemId: "i2", name: "Vitamin D" })],
      [],
      [],
      wholeDay(),
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.detail).toEqual(["Vitamin D"]);
  });

  it("says nothing about a check that is ticked", () => {
    const out = dueReminders(prefs(), [], [], [checkin({ done: true })], wholeDay());
    expect(out).toEqual([]);
  });

  it("says nothing about supply that is fine", () => {
    const out = dueReminders(prefs(), [], [supplyRow({ status: "ok" })], [], wholeDay());
    expect(out).toEqual([]);
  });

  it("respects each per-kind switch independently", () => {
    const all = { doses: [dose()], supply: [supplyRow()], checkins: [checkin()] };
    const noDoses = dueReminders(prefs({ doses: false }), all.doses, all.supply, all.checkins, wholeDay());
    expect(noDoses.map((r) => r.kind)).toEqual(["supply", "checkin"]);
    const noSupply = dueReminders(prefs({ supply: false }), all.doses, all.supply, all.checkins, wholeDay());
    expect(noSupply.map((r) => r.kind).sort()).toEqual(["checkin", "dose"]);
    const noCheckins = dueReminders(prefs({ checkins: false }), all.doses, all.supply, all.checkins, wholeDay());
    expect(noCheckins.map((r) => r.kind).sort()).toEqual(["dose", "supply"]);
  });
});

/* ===== the due window ===== */

describe("the due window is how once stays once", () => {
  it("fires a morning dose inside the sweep that covers 08:00", () => {
    const now: Now = { date: DATE, time: "08:15", windowMinutes: 30 };
    expect(dueReminders(prefs(), [dose()], [], [], now)).toHaveLength(1);
  });

  it("does not fire it again in the next sweep", () => {
    const later: Now = { date: DATE, time: "08:45", windowMinutes: 30 };
    expect(dueReminders(prefs(), [dose()], [], [], later)).toEqual([]);
  });

  it("does not fire before it is due", () => {
    const early: Now = { date: DATE, time: "07:30", windowMinutes: 30 };
    expect(dueReminders(prefs(), [dose()], [], [], early)).toEqual([]);
  });

  it("puts an unknown timing at midday rather than dropping it", () => {
    const now: Now = { date: DATE, time: "12:00", windowMinutes: 30 };
    const out = dueReminders(prefs(), [dose({ timing: "with-lunch" })], [], [], now);
    expect(out).toHaveLength(1);
    expect(out[0]?.at).toBe("12:00");
  });

  it("orders the day by the clock", () => {
    const out = dueReminders(
      prefs(),
      [dose({ itemId: "a", timing: "pre-bed" }), dose({ itemId: "b", timing: "am" })],
      [supplyRow()],
      [],
      wholeDay(),
    );
    expect(out.map((r) => r.at)).toEqual([TIMING_AT.am, SUPPLY_AT, TIMING_AT["pre-bed"]]);
  });
});

/* ===== rule 2: quiet hours are absolute ===== */

describe("quiet hours", () => {
  const p = prefs({ quietFrom: "22:30", quietTo: "07:00" });

  it("is quiet late at night", () => {
    expect(inQuietHours(p, "23:15")).toBe(true);
  });

  it("is still quiet after midnight — the window wraps", () => {
    expect(inQuietHours(p, "02:00")).toBe(true);
    expect(inQuietHours(p, "06:59")).toBe(true);
  });

  it("wakes up exactly on the boundary", () => {
    expect(inQuietHours(p, "07:00")).toBe(false);
    expect(inQuietHours(p, "22:30")).toBe(true);
  });

  it("handles a daytime window that does not wrap", () => {
    const nap = prefs({ quietFrom: "13:00", quietTo: "15:00" });
    expect(inQuietHours(nap, "14:00")).toBe(true);
    expect(inQuietHours(nap, "12:59")).toBe(false);
    expect(inQuietHours(nap, "15:00")).toBe(false);
  });

  it("treats a zero-length window as silencing nothing, never everything", () => {
    const broken = prefs({ quietFrom: "09:00", quietTo: "09:00" });
    expect(inQuietHours(broken, "09:00")).toBe(false);
    expect(inQuietHours(broken, "23:00")).toBe(false);
  });

  it("holds back a due reminder that lands inside the window, whatever it is", () => {
    const p2 = prefs({ quietFrom: "20:00", quietTo: "07:00" });
    const plan = planReminders({
      mode: "maintain",
      prefs: p2,
      doses: [dose({ timing: "pre-bed" })],
      supply: [],
      checkins: [],
      now: wholeDay(),
    });
    expect(plan.send).toEqual([]);
    expect(plan.quietHeld).toHaveLength(1);
  });
});

/* ===== rule 3: once, never a pile ===== */

describe("throttle", () => {
  function reminder(key: string, at: string): Reminder {
    return {
      key,
      kind: "dose",
      sourceKeys: [key],
      at,
      subject: "morning",
      detail: ["Metformin"],
      severity: "normal",
      tab: "stack",
    };
  }

  it("drops anything already sent today — never a second, louder copy", () => {
    const out = throttle([reminder("a", "08:00")], [{ key: "a", at: 1 }], 4);
    expect(out).toEqual([]);
  });

  it("caps the day, earliest first", () => {
    const rows = [reminder("c", "18:00"), reminder("a", "08:00"), reminder("b", "12:00")];
    expect(throttle(rows, [], 2).map((r) => r.key)).toEqual(["a", "b"]);
  });

  it("counts what already went out against the same budget", () => {
    const rows = [reminder("b", "12:00"), reminder("c", "18:00")];
    expect(throttle(rows, [{ key: "a", at: 1 }], 2).map((r) => r.key)).toEqual(["b"]);
  });

  it("sends nothing once the budget is spent", () => {
    const rows = [reminder("c", "18:00")];
    expect(throttle(rows, [{ key: "a", at: 1 }, { key: "b", at: 2 }], 2)).toEqual([]);
  });

  it("refuses a preference that would turn the app into an alarm clock", () => {
    expect(normalisePrefs({ maxPerDay: 99 }).maxPerDay).toBe(MAX_PER_DAY);
    expect(normalisePrefs({ maxPerDay: -3 }).maxPerDay).toBe(1);
  });
});

describe("coalescing", () => {
  it("turns three tablets at 08:00 into one notification listing three names", () => {
    const rows = dueReminders(
      prefs(),
      [
        dose({ itemId: "a", name: "Metformin" }),
        dose({ itemId: "b", name: "Atorvastatin" }),
        dose({ itemId: "c", name: "Vitamin D" }),
      ],
      [],
      [],
      wholeDay(),
    );
    expect(rows).toHaveLength(3);
    const merged = coalesce(rows);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.detail).toEqual(["Metformin", "Atorvastatin", "Vitamin D"]);
    expect(copyFor(merged[0]!).title).toBe("Time for your morning doses");
  });

  it("keeps morning and evening apart — they are different moments", () => {
    const rows = dueReminders(
      prefs(),
      [dose({ itemId: "a", timing: "am" }), dose({ itemId: "b", timing: "pm" })],
      [],
      [],
      wholeDay(),
    );
    expect(coalesce(rows)).toHaveLength(2);
  });

  it("keeps a run-out apart from a merely-low item", () => {
    const rows = dueReminders(
      prefs(),
      [],
      [
        supplyRow({ itemId: "a", name: "Metformin", status: "out", daysRemaining: 0 }),
        supplyRow({ itemId: "b", name: "Vitamin D", status: "urgent", daysRemaining: 2 }),
      ],
      [],
      wholeDay(),
    );
    const merged = coalesce(rows);
    expect(merged.map((r) => r.severity).sort()).toEqual(["low", "out"]);
  });

  it("gives a merged group a key that is stable for the same set", () => {
    const build = () =>
      coalesce(
        dueReminders(
          prefs(),
          [dose({ itemId: "a", name: "A" }), dose({ itemId: "b", name: "B" })],
          [],
          [],
          wholeDay(),
        ),
      );
    expect(build()[0]?.key).toBe(build()[0]?.key);
  });
});

/* ===== rule 4: survival is a floor ===== */

describe("survival mode", () => {
  const floorKeys = MODE_CHECKS.survival.map((c) => c.key);

  it("lets the floor's three checks speak", () => {
    const rows = dueReminders(
      prefs(),
      [],
      [],
      floorKeys.map((key) => checkin({ key, label: key })),
      wholeDay(),
    );
    expect(survivalFilter(coalesce(rows), "survival")).toHaveLength(1);
  });

  it("lets a genuine run-out speak", () => {
    const rows = dueReminders(prefs(), [], [supplyRow({ status: "out", daysRemaining: 0 })], [], wholeDay());
    expect(survivalFilter(rows, "survival")).toHaveLength(1);
  });

  it("lets an about-to-run-out speak too", () => {
    const rows = dueReminders(prefs(), [], [supplyRow({ status: "urgent", daysRemaining: 1 })], [], wholeDay());
    expect(survivalFilter(rows, "survival")).toHaveLength(1);
  });

  it("silences a routine reorder that is not yet a run-out", () => {
    const rows = dueReminders(prefs(), [], [supplyRow({ status: "order-now", daysRemaining: 6 })], [], wholeDay());
    expect(survivalFilter(rows, "survival")).toEqual([]);
  });

  it("silences doses and anything off the floor", () => {
    const rows = dueReminders(
      prefs(),
      [dose()],
      [],
      [checkin({ key: "instrument:PHQ-9", label: "PHQ-9" })],
      wholeDay(),
    );
    expect(survivalFilter(rows, "survival")).toEqual([]);
  });

  it("changes nothing outside survival", () => {
    const rows = dueReminders(prefs(), [dose()], [supplyRow()], [checkin()], wholeDay());
    expect(survivalFilter(rows, "cut")).toHaveLength(rows.length);
    expect(survivalFilter(rows, "maintain")).toHaveLength(rows.length);
  });

  it("reports what it held back rather than dropping it silently", () => {
    const plan = planReminders({
      mode: "survival",
      prefs: prefs(),
      doses: [dose()],
      supply: [],
      checkins: [],
      now: wholeDay(),
    });
    expect(plan.send).toEqual([]);
    expect(plan.survivalHeld).toHaveLength(1);
  });
});

/* ===== the words ===== */

describe("copy", () => {
  it("names the time of day, kindly, for a single dose", () => {
    const rows = dueReminders(prefs(), [dose({ timing: "pm", name: "Metformin" })], [], [], wholeDay());
    const words = copyFor(rows[0]!);
    expect(words.title).toBe("Time for your evening dose");
    expect(words.body).toBe("Metformin. Tap it off when it's done.");
  });

  it("never scolds, blames or shouts", () => {
    const rows = coalesce(
      dueReminders(
        prefs(),
        [dose({ timing: "pm" })],
        [
          supplyRow({ itemId: "a", status: "out", daysRemaining: 0 }),
          supplyRow({ itemId: "b", name: "Vitamin D", status: "urgent", daysRemaining: 2 }),
          supplyRow({ itemId: "c", name: "Creatine", status: "order-now", daysRemaining: 7 }),
        ],
        [checkin()],
        wholeDay(),
      ),
    );
    expect(rows.length).toBeGreaterThan(3);
    for (const row of rows) {
      const { title, body } = copyFor(row);
      const text = `${title} ${body}`;
      expect(text).not.toMatch(/missed|failed|forgot|overdue|late|must|should|!/i);
      // No shouting: no all-caps word longer than three letters.
      expect(text).not.toMatch(/\b[A-Z]{4,}\b/);
      expect(title.length).toBeGreaterThan(0);
      expect(body.length).toBeGreaterThan(0);
    }
  });

  it("pluralises a merged run-out without pretending it is one thing", () => {
    const rows = coalesce(
      dueReminders(
        prefs(),
        [],
        [
          supplyRow({ itemId: "a", name: "Metformin", status: "out", daysRemaining: 0 }),
          supplyRow({ itemId: "b", name: "Vitamin D", status: "out", daysRemaining: 0 }),
        ],
        [],
        wholeDay(),
      ),
    );
    expect(copyFor(rows[0]!).title).toBe("Metformin and Vitamin D have run out");
  });

  it("asks about the file rather than telling anyone off about it", () => {
    const rows = dueReminders(prefs(), [], [], [checkin()], wholeDay());
    expect(copyFor(rows[0]!).title).toBe("Two minutes on today's file?");
  });

  it("keeps a low-supply line to the person's own numbers", () => {
    const rows = dueReminders(
      prefs(),
      [],
      [supplyRow({ status: "urgent", daysRemaining: 2, reorderLeadDays: 5 })],
      [],
      wholeDay(),
    );
    const words = copyFor(rows[0]!);
    expect(words.title).toBe("Metformin is nearly gone");
    expect(words.body).toContain("about 2 days left");
    expect(words.body).toContain("a refill takes about 5 days");
  });
});

/* ===== preferences ===== */

describe("preferences", () => {
  it("falls back to the defaults when there is no row", () => {
    expect(normalisePrefs(null)).toEqual(DEFAULT_PREFS);
  });

  it("patches one field without disturbing the rest", () => {
    const base = prefs({ quietFrom: "23:00" });
    const next = normalisePrefs({ doses: false }, base);
    expect(next.doses).toBe(false);
    expect(next.quietFrom).toBe("23:00");
    expect(next.enabled).toBe(true);
  });

  it("repairs a malformed quiet window rather than storing it", () => {
    const next = normalisePrefs({ quietFrom: "not a time", quietTo: "7:5" });
    expect(next.quietFrom).toBe(DEFAULT_PREFS.quietFrom);
    expect(next.quietTo).toBe(DEFAULT_PREFS.quietTo);
  });

  it("stores a valid email and drops an unusable one", () => {
    expect(normalisePrefs({ email: " Liam@Example.COM " }).email).toBe("liam@example.com");
    expect(normalisePrefs({ email: "not-an-email" }).email).toBe("");
  });

  it("pads a sloppy but legal time", () => {
    expect(normalisePrefs({ quietFrom: "9:05" }).quietFrom).toBe("09:05");
  });

  it("parses minutes since midnight", () => {
    expect(minutesOf("00:00")).toBe(0);
    expect(minutesOf("08:30")).toBe(510);
    expect(minutesOf("23:59")).toBe(1439);
    expect(minutesOf("garbage")).toBe(0);
  });
});

/* ===== check-ins ===== */

describe("check-ins", () => {
  const checks = [
    { key: "protein", label: "Protein hit", done: false },
    { key: "steps", label: "Steps", done: true },
  ];

  it("carries the mode's own checks straight through", () => {
    const out = checkinsFor(checks, [], DATE, daysBetween);
    expect(out.map((c) => c.key)).toEqual(["protein", "steps"]);
    expect(out[1]?.done).toBe(true);
  });

  it("asks again about an instrument that is past its cadence", () => {
    const stale = { instrument: "PHQ-9", lastDate: "2026-07-01" };
    const out = checkinsFor([], [stale], DATE, daysBetween);
    expect(out[0]?.done).toBe(false);
    expect(out[0]?.key).toBe("instrument:PHQ-9");
  });

  it("stays quiet about one answered inside its cadence", () => {
    const fresh = { instrument: "PHQ-9", lastDate: "2026-08-10" };
    expect(daysBetween(fresh.lastDate, DATE)).toBeLessThan(ASSESSMENT_CADENCE_DAYS);
    expect(checkinsFor([], [fresh], DATE, daysBetween)[0]?.done).toBe(true);
  });

  it("never invents an instrument that is not already on the file", () => {
    expect(checkinsFor(checks, [], DATE, daysBetween).every((c) => !c.key.startsWith("instrument:"))).toBe(true);
  });
});

/* ===== subscriptions ===== */

describe("subscription health", () => {
  it("is healthy until it has failed three times running", () => {
    for (let f = 0; f < MAX_CONSECUTIVE_FAILURES; f++) {
      expect(subscriptionView({ id: "s", label: "Phone", createdDate: DATE, failures: f }).healthy).toBe(true);
    }
    expect(
      subscriptionView({ id: "s", label: "Phone", createdDate: DATE, failures: MAX_CONSECUTIVE_FAILURES }).healthy,
    ).toBe(false);
  });

  it("says in words whether anything has ever reached the device", () => {
    const never = subscriptionView({ id: "s", label: "Phone", createdDate: DATE, failures: 0 });
    expect(never.lastSuccessAt).toBeNull();
    expect(never.line).toContain("nothing has been delivered");
    const live = subscriptionView({ id: "s", label: "Phone", createdDate: DATE, failures: 0, lastSuccessAt: 5 });
    expect(live.line).toContain("reaching this device");
  });
});

/* ===== local time ===== */

describe("local time", () => {
  it("reads a timestamp in the app's zone", () => {
    // 2026-08-13T07:30:00Z is 08:30 in Dublin (IST, UTC+1).
    const out = localNow(Date.parse("2026-08-13T07:30:00Z"), APP_TIMEZONE);
    expect(out.date).toBe("2026-08-13");
    expect(out.time).toBe("08:30");
  });

  it("crosses midnight into the right local date", () => {
    const out = localNow(Date.parse("2026-08-12T23:30:00Z"), APP_TIMEZONE);
    expect(out.date).toBe("2026-08-13");
    expect(out.time).toBe("00:30");
  });

  it("degrades to UTC rather than throwing on an unknown zone", () => {
    const out = localNow(Date.parse("2026-08-13T07:30:00Z"), "Not/AZone");
    expect(out.date).toBe("2026-08-13");
    expect(out.time).toBe("07:30");
  });
});

/* ===== the view ===== */

describe("the view", () => {
  function build(over: Partial<Parameters<typeof buildRemindView>[0]> = {}) {
    return buildRemindView({
      mode: "maintain",
      date: DATE,
      prefs: prefs(),
      subscriptions: [{ id: "s1", label: "Phone", createdDate: DATE, failures: 0, lastSuccessAt: 10 }],
      // The captures screen is built by its own slice and carried through
      // whole; the reminder rules never read it.
      capture: buildCaptureView({ mode: "maintain", date: DATE, captures: [], items: [], foods: [] }),
      doses: [dose()],
      supply: [],
      checkins: [],
      pushReady: true,
      emailSupported: false,
      vapidPublicKey: "BPk",
      demo: false,
      ...over,
    });
  }

  it("is ready when the server, the switch and a device all line up", () => {
    const view = build();
    expect(view.ready).toBe(true);
    expect(view.supported).toBe(true);
    expect(view.blockers).toEqual([]);
    expect(view.preview).toHaveLength(1);
  });

  it("lets a demo be ready when send keys are present", () => {
    const view = build({ demo: true, pushReady: true, vapidPublicKey: "BPk" });
    expect(view.ready).toBe(true);
    expect(view.supported).toBe(true);
    expect(view.preview).toHaveLength(1);
  });

  it("says plainly when the deployment has no keys, including a demo", () => {
    const view = build({ demo: true, pushReady: false, emailSupported: false, vapidPublicKey: "" });
    expect(view.ready).toBe(false);
    expect(view.supported).toBe(false);
    expect(view.blockers.join(" ")).toContain("no send keys");
    expect(view.preview).toHaveLength(1);
  });

  it("is ready on email alone when mail is configured", () => {
    const view = build({
      pushReady: false,
      emailSupported: true,
      vapidPublicKey: "",
      subscriptions: [],
      prefs: prefs({ email: "liam@example.com" }),
    });
    expect(view.ready).toBe(true);
    expect(view.blockers).toEqual([]);
  });

  it("does not claim email will fire when the address is saved but no email key exists", () => {
    const view = build({
      subscriptions: [],
      prefs: prefs({ email: "liam@example.com" }),
    });
    expect(view.ready).toBe(false);
    expect(view.blockers.join(" ")).toContain("no email key");
  });

  it("says plainly when no device is set up and no email is on the file", () => {
    const view = build({ subscriptions: [] });
    expect(view.ready).toBe(false);
    expect(view.blockers.join(" ")).toContain("no email");
  });

  it("says plainly when reminders are switched off", () => {
    const view = build({ prefs: prefs({ enabled: false }) });
    expect(view.ready).toBe(false);
    expect(view.preview).toEqual([]);
    expect(view.blockers.join(" ")).toContain("switched off");
  });

  it("never leaks an endpoint or a key to the client", () => {
    const view = build();
    const json = JSON.stringify(view.subscriptions);
    expect(json).not.toContain("endpoint");
    expect(json).not.toContain("p256dh");
    expect(json).not.toContain("auth");
  });

  it("shows the survival floor and names what it is holding back", () => {
    const view = build({ mode: "survival", doses: [dose()], checkins: [checkin()] });
    expect(view.survival).toBe(true);
    expect(view.preview.map((r) => r.kind)).toEqual(["checkin"]);
    expect(view.survivalHeld.map((r) => r.kind)).toEqual(["dose"]);
  });

  it("gives every previewed card the words that would actually be shown", () => {
    for (const card of build({ doses: [dose(), dose({ itemId: "i2", timing: "pm" })] }).preview) {
      expect(card).toMatchObject(copyFor(card));
    }
  });
});
