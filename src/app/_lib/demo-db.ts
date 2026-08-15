import { buildFixtures, type Fixtures, type FixtureUser } from "@convex/tm/fixtures";
import { MODE_CHECKS, SESSION_PLAN, addDays, daysBetween, type TmMode } from "@convex/tm/lib";
import {
  buildTriggerMap,
  classifyEngine,
  computeStreakAndAdherence,
  findPeak,
  isWinterWindow,
  overloadFlag,
  targetKgFor,
  tripwireFor,
  type WallDay,
} from "@convex/tm/logic";
import type {
  CravingEntry,
  CrewData,
  FeedData,
  FuelData,
  LabResultInput,
  LabsData,
  MealSlot,
  MindData,
  ProgressData,
  ResearchData,
  StackData,
  HandsFreeData,
  SupplyData,
  TodayData,
  TrainData,
} from "./types";
import type {
  AssessmentRow,
  DoseLogRow,
  EnergyEstimateRow,
  IntentionRow,
  LabPanelRow,
  LabResultRow,
  MealEntryRow,
  MesocycleRow,
  NutritionTargetRow,
  ProgramBlockRow,
  ProtocolItemRow,
  ReflectionRow,
  SetLogRow,
  VolumeLandmarkRow,
} from "./demo/rows";
import type { ContactRow, CrewLinkRow, SupplyRow } from "./demo/rows-wave1";
import * as fuel from "./demo/fuel";
import * as train from "./demo/train";
import * as stack from "./demo/stack";
import * as labsView from "./demo/labs";
import * as mind from "./demo/mind";
import * as consent from "./demo/consent";
import * as supply from "./demo/supply";
import * as ingest from "./demo/ingest";

/**
 * In-memory demo backend. Serves the same view models as the Convex queries,
 * computed with the same shared logic (convex/tm/logic.ts), over the same
 * fixtures as the Convex seed. Used when no Convex deployment is configured
 * (NEXT_PUBLIC_TIMENTO_DEMO=1); state lives for the page session only.
 */

type DemoUser = FixtureUser & { a11yProfileMut?: "standard" | "easy" } & { modeSinceMut: string; modeMut: TmMode; reviewDateMut?: string; ceilingMut: number };

export class DemoDb {
  users: DemoUser[];
  days: Fixtures["days"];
  checks: Fixtures["checks"];
  cravings: Fixtures["cravings"];
  lifts: Fixtures["lifts"];
  labs: Fixtures["labs"];
  markers: Fixtures["markers"];
  experiments: Fixtures["experiments"];
  feedRows: { userSlug: string; name: string; message: string; at: number }[];

  /* Domain tables — same shapes the Convex seed inserts. */
  nutritionTargets: NutritionTargetRow[];
  mealEntries: MealEntryRow[];
  energyEstimates: EnergyEstimateRow[];
  mesocycles: MesocycleRow[];
  programBlocks: ProgramBlockRow[];
  setLogs: SetLogRow[];
  volumeLandmarks: VolumeLandmarkRow[];
  protocolItems: ProtocolItemRow[];
  doseLogs: DoseLogRow[];
  labPanels: LabPanelRow[];
  labResults: LabResultRow[];
  assessments: AssessmentRow[];
  intentions: IntentionRow[];
  reflections: ReflectionRow[];
  crewLinks: CrewLinkRow[];
  supplyRows: SupplyRow[];
  contacts: ContactRow[];
  ingestTokens: { id: string; userSlug: string; token: string; label: string; createdDate: string; lastUsedAt?: number; revoked: boolean }[];

  private listeners = new Set<() => void>();
  private idSeq = 0;
  version = 0;

  /** Stable-per-session id for rows the demo creates at runtime. */
  newId(prefix: string): string {
    this.idSeq += 1;
    return `${prefix}_${this.idSeq}`;
  }

  constructor(today: string) {
    const fx = buildFixtures(today);
    this.nutritionTargets = [...fx.nutritionTargets];
    this.mealEntries = [...fx.mealEntries];
    this.energyEstimates = [...fx.energyEstimates];
    this.mesocycles = [...fx.mesocycles];
    this.programBlocks = [...fx.programBlocks];
    this.setLogs = [...fx.setLogs];
    this.volumeLandmarks = [...fx.volumeLandmarks];
    this.protocolItems = [...fx.protocolItems];
    this.doseLogs = [...fx.doseLogs];
    this.labPanels = [...fx.labPanels];
    this.labResults = [...fx.labResults];
    this.assessments = [...fx.assessments];
    this.intentions = [...fx.intentions];
    this.reflections = [...fx.reflections];
    this.crewLinks = [...fx.crewLinks];
    this.supplyRows = [...fx.supplyRows];
    this.contacts = [...fx.contacts];
    this.ingestTokens = [];
    this.users = fx.users.map((u) => ({
      ...u,
      modeMut: u.mode,
      modeSinceMut: u.modeSince,
      reviewDateMut: u.reviewDate,
      ceilingMut: u.ceilingKg,
    }));
    this.days = [...fx.days];
    this.checks = [...fx.checks];
    this.cravings = [...fx.cravings];
    this.lifts = [...fx.lifts];
    this.labs = [...fx.labs];
    this.markers = [...fx.markers];
    this.experiments = [...fx.experiments];
    let at = Date.now() - 3 * 3600_000;
    this.feedRows = fx.crewFeed.map((f) => ({
      userSlug: f.userSlug,
      name: fx.users.find((u) => u.slug === f.userSlug)?.name ?? f.userSlug,
      message: f.message,
      at: (at += 17 * 60_000),
    }));
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private bump() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  login(slug: string, passcode: string): { ok: boolean; error?: string; name?: string } {
    const user = this.users.find((u) => u.slug === slug);
    if (!user) return { ok: false, error: "Unknown user" };
    if (user.passcode !== passcode) return { ok: false, error: "Wrong passcode" };
    return { ok: true, name: user.name };
  }

  roster() {
    return this.users.map((u) => ({ slug: u.slug, name: u.name }));
  }

  private user(slug: string): DemoUser {
    const u = this.users.find((x) => x.slug === slug);
    if (!u) throw new Error("Unknown user");
    return u;
  }

  private checksFor(slug: string, mode: TmMode, date: string) {
    const rows = this.checks.filter((c) => c.userSlug === slug && c.date === date);
    const doneByKey = new Map(rows.map((r) => [r.key, r.done]));
    return MODE_CHECKS[mode].map((c) => ({ ...c, done: doneByKey.get(c.key) ?? false }));
  }

  private wallFor(user: DemoUser, today: string) {
    const total = MODE_CHECKS[user.modeMut].length;
    const wall: WallDay[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = addDays(today, -i);
      const done = this.checksFor(user.slug, user.modeMut, date).filter((c) => c.done).length;
      wall.push({ date, done, total });
    }
    return wall;
  }

  today(slug: string, date: string): TodayData {
    const user = this.user(slug);
    const checks = this.checksFor(slug, user.modeMut, date);
    const day = this.days.find((d) => d.userSlug === slug && d.date === date);
    const weighed = this.days
      .filter((d) => d.userSlug === slug && d.weightKg !== undefined)
      .sort((a, b) => b.date.localeCompare(a.date));
    const latestKg = weighed[0]?.weightKg ?? user.startKg;
    const wall = this.wallFor(user, date);
    const stats = computeStreakAndAdherence(wall, date);

    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const plan = user.modeMut === "survival" ? null : SESSION_PLAN[weekday];
    const session =
      plan === null || plan === undefined
        ? null
        : {
            name: plan.name,
            exercises: plan.exercises.map((ex) => {
              const recent = this.lifts
                .filter((l) => l.userSlug === slug && l.exercise === ex.name)
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 2);
              return { ...ex, lastKg: recent[0]?.topSetWeightKg ?? null, flag: overloadFlag(recent) };
            }),
          };

    return {
      user: {
        slug: user.slug,
        name: user.name,
        mode: user.modeMut,
        protocolTitle: user.protocolTitle,
        kitchenClose: user.kitchenClose,
        ceilingKg: user.ceilingMut,
        goalKg: user.goalKg,
        startKg: user.startKg,
        reviewDate: user.reviewDateMut ?? null,
        modeSince: user.modeSinceMut,
      },
      checks,
      day: {
        weightKg: day?.weightKg ?? null,
        stress: day?.stress ?? null,
        energy: day?.energy ?? null,
        ritualDone: day?.ritualDone ?? false,
      },
      latestKg,
      deltaKg: Math.round((latestKg - user.startKg) * 10) / 10,
      dayNumber: daysBetween(user.startDate, date) + 1,
      cravingsToday: this.cravings.filter((c) => c.userSlug === slug && c.date === date).length,
      stats: {
        adherence7: stats.adherence7,
        streak: stats.streak,
        todayDone: stats.todayDone,
        todayTotal: stats.todayTotal,
      },
      session,
      tripwire: tripwireFor(user.modeMut, user.goalKg, weighed[0]?.weightKg),
    };
  }

  crew(viewerSlug: string, date: string): CrewData {
    // Projection and scope enforcement live in the consent slice, so the demo
    // and Convex backends can only ever disclose the same fields.
    return consent.view(this, viewerSlug, date);
  }

  feed(): FeedData {
    return this.feedRows.slice(-20).map((r) => ({ name: r.name, message: r.message, at: r.at }));
  }

  progress(slug: string, date: string): ProgressData {
    const user = this.user(slug);
    const weighIns = this.days
      .filter((d) => d.userSlug === slug && d.weightKg !== undefined)
      .sort((a, b) => a.date.localeCompare(b.date));
    const series = weighIns.map((w) => ({
      date: w.date,
      actual: w.weightKg as number,
      target: targetKgFor(user.startKg, user.startDate, w.date),
    }));
    const wall = this.wallFor(user, date);
    const stats = computeStreakAndAdherence(wall, date);
    const latestKg = weighIns.length > 0 ? (weighIns[weighIns.length - 1].weightKg as number) : user.startKg;
    return {
      series,
      ceilingKg: user.ceilingMut,
      goalKg: user.goalKg,
      startKg: user.startKg,
      mode: user.modeMut,
      wall,
      adherence7: stats.adherence7,
      streak: stats.streak,
      deltaKg: Math.round((latestKg - user.startKg) * 10) / 10,
    };
  }

  research(slug: string, date: string): ResearchData {
    const from = addDays(date, -13);
    const window = this.cravings.filter(
      (c) => c.userSlug === slug && c.date >= from && c.date <= date,
    );
    const triggerMap = buildTriggerMap(window);
    return {
      triggerMap,
      engine: classifyEngine(window),
      peak: findPeak(triggerMap),
      totalCravings: window.length,
      experiments: this.experiments
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((e) => ({
          code: e.code,
          name: e.name,
          hypothesis: e.hypothesis,
          protocol: e.protocol,
          durationDays: e.durationDays,
          metric: e.metric,
          status: e.status,
          startDate: e.startDate ?? null,
          note: e.note ?? null,
        })),
      markers: this.markers
        .filter((m) => m.userSlug === slug)
        .map((m) => ({
          gene: m.gene,
          csvCall: m.csvCall,
          reportCall: m.reportCall,
          status: m.status,
          resolvesVia: m.resolvesVia,
          resolvedDate: null,
          method: null,
        })),
      labs: this.labs
        .filter((l) => l.userSlug === slug)
        .map((l) => ({
          date: l.date,
          marker: l.marker,
          value: l.value,
          unit: l.unit,
          note: l.note ?? null,
          recheckDate: l.recheckDate ?? null,
          recheckInDays: l.recheckDate ? Math.max(0, daysBetween(date, l.recheckDate)) : null,
        })),
      winterLayer: isWinterWindow(date),
    };
  }

  // ----- mutations -----

  toggleCheck(slug: string, date: string, key: string) {
    const user = this.user(slug);
    if (!MODE_CHECKS[user.modeMut].some((c) => c.key === key)) throw new Error("Unknown check");
    const row = this.checks.find((c) => c.userSlug === slug && c.date === date && c.key === key);
    if (row) row.done = !row.done;
    else this.checks.push({ userSlug: slug, date, key, done: true });
    this.bump();
  }

  private dayRow(slug: string, date: string) {
    let row = this.days.find((d) => d.userSlug === slug && d.date === date);
    if (!row) {
      row = { userSlug: slug, date };
      this.days.push(row);
    }
    return row;
  }

  logWeight(slug: string, date: string, weightKg: number) {
    this.dayRow(slug, date).weightKg = weightKg;
    this.bump();
  }

  logState(slug: string, date: string, patch: { stress?: number; energy?: number }) {
    const row = this.dayRow(slug, date);
    if (patch.stress !== undefined) row.stress = patch.stress;
    if (patch.energy !== undefined) row.energy = patch.energy;
    this.bump();
  }

  markRitual(slug: string, date: string) {
    this.dayRow(slug, date).ritualDone = true;
    this.bump();
  }

  logCraving(slug: string, date: string, entry: CravingEntry) {
    this.cravings.push({ userSlug: slug, date, ...entry });
    this.bump();
  }

  setMode(slug: string, date: string, mode: TmMode, reason?: string, reviewDate?: string) {
    const user = this.user(slug);
    if (user.modeMut === mode) return;
    user.modeMut = mode;
    user.modeSinceMut = date;
    user.reviewDateMut = reviewDate;
    // The configured ceiling survives a survival round trip (mirrors convex/tm/today.ts).
    user.ceilingMut = user.ceilingKg;
    const message =
      mode === "survival"
        ? `Survival mode on — floor protocol active${reviewDate ? `, review ${reviewDate}` : ""}. Executed as designed.`
        : `Mode → ${mode}.`;
    this.feedRows.push({ userSlug: slug, name: user.name, message, at: Date.now() });
    this.bump();
  }

  nudge(slug: string, message: string) {
    const user = this.user(slug);
    const trimmed = message.trim().slice(0, 200);
    if (!trimmed) return;
    this.feedRows.push({ userSlug: slug, name: user.name, message: trimmed, at: Date.now() });
    this.bump();
  }

  /* ===== Domain slices — views and mutations live in ./demo/<domain>.ts,
     mirroring the matching convex/tm/<domain>.ts handlers. ===== */

  fuel(slug: string, date: string): FuelData {
    return fuel.view(this, slug, date);
  }
  train(slug: string, date: string): TrainData {
    return train.view(this, slug, date);
  }
  stack(slug: string, date: string): StackData {
    return stack.view(this, slug, date);
  }
  labsView(slug: string, date: string): LabsData {
    return labsView.view(this, slug, date);
  }
  mind(slug: string, date: string): MindData {
    return mind.view(this, slug, date);
  }

  logFood(slug: string, date: string, slot: MealSlot, foodKey: string, grams: number) {
    fuel.logFood(this, slug, date, slot, foodKey, grams);
    this.bump();
  }
  setFoodEaten(entryId: string, eaten: boolean) {
    fuel.setFoodEaten(this, entryId, eaten);
    this.bump();
  }
  removeFood(entryId: string) {
    fuel.removeFood(this, entryId);
    this.bump();
  }
  generateMealPlan(slug: string, date: string) {
    fuel.generatePlan(this, slug, date);
    this.bump();
  }

  logSet(slug: string, date: string, exercise: string, setIndex: number, weightKg: number, reps: number, rir: number) {
    train.logSet(this, slug, date, exercise, setIndex, weightKg, reps, rir);
    this.bump();
  }
  startMesocycle(slug: string, date: string, goal: "hypertrophy" | "strength" | "recomp") {
    train.startMesocycle(this, slug, date, goal);
    this.bump();
  }

  logDose(slug: string, date: string, itemId: string, timing: string, taken: boolean, site?: string) {
    stack.logDose(this, slug, date, itemId, timing, taken, site);
    this.bump();
  }
  setStackItemActive(itemId: string, active: boolean) {
    stack.setItemActive(this, itemId, active);
    this.bump();
  }

  addLabPanel(slug: string, date: string, name: string, results: LabResultInput[], fasted?: boolean) {
    labsView.addPanel(this, slug, date, name, results, fasted);
    this.bump();
  }

  submitAssessment(slug: string, date: string, instrument: string, answers: number[]) {
    mind.submitAssessment(this, slug, date, instrument, answers);
    this.bump();
  }
  addIntention(slug: string, date: string, trigger: string, action: string) {
    mind.addIntention(this, slug, date, trigger, action);
    this.bump();
  }
  markIntentionWin(intentionId: string) {
    mind.markIntentionWin(this, intentionId);
    this.bump();
  }
  saveReflection(slug: string, date: string, prompt: string, response: string, win?: string) {
    mind.saveReflection(this, slug, date, prompt, response, win);
    this.bump();
  }

  handsFree(slug: string, date: string): HandsFreeData {
    return ingest.view(this, slug, date);
  }
  createIngestToken(slug: string, date: string, label: string) {
    ingest.createToken(this, slug, date, label);
    this.bump();
  }
  revokeIngestToken(tokenId: string) {
    ingest.revokeToken(this, tokenId);
    this.bump();
  }
  setA11yProfile(slug: string, profile: "standard" | "easy") {
    this.user(slug).a11yProfileMut = profile;
    this.bump();
  }

  supply(slug: string, date: string): SupplyData {
    return supply.view(this, slug, date);
  }
  setSupplyCount(slug: string, date: string, itemId: string, onHand: number) {
    supply.setCount(this, slug, date, itemId, onHand);
    this.bump();
  }
  saveContact(slug: string, kind: "gp" | "pharmacy", name: string, phone: string) {
    supply.saveContact(this, slug, kind, name, phone);
    this.bump();
  }
  inviteCrew(slug: string, date: string, targetSlug: string, scopes: string[]) {
    consent.invite(this, slug, date, targetSlug, scopes);
    this.bump();
  }
  respondToCrewInvite(slug: string, date: string, linkId: string, accept: boolean) {
    consent.respond(this, slug, date, linkId, accept);
    this.bump();
  }
  revokeCrewLink(slug: string, date: string, linkId: string) {
    consent.revoke(this, slug, date, linkId);
    this.bump();
  }
}
