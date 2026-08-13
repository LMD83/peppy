import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { instrumentByKey } from "../data/instruments";
import { addDays } from "../lib";
import { scoreInstrument } from "../logic-mind";

/**
 * Mind fixtures — a six-week self-report history for Liam on a cut, and the
 * two-instrument floor for Conor in survival.
 *
 * Row shapes are redeclared here rather than imported: Convex code must not
 * reach into src/. They are field-identical to src/app/_lib/demo/rows.ts,
 * which is the contract.
 *
 * Every score is computed from the answers by the same scorer the mutation
 * uses, so a fixture can never disagree with a live submission. The trends are
 * mild and improving; nothing here is presented as a clinical fact about
 * either person, and the PHQ-9 safety item is answered zero throughout.
 */

export type AssessmentRow = {
  userSlug: string;
  date: string;
  instrument: string;
  answers: number[];
  score: number;
  band: string;
};

export type IntentionRow = {
  id: string;
  userSlug: string;
  trigger: string;
  action: string;
  active: boolean;
  createdDate: string;
  wins: number;
};

export type ReflectionRow = {
  userSlug: string;
  date: string;
  prompt: string;
  response: string;
  win?: string;
};

export type MindFixtures = {
  assessments: AssessmentRow[];
  intentions: IntentionRow[];
  reflections: ReflectionRow[];
};

/** [instrument, days before today, answers] — scores derived, never hand-written. */
type Take = [instrument: string, daysAgo: number, answers: number[]];

/**
 * Liam: six weeks apart on the long instruments, a fortnight on cravings.
 * Item 9 of the PHQ-9 (index 8) is zero in both takes — no safety flag.
 */
const LIAM_TAKES: Take[] = [
  ["phq9", 42, [2, 2, 2, 2, 1, 2, 1, 0, 0]],
  ["phq9", 21, [1, 1, 1, 1, 1, 1, 0, 0, 0]],
  ["gad7", 42, [2, 2, 2, 1, 1, 2, 1]],
  ["gad7", 16, [1, 1, 1, 1, 0, 1, 1]],
  ["who5", 35, [2, 2, 3, 1, 3]],
  ["who5", 6, [3, 3, 4, 2, 4]],
  ["pacs", 35, [4, 4, 3, 4, 4]],
  ["pacs", 3, [2, 2, 2, 3, 2]],
];

/** Conor, in survival: the floor set only, once each. Nothing alarming. */
const CONOR_TAKES: Take[] = [
  ["who5", 20, [3, 2, 3, 2, 3]],
  ["pacs", 10, [2, 2, 1, 2, 2]],
];

function takesFor(userSlug: string, takes: Take[], today: string): AssessmentRow[] {
  const rows: AssessmentRow[] = [];
  for (const [instrument, daysAgo, answers] of takes) {
    const def = instrumentByKey(instrument);
    if (!def) continue; // fixtures never invent an instrument the catalogue lacks
    const scored = scoreInstrument(def, answers);
    rows.push({
      userSlug,
      date: addDays(today, -daysAgo),
      instrument: def.key,
      answers: [...answers],
      score: scored.score,
      band: scored.band,
    });
  }
  return rows;
}

export function buildMindFixtures(today: string): MindFixtures {
  const assessments = [
    ...takesFor("liam", LIAM_TAKES, today),
    ...takesFor("conor", CONOR_TAKES, today),
  ];

  const intentions: IntentionRow[] = [
    {
      id: "int_1",
      userSlug: "liam",
      trigger: "I'm tired and the evening craving arrives",
      action: "run the close-out ritual — skyr, two squares of dark, decaf — then go up",
      active: true,
      createdDate: addDays(today, -38),
      wins: 11,
    },
    {
      id: "int_2",
      userSlug: "liam",
      trigger: "I'm bored and the kitchen is the plan",
      action: "ten press-ups, then sit back down with the glass of water",
      active: true,
      createdDate: addDays(today, -19),
      wins: 4,
    },
    {
      id: "int_3",
      userSlug: "conor",
      trigger: "the knee aches and I want to write the day off",
      action: "three floor checks only — protein, steps, kitchen closed at 20:30",
      active: true,
      createdDate: addDays(today, -12),
      wins: 7,
    },
  ];

  const reflections: ReflectionRow[] = [
    {
      userSlug: "liam",
      date: addDays(today, -1),
      prompt: "What did you learn about the hour before the craving, not the craving itself?",
      response:
        "The 21:00 tap is really a 19:30 problem — dinner too light, then a screen for an hour. Move the protein earlier and the evening stops being interesting.",
      win: "Rode it out twice without opening the press",
    },
    {
      userSlug: "liam",
      date: addDays(today, -8),
      prompt: "Which check was hardest to hold, and what made it hard?",
      response:
        "Steps. Two days of rain and a full calendar. Nothing dramatic — the walk just never had a slot in the day, so it never happened.",
      win: "Logged the weigh-in every morning anyway",
    },
    {
      userSlug: "liam",
      date: addDays(today, -15),
      prompt: "What is one thing the last week's data says that you would not have guessed?",
      response:
        "Cravings track tiredness far more than hunger. On the two nights I was in bed before 23:00 there were no taps at all.",
    },
  ];

  return { assessments, intentions, reflections };
}

/** Straightforward inserts — no fixture ids are referenced across tables here. */
export async function seedMind(
  ctx: MutationCtx,
  uid: (slug: string) => Id<"tm_users">,
  fx: MindFixtures,
): Promise<void> {
  for (const row of fx.assessments) {
    await ctx.db.insert("tm_assessments", {
      userId: uid(row.userSlug),
      date: row.date,
      instrument: row.instrument,
      answers: row.answers,
      score: row.score,
      band: row.band,
    });
  }
  for (const row of fx.intentions) {
    await ctx.db.insert("tm_intentions", {
      userId: uid(row.userSlug),
      trigger: row.trigger,
      action: row.action,
      active: row.active,
      createdDate: row.createdDate,
      wins: row.wins,
    });
  }
  for (const row of fx.reflections) {
    await ctx.db.insert("tm_reflections", {
      userId: uid(row.userSlug),
      date: row.date,
      prompt: row.prompt,
      response: row.response,
      win: row.win,
    });
  }
}
