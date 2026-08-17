import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type TodayData = FunctionReturnType<typeof api.tm.today.get>;
export type CrewData = FunctionReturnType<typeof api.tm.crew.board>;
export type FeedData = FunctionReturnType<typeof api.tm.crew.feed>;
export type ProgressData = FunctionReturnType<typeof api.tm.progress.get>;
export type ResearchData = FunctionReturnType<typeof api.tm.research.get>;
export type FuelData = FunctionReturnType<typeof api.tm.fuel.get>;
export type TrainData = FunctionReturnType<typeof api.tm.train.get>;
export type StackData = FunctionReturnType<typeof api.tm.stack.get>;
export type LabsData = FunctionReturnType<typeof api.tm.labs.get>;
export type MindData = FunctionReturnType<typeof api.tm.mind.get>;
export type SupplyData = FunctionReturnType<typeof api.tm.supply.get>;
export type HandsFreeData = FunctionReturnType<typeof api.tm.ingest.get>;
export type ShopData = FunctionReturnType<typeof api.tm.shop.get>;
export type RemindData = FunctionReturnType<typeof api.tm.remind.get>;

export type TmSession = { token: string; slug: string; name: string };

export type CravingEntry = {
  time: string;
  signal: "tired" | "emotion" | "cue" | "bored" | "hungry";
  emotionWord?: string;
  afterState?: "relief" | "guilt" | "numb" | "satisfied";
  action?: "rode" | "substitute" | "ate";
};

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type LabResultInput = { marker: string; value: number; unit: string };

export type TimentoActions = {
  login: (slug: string, passcode: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  toggleCheck: (key: string) => void;
  logWeight: (weightKg: number) => void;
  logState: (patch: { stress?: number; energy?: number }) => void;
  markRitual: () => void;
  /** Commits on the signal tap alone; resolves the new entry's id, or null if it did not land. */
  logCraving: (entry: CravingEntry) => Promise<string | null>;
  /**
   * Patches an already-committed entry — never the write that decides whether it
   * was logged. A corrected signal comes through here too, so a mis-tap is one
   * patch on one row rather than an insert racing a delete.
   *
   * Resolves false when the patch did not land, so the card can say so instead
   * of showing a change that never reached the file.
   */
  enrichCraving: (
    id: string,
    patch: {
      signal?: CravingEntry["signal"];
      emotionWord?: string;
      afterState?: CravingEntry["afterState"];
      action?: CravingEntry["action"];
    },
  ) => Promise<boolean>;
  undoCraving: (id: string) => void;
  markSessionDone: () => void;
  setMode: (mode: "cut" | "maintain" | "survival", reason?: string, reviewDate?: string) => void;
  nudge: (message: string) => void;

  /* fuel */
  logFood: (slot: MealSlot, foodKey: string, grams: number) => void;
  setFoodEaten: (entryId: string, eaten: boolean) => void;
  removeFood: (entryId: string) => void;
  generateMealPlan: (today?: {
    minutes?: number;
    equipment?: "none" | "kettle" | "microwave" | "one-pan" | "oven";
    oneHanded?: boolean;
    canStand?: boolean;
  }) => void;
  logMenu: (slot: MealSlot, items: { foodKey: string; grams: number }[]) => void;
  saveMenu: (name: string, slot: MealSlot, items: { foodKey: string; grams: number }[]) => void;
  copyYesterday: () => void;
  generateWeek: (today?: {
    minutes?: number;
    equipment?: "none" | "kettle" | "microwave" | "one-pan" | "oven";
    oneHanded?: boolean;
    canStand?: boolean;
  }) => void;
  setKitchen: (patch: {
    minutes?: number;
    equipment?: "none" | "kettle" | "microwave" | "one-pan" | "oven";
    oneHanded?: boolean;
    canStand?: boolean;
    pinnedBreakfast?: string | null;
  }) => void;
  swapFood: (entryId: string, foodKey: string) => void;

  /* train */
  logSet: (exercise: string, setIndex: number, weightKg: number, reps: number, rir: number) => void;
  startMesocycle: (goal: "hypertrophy" | "strength" | "recomp") => void;
  saveTrainProfile: (profile: {
    setting: "home" | "gym" | "box";
    kit: string[];
    experience: "new" | "returning" | "trained";
    ageBand: "under-40" | "40-59" | "60-plus";
    minutes: number;
    constraints: string[];
  }) => void;
  swapTrainBlock: (exercise: string, replacement: string) => void;

  /* stack */
  logDose: (itemId: string, timing: string, taken: boolean, site?: string) => void;
  setStackItemActive: (itemId: string, active: boolean) => void;

  /* labs */
  addLabPanel: (name: string, results: LabResultInput[], fasted?: boolean) => void;

  /* accessibility — "easy" is a mode, not a preference toggle */
  setA11yProfile: (profile: "standard" | "easy") => void;

  /* hands-free */
  createIngestToken: (label: string) => void;
  revokeIngestToken: (tokenId: string) => void;

  /* crew consent — sharing adherence is sharing health data */
  inviteCrew: (slug: string, scopes: string[], relationship?: "crew" | "carer") => void;
  respondToCrewInvite: (linkId: string, accept: boolean) => void;
  revokeCrewLink: (linkId: string) => void;

  /* reminders */
  savePushSubscription: (sub: { endpoint: string; p256dh: string; auth: string; label: string }) => void;
  removePushSubscription: (endpoint: string) => void;
  setReminderPrefs: (prefs: {
    enabled?: boolean;
    quietFrom?: string;
    quietTo?: string;
    doses?: boolean;
    supply?: boolean;
    checkins?: boolean;
    rechecks?: boolean;
    scripts?: boolean;
    email?: string;
  }) => void;

  /* visual check-ins */
  saveCapture: (kind: "dose" | "meal" | "organiser", storageId: string, note?: string) => void;
  removeCapture: (captureId: string) => void;

  /* shopping */
  setPantry: (foodKey: string, grams: number) => void;
  clearPantry: () => void;

  /* supply */
  setSupplyCount: (itemId: string, onHand: number) => void;
  saveContact: (kind: "gp" | "pharmacy", name: string, phone: string) => void;

  /* mind */
  submitAssessment: (instrument: string, answers: number[]) => void;
  addIntention: (trigger: string, action: string) => void;
  markIntentionWin: (intentionId: string) => void;
  saveReflection: (prompt: string, response: string, win?: string) => void;
};

export type TimentoState = {
  demo: boolean;
  date: string;
  session: TmSession | null;
  authReady: boolean;
  today: TodayData | undefined;
  crew: CrewData | undefined;
  feed: FeedData | undefined;
  progress: ProgressData | undefined;
  research: ResearchData | undefined;
  fuel: FuelData | undefined;
  train: TrainData | undefined;
  stack: StackData | undefined;
  labs: LabsData | undefined;
  mind: MindData | undefined;
  supply: SupplyData | undefined;
  handsFree: HandsFreeData | undefined;
  shop: ShopData | undefined;
  remind: RemindData | undefined;
  actions: TimentoActions;
};

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function localTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
