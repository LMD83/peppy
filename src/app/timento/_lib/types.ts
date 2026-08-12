import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type TodayData = FunctionReturnType<typeof api.tm.today.get>;
export type CrewData = FunctionReturnType<typeof api.tm.crew.board>;
export type FeedData = FunctionReturnType<typeof api.tm.crew.feed>;
export type ProgressData = FunctionReturnType<typeof api.tm.progress.get>;
export type ResearchData = FunctionReturnType<typeof api.tm.research.get>;

export type TmSession = { token: string; slug: string; name: string };

export type CravingEntry = {
  time: string;
  signal: "tired" | "emotion" | "cue" | "bored" | "hungry";
  emotionWord?: string;
  afterState?: "relief" | "guilt" | "numb" | "satisfied";
  action?: "rode" | "substitute" | "ate";
};

export type TimentoActions = {
  login: (slug: string, passcode: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  toggleCheck: (key: string) => void;
  logWeight: (weightKg: number) => void;
  logState: (stress: number, energy: number) => void;
  markRitual: () => void;
  logCraving: (entry: CravingEntry) => void;
  setMode: (mode: "cut" | "maintain" | "survival", reason?: string, reviewDate?: string) => void;
  nudge: (message: string) => void;
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
