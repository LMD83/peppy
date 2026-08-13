import { instrumentByKey } from "@convex/tm/data/instruments";
import { MODE_CHECKS, addDays } from "@convex/tm/lib";
import { buildTriggerMap, computeStreakAndAdherence, type WallDay } from "@convex/tm/logic";
import {
  InstrumentInputError,
  buildMindView,
  scoreInstrument,
  type MindViewInput,
  type RawAssessment,
  type RawIntention,
  type RawReflection,
} from "@convex/tm/logic-mind";
import type { DemoDb } from "../demo-db";
import type { MindData } from "../types";

/**
 * Demo mirror of convex/tm/mind.ts. Same gather, same shared logic, same shape —
 * the view type is derived from the Convex query, so any drift is a build error.
 * Scores are computed here too; a caller-supplied total is never stored.
 */

const TRIGGER_WINDOW_DAYS = 14;
const WALL_DAYS = 14;
const MAX_TRIGGER_CHARS = 120;
const MAX_ACTION_CHARS = 160;
const MAX_RESPONSE_CHARS = 2000;
const MAX_WIN_CHARS = 160;
const MAX_ACTIVE_INTENTIONS = 12;

function gather(db: DemoDb, slug: string, date: string): MindViewInput {
  const user = db.users.find((u) => u.slug === slug);
  if (!user) throw new Error("Unknown user");

  const assessments: RawAssessment[] = db.assessments
    .filter((a) => a.userSlug === slug)
    .map((a) => ({
      date: a.date,
      instrument: a.instrument,
      answers: a.answers,
      score: a.score,
      band: a.band,
    }));

  const intentions: RawIntention[] = db.intentions
    .filter((i) => i.userSlug === slug)
    .map((i) => ({
      id: i.id,
      trigger: i.trigger,
      action: i.action,
      active: i.active,
      createdDate: i.createdDate,
      wins: i.wins,
    }));

  const reflections: RawReflection[] = db.reflections
    .filter((r) => r.userSlug === slug)
    .map((r) => ({ date: r.date, prompt: r.prompt, response: r.response, win: r.win ?? null }));

  const from = addDays(date, -(TRIGGER_WINDOW_DAYS - 1));
  const cravings = db.cravings.filter((c) => c.userSlug === slug && c.date >= from && c.date <= date);

  // Same 14-day wall the Convex side reads through adherenceStats.
  const keys = MODE_CHECKS[user.modeMut].map((c) => c.key);
  const wall: WallDay[] = [];
  for (let i = WALL_DAYS - 1; i >= 0; i--) {
    const day = addDays(date, -i);
    const doneByKey = new Map(
      db.checks.filter((c) => c.userSlug === slug && c.date === day).map((r) => [r.key, r.done]),
    );
    wall.push({ date: day, done: keys.filter((k) => doneByKey.get(k) === true).length, total: keys.length });
  }
  const stats = computeStreakAndAdherence(wall, date);
  const yesterday = wall.find((d) => d.date === addDays(date, -1));

  return {
    mode: user.modeMut,
    date,
    assessments,
    intentions,
    reflections,
    triggerMap: buildTriggerMap(cravings),
    streak: stats.streak,
    adherence7: stats.adherence7,
    missedYesterday: yesterday !== undefined && yesterday.done < yesterday.total,
  };
}

export function view(db: DemoDb, slug: string, date: string): MindData {
  return buildMindView(gather(db, slug, date));
}

export function submitAssessment(
  db: DemoDb,
  slug: string,
  date: string,
  instrument: string,
  answers: number[],
): void {
  const def = instrumentByKey(instrument);
  if (!def) throw new Error("unknown-instrument");
  let scored;
  try {
    scored = scoreInstrument(def, answers);
  } catch (err) {
    if (err instanceof InstrumentInputError) throw new Error(err.code);
    throw err;
  }

  const existing = db.assessments.find(
    (a) => a.userSlug === slug && a.date === date && a.instrument === def.key,
  );
  if (existing) {
    existing.answers = [...answers];
    existing.score = scored.score;
    existing.band = scored.band;
    return;
  }
  db.assessments.push({
    userSlug: slug,
    date,
    instrument: def.key,
    answers: [...answers],
    score: scored.score,
    band: scored.band,
  });
}

export function addIntention(db: DemoDb, slug: string, date: string, trigger: string, action: string): void {
  const t = trigger.trim().slice(0, MAX_TRIGGER_CHARS);
  const a = action.trim().slice(0, MAX_ACTION_CHARS);
  if (t.length === 0 || a.length === 0) throw new Error("empty-intention");
  const active = db.intentions.filter((i) => i.userSlug === slug && i.active).length;
  if (active >= MAX_ACTIVE_INTENTIONS) throw new Error("too-many-intentions");
  db.intentions.push({
    id: db.newId("int"),
    userSlug: slug,
    trigger: t,
    action: a,
    active: true,
    createdDate: date,
    wins: 0,
  });
}

export function markIntentionWin(db: DemoDb, intentionId: string): void {
  const row = db.intentions.find((i) => i.id === intentionId);
  if (!row) return;
  row.wins += 1;
}

export function saveReflection(
  db: DemoDb,
  slug: string,
  date: string,
  prompt: string,
  response: string,
  win?: string,
): void {
  const text = response.trim().slice(0, MAX_RESPONSE_CHARS);
  if (text.length === 0) throw new Error("empty-reflection");
  const winText = win?.trim().slice(0, MAX_WIN_CHARS);
  const cleanWin = winText && winText.length > 0 ? winText : undefined;
  const existing = db.reflections.find((r) => r.userSlug === slug && r.date === date);
  if (existing) {
    existing.prompt = prompt.trim().slice(0, MAX_RESPONSE_CHARS);
    existing.response = text;
    existing.win = cleanWin;
    return;
  }
  db.reflections.push({
    userSlug: slug,
    date,
    prompt: prompt.trim().slice(0, MAX_RESPONSE_CHARS),
    response: text,
    win: cleanWin,
  });
}
