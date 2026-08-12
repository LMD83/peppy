export type TmMode = "cut" | "maintain" | "survival";

export const MODE_CHECKS: Record<TmMode, { key: string; label: string }[]> = {
  cut: [
    { key: "session", label: "Session done" },
    { key: "plan", label: "Ate on plan" },
    { key: "salt", label: "Salt under 2 g" },
    { key: "steps", label: "8k+ steps" },
    { key: "supps", label: "Supps taken" },
  ],
  maintain: [
    { key: "kitchen", label: "Kitchen closed" },
    { key: "protein", label: "Protein hit" },
    { key: "steps", label: "Steps" },
    { key: "weighin", label: "Weigh-in logged" },
  ],
  survival: [
    { key: "protein", label: "Protein hit" },
    { key: "steps", label: "Steps" },
    { key: "kitchen", label: "Kitchen closed 20:30" },
  ],
};

// Weekly training template. Static config, not user data.
export const SESSION_PLAN: Record<number, { name: string; exercises: { name: string; repRange: string }[] } | null> = {
  1: {
    name: "Upper · push",
    exercises: [
      { name: "Bench press", repRange: "8–12" },
      { name: "Overhead press", repRange: "8–12" },
      { name: "Incline DB press", repRange: "10–12" },
      { name: "Triceps pushdown", repRange: "12–15" },
    ],
  },
  2: {
    name: "Lower",
    exercises: [
      { name: "Squat", repRange: "6–10" },
      { name: "Romanian deadlift", repRange: "8–12" },
      { name: "Leg press", repRange: "10–12" },
      { name: "Calf raise", repRange: "12–15" },
    ],
  },
  3: null,
  4: {
    name: "Upper · pull",
    exercises: [
      { name: "Barbell row", repRange: "8–12" },
      { name: "Lat pulldown", repRange: "8–12" },
      { name: "Face pull", repRange: "12–15" },
      { name: "Curl", repRange: "10–12" },
    ],
  },
  5: {
    name: "Full body",
    exercises: [
      { name: "Deadlift", repRange: "5–8" },
      { name: "DB bench", repRange: "8–12" },
      { name: "Barbell row", repRange: "8–12" },
      { name: "Curl", repRange: "10–12" },
    ],
  },
  6: null,
  0: null,
};

export const OVERLOAD_REPS = 12;
export const OVERLOAD_INCREMENT_KG = 2.5;
export const CUT_RATE_KG_PER_WEEK = 0.5;
export const SOFT_TRIPWIRE_KG = 2;
export const HARD_TRIPWIRE_KG = 3.5;
export const SURVIVAL_CEILING_OFFSET_KG = 4;

const enc = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
