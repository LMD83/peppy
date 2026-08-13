import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { addDays } from "../lib";
import { compoundByKey } from "../data/compounds";
import { dueOn, type StackItem } from "../logic-stack";

/**
 * Stack fixtures — what the two crew members are actually on, and three weeks
 * of honest dose logs behind it.
 *
 * Row shapes are redeclared here rather than imported: Convex code must not
 * reach into src/. They are field-identical to src/app/_lib/demo/rows.ts,
 * which is the contract.
 */

export type ProtocolItemRow = {
  id: string;
  userSlug: string;
  name: string;
  kind: "med" | "peptide" | "supplement";
  dose: number;
  unit: string;
  route: "oral" | "subcut" | "intramuscular" | "topical" | "nasal";
  timings: string[];
  scheduleType: "daily" | "weekdays" | "interval" | "cycle";
  weekdays?: number[];
  intervalDays?: number;
  cycleOnWeeks?: number;
  cycleOffWeeks?: number;
  startDate: string;
  endDate?: string;
  withFood: boolean;
  evidence: "strong" | "moderate" | "limited" | "anecdotal";
  cautions: string[];
  note?: string;
  recon?: { vialMg: number; bacMl: number; syringeUnitsPerMl: number };
  active: boolean;
};

export type DoseLogRow = {
  userSlug: string;
  date: string;
  itemId: string;
  timing: string;
  taken: boolean;
  site?: string;
};

export type StackFixtures = {
  protocolItems: ProtocolItemRow[];
  doseLogs: DoseLogRow[];
};

/** Identity, unit, route, evidence and cautions come from the catalogue. */
function fromCatalogue(key: string) {
  const c = compoundByKey(key);
  if (!c) throw new Error(`Unknown compound ${key}`);
  return {
    name: c.name,
    kind: c.kind,
    unit: c.defaultUnit,
    route: c.typicalRoute,
    evidence: c.evidence,
    cautions: [...c.cautions],
  };
}

/** The fixture rows read as StackItems, so the schedule drives the logs. */
function asItem({ userSlug: _slug, ...row }: ProtocolItemRow): StackItem {
  return row;
}

/** ~15% of doses go unlogged — the shape of a real three weeks, not a demo. */
function missed(itemIndex: number, back: number, timingIndex: number): boolean {
  return (back * 3 + itemIndex * 5 + timingIndex) % 7 === 0;
}

const LOG_DAYS = 21;

export function buildStackFixtures(today: string): StackFixtures {
  // The protocol rows were created when the file started carrying them —
  // three weeks back, which is exactly as far as the dose logs go.
  const fileStart = addDays(today, -LOG_DAYS);

  const protocolItems: ProtocolItemRow[] = [
    {
      id: "pi_liam_creatine",
      userSlug: "liam",
      ...fromCatalogue("creatine_monohydrate"),
      dose: 5,
      timings: ["am"],
      scheduleType: "daily",
      startDate: fileStart,
      withFood: false,
      note: "Flagged on the file so a raised creatinine result is read correctly.",
      active: true,
    },
    {
      id: "pi_liam_vitd",
      userSlug: "liam",
      ...fromCatalogue("vitamin_d3"),
      dose: 2000,
      timings: ["am"],
      scheduleType: "daily",
      startDate: fileStart,
      withFood: true,
      note: "Started after a low 25-OH draw. Recheck sets whether it stays.",
      active: true,
    },
    {
      id: "pi_liam_omega3",
      userSlug: "liam",
      ...fromCatalogue("omega_3"),
      dose: 2,
      timings: ["pm"],
      scheduleType: "daily",
      startDate: fileStart,
      withFood: true,
      active: true,
    },
    {
      id: "pi_liam_magnesium",
      userSlug: "liam",
      ...fromCatalogue("magnesium_glycinate"),
      dose: 400,
      timings: ["pre-bed"],
      scheduleType: "daily",
      startDate: fileStart,
      withFood: false,
      note: "Sits inside the 20:15 close-out ritual.",
      active: true,
    },
    {
      id: "pi_liam_caffeine",
      userSlug: "liam",
      ...fromCatalogue("caffeine"),
      dose: 200,
      timings: ["pre-workout"],
      scheduleType: "weekdays",
      weekdays: [1, 2, 3, 4, 5],
      startDate: fileStart,
      withFood: false,
      note: "Curfew 14:00 while experiment E1 runs.",
      active: true,
    },
    {
      id: "pi_liam_bpc157",
      userSlug: "liam",
      ...fromCatalogue("bpc_157"),
      dose: 250,
      timings: ["am"],
      scheduleType: "cycle",
      cycleOnWeeks: 5,
      cycleOffWeeks: 2,
      startDate: addDays(today, -10),
      withFood: false,
      note: "Logged as an experiment, not a treatment. Evidence is limited and stated as such.",
      recon: { vialMg: 5, bacMl: 2, syringeUnitsPerMl: 100 },
      active: true,
    },
    {
      id: "pi_liam_statin",
      userSlug: "liam",
      ...fromCatalogue("atorvastatin"),
      dose: 10,
      timings: ["pre-bed"],
      scheduleType: "daily",
      startDate: fileStart,
      withFood: false,
      note: "Prescribed after the LDL-C draw. Recheck adds ApoB.",
      active: true,
    },

    /* Conor — survival. The med and the deficiency correction, nothing else. */
    {
      id: "pi_conor_levo",
      userSlug: "conor",
      ...fromCatalogue("levothyroxine"),
      dose: 75,
      timings: ["am"],
      scheduleType: "daily",
      startDate: fileStart,
      withFood: false,
      note: "Fasted, before anything else. Never skipped, floor or no floor.",
      active: true,
    },
    {
      id: "pi_conor_vitd",
      userSlug: "conor",
      ...fromCatalogue("vitamin_d3"),
      dose: 2000,
      timings: ["am"],
      scheduleType: "daily",
      startDate: fileStart,
      withFood: true,
      active: true,
    },
  ];

  const doseLogs: DoseLogRow[] = [];
  protocolItems.forEach((row, itemIndex) => {
    const item = asItem(row);
    for (let back = LOG_DAYS; back >= 0; back--) {
      const date = addDays(today, -back);
      if (!dueOn(item, date)) continue;
      item.timings.forEach((timing, timingIndex) => {
        // Today is still in play: the morning is logged, the evening is not.
        if (back === 0 && timing !== "am" && timing !== "pre-workout") return;
        // Liam's magnesium went missing for three nights running — a visible run.
        const runOfMisses = row.id === "pi_liam_magnesium" && back >= 7 && back <= 9;
        const skipped = runOfMisses || missed(itemIndex, back, timingIndex);
        // An unlogged dose leaves no row; the three-night run was tapped as missed.
        if (skipped && !runOfMisses) return;
        const log: DoseLogRow = {
          userSlug: row.userSlug,
          date,
          itemId: row.id,
          timing,
          taken: !skipped,
        };
        // Injection sites are recorded so rotation is visible; oral doses have none.
        if (row.route === "subcut") log.site = back % 2 === 0 ? "abdomen L" : "abdomen R";
        doseLogs.push(log);
      });
    }
  });

  return { protocolItems, doseLogs };
}

/** Insert the items first, then the logs against their real ids. */
export async function seedStack(
  ctx: MutationCtx,
  uid: (slug: string) => Id<"tm_users">,
  fx: StackFixtures,
): Promise<void> {
  const idByFixtureId = new Map<string, Id<"tm_protocolItems">>();
  for (const { id, userSlug, ...row } of fx.protocolItems) {
    idByFixtureId.set(
      id,
      await ctx.db.insert("tm_protocolItems", { userId: uid(userSlug), ...row }),
    );
  }
  for (const { userSlug, itemId, ...row } of fx.doseLogs) {
    const realId = idByFixtureId.get(itemId);
    if (!realId) continue;
    await ctx.db.insert("tm_doseLogs", { userId: uid(userSlug), itemId: realId, ...row });
  }
}
