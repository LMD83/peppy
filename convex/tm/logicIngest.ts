/**
 * Pure hands-free parsing — a spoken phrase resolved against the user's own file.
 *
 * Shared verbatim between the HTTP ingest endpoints (convex/http.ts →
 * convex/tm/ingest.ts) and the in-app dictation control, so a phrase means the
 * same thing whether it arrives from a locked Apple Watch or from the browser.
 *
 * Deterministic by construction: no Date.now(), no Math.random(), no network,
 * no model. Everything is a table lookup, an edit distance and a comparison.
 *
 * The rule this module exists to enforce: **an ambiguous phrase resolves to
 * nothing.** Writing the wrong dose is worse than writing none, so a parse that
 * cannot separate two candidates returns them both as `alternatives` and leaves
 * `match` null. Nothing here decides what someone should take, or how much —
 * it only recognises names that are already on their own file.
 */

/* ===== the candidate shapes ===== */

/** Structurally satisfied by `StackItem` — the user's own configured items. */
export type DoseCandidate = {
  id: string;
  name: string;
  timings: string[];
  active: boolean;
};

/** Structurally satisfied by `FoodDef` — the shared food catalogue. */
export type FoodCandidate = {
  key: string;
  name: string;
  portionG: number;
};

export type IngestSlot = "breakfast" | "lunch" | "dinner" | "snack";

/** Why a parse ended where it did, in words a person can act on. */
export type ParseReason = "ok" | "empty" | "no-match" | "ambiguous" | "no-timing";

/* ===== thresholds ===== */

/** Below this a name is not recognised at all. */
export const MIN_SCORE = 0.55;
/** Two candidates this close cannot be told apart, so neither is chosen. */
export const AMBIGUITY_GAP = 0.15;
/** A single token has to be this similar before it counts as the same word. */
export const TOKEN_SIM = 0.7;
/** Never offer more than a person can hold in their head at once. */
export const MAX_ALTERNATIVES = 3;
/** Matches fuel's own ceiling; the fuel mutation remains the authority. */
export const MAX_GRAMS = 3000;

export const INGEST_NOTE =
  "Hands-free logging recognises names already on your file and nothing else. It never invents an item, a dose or a portion, and an unclear phrase is offered back to you rather than guessed at.";

/* ===== normalisation ===== */

/** Words that carry no meaning in a log phrase. Removed before matching. */
export const FILLER: ReadonlySet<string> = new Set([
  "i", "ive", "im", "just", "took", "take", "taken", "taking", "had", "have",
  "has", "my", "me", "the", "a", "an", "some", "of", "at", "on", "in", "please",
  "hey", "siri", "log", "logged", "logging", "record", "and", "then", "for",
  "to", "it", "that", "this", "now", "today", "already", "done", "eat", "ate",
  "eaten", "eating", "was", "were", "is", "get", "got", "with",
]);

/**
 * The whole-stack phrase. "Hey Siri, took my morning tablets" is the headline
 * the owner asked for, so the words people actually say for it are listed here
 * rather than inferred.
 */
export const BULK_WORDS: ReadonlySet<string> = new Set([
  "tablets", "pills", "meds", "medication", "medicine", "everything", "all",
  "supplements", "doses",
]);

/**
 * Mishearings a phone's dictation actually produces, heard → canonical. Small
 * and explicit on purpose: edit distance covers the long tail, and a table that
 * grows without evidence is a table that starts inventing matches.
 */
export const MISHEARD: Readonly<Record<string, string>> = {
  foreman: "metformin",
  metaformin: "metformin",
  metformine: "metformin",
  metaphor: "metformin",
  atorvastin: "atorvastatin",
  torvastatin: "atorvastatin",
  creating: "creatine",
  creatin: "creatine",
  cretin: "creatine",
  magnesia: "magnesium",
  magnesiam: "magnesium",
  vitamine: "vitamin",
  vitamen: "vitamin",
  vitamins: "vitamin",
  omaha: "omega",
  omegas: "omega",
  tabs: "tablets",
  tablet: "tablets",
  pill: "pills",
  med: "meds",
  medications: "medication",
  medicines: "medicine",
  porage: "porridge",
  porrige: "porridge",
  yoghurt: "yogurt",
  yoghourt: "yogurt",
  greeked: "greek",
};

/** Spoken numbers, so "two eggs" and "2 eggs" are the same sentence. */
export const NUMBER_WORDS: Readonly<Record<string, number>> = {
  half: 0.5, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

const GRAM_WORDS: ReadonlySet<string> = new Set(["g", "gram", "grams", "gs", "gm", "gms"]);

/** Strip a plural only where it cannot change a short word into another one. */
function singular(token: string): string {
  if (token.length >= 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length >= 4 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

/**
 * Speech into comparable tokens.
 *
 * Lowercases, drops punctuation and possessives, splits letter/digit runs
 * ("d3" → "d", "3"; "b12" → "b", "12") so a dictated "vitamin d three" lines up
 * with a catalogue "Vitamin D3", turns spoken numbers into digits, applies the
 * mishearing table, then singularises. Filler is kept out of the result.
 */
export function tokenise(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[‘’']/g, "")
    // A full stop is punctuation unless it sits between digits, where it is
    // half of "one point five".
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned === "") return [];

  const out: string[] = [];
  for (const raw of cleaned.split(" ")) {
    // "d3" and "3kg" are one spoken word but two ideas.
    for (const piece of raw.split(/(?<=[a-z])(?=[0-9])|(?<=[0-9])(?=[a-z])/)) {
      if (piece === "" || piece === ".") continue;
      const numeric = NUMBER_WORDS[piece];
      const token = numeric !== undefined ? String(numeric) : singular(MISHEARD[piece] ?? piece);
      const canonical = MISHEARD[token] ?? token;
      if (canonical === "" || FILLER.has(canonical)) continue;
      out.push(canonical);
    }
  }
  return out;
}

/** What was heard, tidied — echoed back so nobody has to wonder. */
export function heardPhrase(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

/* ===== similarity ===== */

/** Edit distance, abandoned once it passes `max`. Bounded and allocation-light. */
export function levenshtein(a: string, b: string, max = 4): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array<number>(b.length + 1);
  const cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let best = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

/**
 * 0..1 similarity between two spoken words. Short tokens have to match exactly:
 * "d" and "b" are one edit apart and mean entirely different supplements.
 */
export function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  if (longest <= 3) return 0;
  const dist = levenshtein(a, b, 3);
  const lev = 1 - dist / longest;
  // A dictated word is often cut short ("atorva" for "atorvastatin").
  const shortest = Math.min(a.length, b.length);
  const prefix = shortest >= 4 && a.slice(0, shortest) === b.slice(0, shortest) ? 0.85 : 0;
  return Math.max(lev, prefix);
}

/**
 * How well a catalogue name is present in what was heard. Every word of the
 * name must be accounted for; a name whose distinctive word is missing scores
 * near zero rather than riding in on a shared word like "vitamin".
 */
export function nameScore(name: string, heard: string[]): number {
  const nameTokens = tokenise(name);
  if (nameTokens.length === 0 || heard.length === 0) return 0;
  let total = 0;
  let anyStrong = false;
  for (const nt of nameTokens) {
    let best = 0;
    for (const ht of heard) {
      const sim = wordSimilarity(nt, ht);
      if (sim > best) best = sim;
    }
    if (best >= TOKEN_SIM) {
      total += best;
      anyStrong = true;
    }
  }
  if (!anyStrong) return 0;
  return Math.min(1, total / nameTokens.length);
}

type Scored = { score: number; name: string };

/** Worst-case-stable ordering: score desc, then name, so a list never jitters. */
function byScore<T extends Scored>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/**
 * The decision that keeps this safe. A clear winner is returned; a near-tie is
 * refused and handed back as alternatives.
 */
function resolve<T extends Scored>(scored: T[]): { best: T | null; alternatives: T[]; reason: ParseReason } {
  const ranked = byScore(scored).filter((r) => r.score > 0);
  if (ranked.length === 0) return { best: null, alternatives: [], reason: "no-match" };

  // Ambiguity is checked before the confidence floor on purpose. Two names that
  // share their only recognised word ("magnesium glycinate", "magnesium
  // citrate") both score below the floor, and "I could not tell which" is a
  // truer thing to say back than "I did not recognise that".
  const top = ranked[0];
  const contenders = ranked.filter((r) => top.score - r.score < AMBIGUITY_GAP);
  if (contenders.length > 1) {
    return { best: null, alternatives: contenders.slice(0, MAX_ALTERNATIVES), reason: "ambiguous" };
  }
  if (top.score < MIN_SCORE) {
    return { best: null, alternatives: ranked.slice(0, MAX_ALTERNATIVES), reason: "no-match" };
  }
  return { best: top, alternatives: ranked.slice(1, MAX_ALTERNATIVES + 1), reason: "ok" };
}

/* ===== timings ===== */

/** Spoken time-of-day → the timing key the stack already uses. */
const TIMING_WORDS: ReadonlyArray<{ words: string[]; timing: string }> = [
  { words: ["morning", "am", "breakfast", "waking", "wake"], timing: "am" },
  { words: ["preworkout", "workout", "gym", "training", "train"], timing: "pre-workout" },
  { words: ["bedtime", "bed", "sleep", "overnight"], timing: "pre-bed" },
  { words: ["evening", "pm", "night", "tonight", "dinner", "teatime", "tea"], timing: "pm" },
];

export function timingFromTokens(tokens: string[]): string | null {
  const set = new Set(tokens);
  for (const row of TIMING_WORDS) {
    for (const w of row.words) if (set.has(singular(w))) return row.timing;
  }
  return null;
}

/* ===== the dose parse ===== */

export type DoseMatch = {
  /** "item" — one named thing. "all" — the whole-stack phrase. */
  scope: "item" | "all";
  itemIds: string[];
  /** What will be written, in the words it will be written in. */
  name: string;
  timing: string;
  score: number;
};

export type DoseParse = {
  match: DoseMatch | null;
  /** 0..1. The score of the winner, or of the closest thing to one. */
  confidence: number;
  alternatives: DoseMatch[];
  reason: ParseReason;
  /** What was heard, echoed back verbatim so nothing is silently discarded. */
  heard: string;
};

function emptyDose(heard: string, reason: ParseReason): DoseParse {
  return { match: null, confidence: 0, alternatives: [], reason, heard };
}

/**
 * "took my metformin" → that item. "took my morning tablets" → everything due
 * in the morning. "took my vitamin" with two vitamins on file → neither, and
 * both handed back.
 *
 * `preferredTiming` is what the caller already knows (a Shortcut can be built
 * per time of day); it is used only when the phrase itself does not say.
 */
export function parseDoseUtterance(
  text: string,
  items: DoseCandidate[],
  preferredTiming?: string,
): DoseParse {
  const heard = heardPhrase(text);
  const tokens = tokenise(text);
  if (tokens.length === 0) return emptyDose(heard, "empty");

  const active = items.filter((i) => i.active && i.timings.length > 0);
  if (active.length === 0) return emptyDose(heard, "no-match");

  const spokenTiming = timingFromTokens(tokens);
  const timing = spokenTiming ?? (preferredTiming ?? null);

  const scored = active.map((i) => ({ item: i, name: i.name, score: nameScore(i.name, tokens) }));
  const { best, alternatives, reason } = resolve(scored);

  const toMatch = (row: { item: DoseCandidate; name: string; score: number }, t: string): DoseMatch => ({
    scope: "item",
    itemIds: [row.item.id],
    name: row.name,
    timing: t,
    score: row.score,
  });

  if (best) {
    // The item names its own timings; a spoken one that the item does not carry
    // is a mishearing, not an instruction.
    const usable = timing !== null && best.item.timings.includes(timing) ? timing : null;
    const resolved = usable ?? (best.item.timings.length === 1 ? best.item.timings[0] : null);
    if (resolved === null) {
      return {
        match: null,
        confidence: best.score,
        alternatives: best.item.timings.map((t) => toMatch(best, t)),
        reason: "no-timing",
        heard,
      };
    }
    return {
      match: toMatch(best, resolved),
      confidence: best.score,
      alternatives: alternatives.map((r) => toMatch(r, r.item.timings[0])),
      reason: "ok",
      heard,
    };
  }

  // No single item recognised. The whole-stack phrase is the other thing people
  // actually say, and it is only honoured when a time of day pins it down.
  const bulk = tokens.some((t) => BULK_WORDS.has(t) || BULK_WORDS.has(`${t}s`));
  if (bulk && reason === "no-match") {
    const timings = timing !== null ? [timing] : distinctTimings(active);
    if (timings.length === 1) {
      const due = active.filter((i) => i.timings.includes(timings[0]));
      if (due.length > 0) {
        return {
          match: {
            scope: "all",
            itemIds: due.map((i) => i.id),
            name: `${due.length} item${due.length === 1 ? "" : "s"}`,
            timing: timings[0],
            score: 1,
          },
          confidence: 1,
          alternatives: [],
          reason: "ok",
          heard,
        };
      }
    }
    return {
      match: null,
      confidence: 0,
      alternatives: distinctTimings(active).map((t) => ({
        scope: "all" as const,
        itemIds: active.filter((i) => i.timings.includes(t)).map((i) => i.id),
        name: `everything at ${t}`,
        timing: t,
        score: 0,
      })),
      reason: "no-timing",
      heard,
    };
  }

  return {
    match: null,
    confidence: alternatives.length > 0 ? alternatives[0].score : 0,
    alternatives: alternatives.map((r) => toMatch(r, r.item.timings[0])),
    reason,
    heard,
  };
}

function distinctTimings(items: DoseCandidate[]): string[] {
  const set = new Set<string>();
  for (const i of items) for (const t of i.timings) set.add(t);
  return [...set].sort();
}

/* ===== the food parse ===== */

export type FoodMatch = {
  foodKey: string;
  name: string;
  grams: number;
  slot: IngestSlot;
  score: number;
  /** True when nobody said a quantity and the catalogue portion was used. */
  portionAssumed: boolean;
  /** True when nobody said a meal and it landed in the neutral bucket. */
  slotAssumed: boolean;
};

export type FoodParse = {
  match: FoodMatch | null;
  confidence: number;
  alternatives: FoodMatch[];
  reason: ParseReason;
  heard: string;
};

const SLOT_WORDS: ReadonlyArray<{ words: string[]; slot: IngestSlot }> = [
  { words: ["breakfast", "morning"], slot: "breakfast" },
  { words: ["lunch", "lunchtime", "midday"], slot: "lunch" },
  { words: ["dinner", "tea", "teatime", "supper", "evening"], slot: "dinner" },
  { words: ["snack", "snacking"], slot: "snack" },
];

export function slotFromTokens(tokens: string[]): IngestSlot | null {
  const set = new Set(tokens);
  for (const row of SLOT_WORDS) {
    for (const w of row.words) if (set.has(singular(w))) return row.slot;
  }
  return null;
}

function numeric(token: string | undefined): number | null {
  if (token === undefined || token === "") return null;
  const n = Number(token);
  return Number.isFinite(n) ? n : null;
}

/**
 * "two hundred" is two spoken words and one number. Folds a run of numerals
 * back into the number a person meant: N × 100 for a hundreds phrase, and
 * tens + units for "twenty five".
 */
export function composeNumberRuns(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let value = numeric(tokens[i]);
    if (value === null) {
      out.push(tokens[i]);
      i += 1;
      continue;
    }
    let j = i + 1;
    for (;;) {
      const next = numeric(tokens[j]);
      if (next === null) break;
      if (next === 100 && value < 100) value *= 100;
      else if (value >= 10 && value % 10 === 0 && next < 10) value += next;
      else if (value >= 100 && value % 100 === 0 && next < 100) value += next;
      else break;
      j += 1;
    }
    out.push(String(value));
    i = j;
  }
  return out;
}

/**
 * A quantity, if one was actually said. Explicit grams win; a bare number is
 * read as a count of catalogue portions. Nothing is inferred from the food
 * itself — an unquantified phrase says so.
 */
export function quantityFromTokens(raw: string[]): { grams: number | null; count: number | null } {
  const tokens = composeNumberRuns(raw);
  for (let i = 0; i < tokens.length - 1; i++) {
    const n = numeric(tokens[i]);
    if (n !== null && n > 0 && GRAM_WORDS.has(tokens[i + 1])) {
      return { grams: Math.min(Math.round(n), MAX_GRAMS), count: null };
    }
  }
  for (let i = 0; i < tokens.length; i++) {
    const n = numeric(tokens[i]);
    // A digit straight after a single letter is a product name — the 3 in
    // "vitamin D3", the 12 in "B12" — never a count of portions.
    if (i > 0 && tokens[i - 1].length === 1 && !/[0-9]/.test(tokens[i - 1])) continue;
    if (n !== null && n > 0 && n <= 20) return { grams: null, count: n };
  }
  return { grams: null, count: null };
}

/**
 * "two hundred grams of chicken breast for lunch" → 200 g of chicken breast,
 * lunch. "porridge" → one catalogue portion, in the neutral bucket, flagged as
 * assumed on both counts so the screen can say so.
 */
export function parseFoodUtterance(
  text: string,
  foods: FoodCandidate[],
  preferredSlot?: IngestSlot,
): FoodParse {
  const heard = heardPhrase(text);
  const tokens = tokenise(text);
  if (tokens.length === 0) return { match: null, confidence: 0, alternatives: [], reason: "empty", heard };
  if (foods.length === 0) return { match: null, confidence: 0, alternatives: [], reason: "no-match", heard };

  const spokenSlot = slotFromTokens(tokens);
  const slot: IngestSlot = spokenSlot ?? preferredSlot ?? "snack";
  const slotAssumed = spokenSlot === null && preferredSlot === undefined;
  const qty = quantityFromTokens(tokens);

  const scored = foods.map((f) => ({ food: f, name: f.name, score: nameScore(f.name, tokens) }));
  const { best, alternatives, reason } = resolve(scored);

  const toMatch = (row: { food: FoodCandidate; name: string; score: number }): FoodMatch => {
    const portion = Number.isFinite(row.food.portionG) && row.food.portionG > 0 ? row.food.portionG : 100;
    const grams =
      qty.grams !== null
        ? qty.grams
        : qty.count !== null
          ? Math.min(Math.round(qty.count * portion), MAX_GRAMS)
          : portion;
    return {
      foodKey: row.food.key,
      name: row.name,
      grams,
      slot,
      score: row.score,
      portionAssumed: qty.grams === null && qty.count === null,
      slotAssumed,
    };
  };

  return {
    match: best ? toMatch(best) : null,
    confidence: best ? best.score : alternatives.length > 0 ? alternatives[0].score : 0,
    alternatives: alternatives.map(toMatch),
    reason,
    heard,
  };
}

/* ===== tokens: shape, masking, and the words the setup screen needs ===== */

/** Opaque, URL-safe, and long enough that guessing is not a strategy. */
export const TOKEN_BYTES = 24;
export const TOKEN_PREFIX = "tmnt_";

/**
 * A token a person can recognise without it being a token anyone can use.
 * Keeps the prefix and the last four characters; everything else is gone.
 */
export function maskToken(token: string): string {
  const body = token.startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length) : token;
  const tail = body.slice(-4);
  return `${TOKEN_PREFIX}${"•".repeat(8)}${tail}`;
}

export type ShortcutStep = { n: number; title: string; detail: string; copy: string | null };

export type ShortcutRecipe = {
  /** The exact URL the Shortcut posts to. */
  url: string;
  method: "POST";
  headers: { name: string; value: string }[];
  /** The JSON body, pretty-printed and ready to paste. */
  body: string;
  /** What to say, out loud, once it is set up. */
  phrase: string;
  steps: ShortcutStep[];
};

const PLACEHOLDER = "YOUR-TOKEN";
const PLACEHOLDER_HOST = "https://YOUR-DEPLOYMENT.convex.site";

/**
 * The copy-paste setup. Written for someone who is tired: numbered, one field
 * per step, and every field is a thing to copy rather than a thing to retype.
 */
export function buildShortcutRecipe(
  endpoint: string,
  token: string | null,
  timing = "am",
): ShortcutRecipe {
  const url = `${endpoint === "" ? PLACEHOLDER_HOST : endpoint}/ingest/dose`;
  const body = JSON.stringify(
    { token: token ?? PLACEHOLDER, text: "took my morning tablets", timing },
    null,
    2,
  );
  return {
    url,
    method: "POST",
    headers: [{ name: "Content-Type", value: "application/json" }],
    body,
    phrase: "Hey Siri, took my morning tablets",
    steps: [
      { n: 1, title: "Open Shortcuts on your iPhone", detail: "Tap the + to start a new shortcut.", copy: null },
      { n: 2, title: "Add the action “Get contents of URL”", detail: "Search for it in the action list.", copy: null },
      { n: 3, title: "Paste this address", detail: "It is the only address this shortcut ever calls.", copy: url },
      { n: 4, title: "Set the method to POST", detail: "Tap “Show More”, then change GET to POST.", copy: null },
      { n: 5, title: "Set the request body to JSON and paste this", detail: "Your token is already in it. Treat it like a password.", copy: body },
      { n: 6, title: "Name the shortcut “Took my morning tablets”", detail: "The name is the phrase Siri listens for.", copy: "Took my morning tablets" },
      { n: 7, title: "Say it", detail: "Works from a locked phone and from an Apple Watch.", copy: null },
    ],
  };
}

/* ===== the view both backends build ===== */

export type IngestTokenRow = {
  id: string;
  token: string;
  label: string;
  createdDate: string;
  lastUsedAt?: number;
  revoked: boolean;
};

/** A write on the file that the hands-free path is capable of making. */
export type IngestRecentRow = {
  id: string;
  kind: "dose" | "food";
  label: string;
  detail: string;
  date: string;
  at: number;
};

export type IngestTokenView = {
  id: string;
  label: string;
  createdDate: string;
  lastUsedAt: number | null;
  revoked: boolean;
  /** The only form of the token this query ever returns. */
  masked: string;
  /** True until the token authenticates for the first time. */
  neverUsed: boolean;
};

export type RecentWrite = IngestRecentRow;

export type SpokenPhrase = { text: string; meaning: string };

export type HandsFreeView = {
  tokens: IngestTokenView[];
  /** Base URL of the ingest endpoints. Empty when no deployment is configured. */
  endpoint: string;
  endpointReady: boolean;
  /**
   * The full token, shown exactly once.
   *
   * A token is legible here only while it has never been used. The first
   * successful call stamps it and it is masked from then on, for good — so the
   * setup screen's "test it now" button doubles as the thing that puts the
   * secret away. Nothing brings it back; a lost token is replaced, not recovered.
   */
  pendingSecret: string | null;
  recent: RecentWrite[];
  recentNote: string;
  shortcutRecipe: ShortcutRecipe;
  phrases: SpokenPhrase[];
  survival: boolean;
  note: string;
};

export type HandsFreeViewInput = {
  mode: "cut" | "maintain" | "survival";
  date: string;
  endpoint: string;
  tokens: IngestTokenRow[];
  recent: IngestRecentRow[];
  /** Timings the user's own items actually carry, for the recipe's example. */
  timings: string[];
};

export const MAX_RECENT = 10;

export const RECENT_NOTE =
  "The last ten dose and food entries on your file. How an entry arrived is not stored, so a spoken log and a tap look the same here.";

export const PHRASES: SpokenPhrase[] = [
  { text: "Took my morning tablets", meaning: "Marks everything scheduled for the morning as taken." },
  { text: "Took my metformin", meaning: "One named item, when the name is on your own file." },
  { text: "Ate two hundred grams of chicken breast for lunch", meaning: "One food, one portion, one meal." },
  { text: "Had porridge", meaning: "One catalogue portion, filed as a snack unless you say otherwise." },
];

function sortTokens(rows: IngestTokenRow[]): IngestTokenRow[] {
  // Live tokens first, then newest — a revoked token is history, not an option.
  return [...rows].sort(
    (a, b) =>
      Number(a.revoked) - Number(b.revoked) ||
      b.createdDate.localeCompare(a.createdDate) ||
      a.label.localeCompare(b.label),
  );
}

export function buildHandsFreeView(input: HandsFreeViewInput): HandsFreeView {
  const survival = input.mode === "survival";
  const sorted = sortTokens(input.tokens);

  const tokens: IngestTokenView[] = sorted.map((t) => ({
    id: t.id,
    label: t.label,
    createdDate: t.createdDate,
    lastUsedAt: t.lastUsedAt ?? null,
    revoked: t.revoked,
    masked: maskToken(t.token),
    neverUsed: t.lastUsedAt === undefined,
  }));

  const revealable = sorted.find((t) => !t.revoked && t.lastUsedAt === undefined) ?? null;

  const recent = [...input.recent]
    .sort((a, b) => b.at - a.at || b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .slice(0, MAX_RECENT);

  return {
    tokens,
    endpoint: input.endpoint,
    endpointReady: input.endpoint !== "",
    pendingSecret: revealable === null ? null : revealable.token,
    // The floor logs; it does not review. A history is a thing to answer to.
    recent: survival ? [] : recent,
    recentNote: RECENT_NOTE,
    shortcutRecipe: buildShortcutRecipe(
      input.endpoint,
      revealable === null ? null : revealable.token,
      input.timings.includes("am") ? "am" : (input.timings[0] ?? "am"),
    ),
    phrases: PHRASES,
    survival,
    note: INGEST_NOTE,
  };
}
