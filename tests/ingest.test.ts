import { describe, expect, it } from "vitest";
import {
  AMBIGUITY_GAP,
  MAX_RECENT,
  MIN_SCORE,
  TOKEN_PREFIX,
  buildHandsFreeView,
  buildShortcutRecipe,
  composeNumberRuns,
  levenshtein,
  maskToken,
  nameScore,
  parseDoseUtterance,
  parseFoodUtterance,
  quantityFromTokens,
  slotFromTokens,
  timingFromTokens,
  tokenise,
  wordSimilarity,
  type DoseCandidate,
  type FoodCandidate,
  type IngestRecentRow,
  type IngestTokenRow,
} from "../convex/tm/logicIngest";
import { FOODS } from "../convex/tm/data/foods";

const TODAY = "2026-08-13";

function item(over: Partial<DoseCandidate> = {}): DoseCandidate {
  return { id: "i1", name: "Metformin", timings: ["am", "pm"], active: true, ...over };
}

function food(over: Partial<FoodCandidate> = {}): FoodCandidate {
  return { key: "porridge_oats", name: "Porridge oats", portionG: 50, ...over };
}

/* ===== normalisation: speech is not typing ===== */

describe("tokenise", () => {
  it("drops filler, punctuation and possessives", () => {
    expect(tokenise("Hey Siri, I've just taken my Metformin.")).toEqual(["metformin"]);
  });

  it("splits letter/digit runs so 'vitamin d three' meets 'Vitamin D3'", () => {
    expect(tokenise("Vitamin D3")).toEqual(["vitamin", "d", "3"]);
    expect(tokenise("took my vitamin d three")).toEqual(["vitamin", "d", "3"]);
  });

  it("maps spoken numbers to digits", () => {
    expect(tokenise("two hundred grams")).toEqual(["2", "100", "gram"]);
  });

  it("applies the mishearing table in both directions of pluralisation", () => {
    expect(tokenise("met foreman")).toEqual(["met", "metformin"]);
    expect(tokenise("took my tabs")).toEqual(["tablets"]);
    expect(tokenise("creating")).toEqual(["creatine"]);
  });

  it("returns nothing for a phrase that is only filler", () => {
    expect(tokenise("   ...   ")).toEqual([]);
    expect(tokenise("I just took my")).toEqual([]);
  });

  it("is deterministic — the same phrase twice is the same tokens", () => {
    expect(tokenise("Ate 200 grams of chicken")).toEqual(tokenise("ate 200 grams of chicken"));
  });
});

describe("similarity", () => {
  it("bounds the edit distance rather than computing it in full", () => {
    expect(levenshtein("metformin", "metformin")).toBe(0);
    expect(levenshtein("metformin", "creatine", 3)).toBe(4);
  });

  it("refuses to fuzz short tokens — D and B are different supplements", () => {
    expect(wordSimilarity("d", "b")).toBe(0);
    expect(wordSimilarity("d", "d")).toBe(1);
  });

  it("accepts a dictation that cuts a long word short", () => {
    expect(wordSimilarity("atorvastatin", "atorva")).toBeGreaterThanOrEqual(0.8);
  });

  it("scores a name only when its distinctive word is present", () => {
    expect(nameScore("Vitamin D3", tokenise("took my vitamin d three"))).toBe(1);
    expect(nameScore("Vitamin D3", tokenise("took my vitamin"))).toBeLessThan(MIN_SCORE);
  });
});

/* ===== doses: the wrong dose is worse than no dose ===== */

describe("parseDoseUtterance", () => {
  it("resolves a named item against the user's own file", () => {
    const parse = parseDoseUtterance("took my metformin", [item()], "am");
    expect(parse.match).not.toBeNull();
    expect(parse.match?.itemIds).toEqual(["i1"]);
    expect(parse.match?.timing).toBe("am");
    expect(parse.reason).toBe("ok");
    expect(parse.confidence).toBe(1);
  });

  it("survives a mishearing", () => {
    const parse = parseDoseUtterance("took my met foreman", [item()], "pm");
    expect(parse.match?.name).toBe("Metformin");
  });

  it("never guesses between two items that sound alike", () => {
    const items = [
      item({ id: "a", name: "Magnesium glycinate" }),
      item({ id: "b", name: "Magnesium citrate" }),
    ];
    const parse = parseDoseUtterance("took my magnesium", items, "pm");
    expect(parse.match).toBeNull();
    expect(parse.reason).toBe("ambiguous");
    expect(parse.alternatives.length).toBeGreaterThan(1);
    expect(parse.alternatives.map((a) => a.name).sort()).toEqual([
      "Magnesium citrate",
      "Magnesium glycinate",
    ]);
  });

  it("hands back candidates instead of writing when nothing is close enough", () => {
    const parse = parseDoseUtterance("took my ramipril", [item()], "am");
    expect(parse.match).toBeNull();
    expect(parse.reason).toBe("no-match");
  });

  it("echoes what was said even when it cannot be used", () => {
    const parse = parseDoseUtterance("took my whatever it was", [item()], "am");
    expect(parse.heard).toBe("took my whatever it was");
  });

  it("treats an empty phrase as empty rather than as a match", () => {
    expect(parseDoseUtterance("   ", [item()]).reason).toBe("empty");
    expect(parseDoseUtterance("   ", [item()]).match).toBeNull();
  });

  it("honours the whole-stack phrase when a time of day pins it down", () => {
    const items = [
      item({ id: "a", name: "Metformin", timings: ["am", "pm"] }),
      item({ id: "b", name: "Atorvastatin", timings: ["pre-bed"] }),
    ];
    const parse = parseDoseUtterance("took my morning tablets", items);
    expect(parse.match?.scope).toBe("all");
    expect(parse.match?.timing).toBe("am");
    expect(parse.match?.itemIds).toEqual(["a"]);
  });

  it("refuses the whole-stack phrase when the time of day is not said", () => {
    const items = [
      item({ id: "a", name: "Metformin", timings: ["am"] }),
      item({ id: "b", name: "Atorvastatin", timings: ["pre-bed"] }),
    ];
    const parse = parseDoseUtterance("took my tablets", items);
    expect(parse.match).toBeNull();
    expect(parse.reason).toBe("no-timing");
    expect(parse.alternatives.map((a) => a.timing).sort()).toEqual(["am", "pre-bed"]);
  });

  it("prefers a named item over the whole-stack phrase", () => {
    const items = [item({ id: "a" }), item({ id: "b", name: "Atorvastatin", timings: ["pre-bed"] })];
    const parse = parseDoseUtterance("took my metformin tablets", items, "am");
    expect(parse.match?.scope).toBe("item");
    expect(parse.match?.itemIds).toEqual(["a"]);
  });

  it("asks which time of day rather than picking one for a multi-timing item", () => {
    const parse = parseDoseUtterance("took my metformin", [item({ timings: ["am", "pm"] })]);
    expect(parse.match).toBeNull();
    expect(parse.reason).toBe("no-timing");
    expect(parse.alternatives.map((a) => a.timing)).toEqual(["am", "pm"]);
  });

  it("uses the item's only timing without being told", () => {
    const parse = parseDoseUtterance("took my metformin", [item({ timings: ["pre-bed"] })]);
    expect(parse.match?.timing).toBe("pre-bed");
  });

  it("ignores a spoken timing the item does not carry", () => {
    const parse = parseDoseUtterance("took my metformin at bedtime", [item({ timings: ["am"] })]);
    expect(parse.match?.timing).toBe("am");
  });

  it("never matches a paused item", () => {
    const parse = parseDoseUtterance("took my metformin", [item({ active: false })], "am");
    expect(parse.match).toBeNull();
    expect(parse.reason).toBe("no-match");
  });

  it("returns nothing for a file with no items at all", () => {
    expect(parseDoseUtterance("took my tablets", []).match).toBeNull();
  });

  it("keeps the ambiguity gap honest", () => {
    const items = [item({ id: "a", name: "Creatine" }), item({ id: "b", name: "Creatine HCL" })];
    const parse = parseDoseUtterance("took my creatine", items, "am");
    // Identical leading word, different lengths — the gap decides, not the order.
    const spread = parse.alternatives.length > 0 ? 1 - parse.alternatives[0].score : 1;
    if (parse.match === null) expect(parse.reason).toBe("ambiguous");
    else expect(spread).toBeGreaterThanOrEqual(AMBIGUITY_GAP);
  });
});

/* ===== food: a quantity nobody said is flagged, not invented ===== */

describe("parseFoodUtterance", () => {
  it("reads explicit grams and an explicit meal", () => {
    const parse = parseFoodUtterance("ate two hundred grams of porridge oats for lunch", [food()]);
    expect(parse.match?.grams).toBe(200);
    expect(parse.match?.slot).toBe("lunch");
    expect(parse.match?.portionAssumed).toBe(false);
    expect(parse.match?.slotAssumed).toBe(false);
  });

  it("reads a count as catalogue portions", () => {
    const parse = parseFoodUtterance("ate two eggs", [food({ key: "egg", name: "Eggs", portionG: 60 })]);
    expect(parse.match?.grams).toBe(120);
  });

  it("flags the portion it assumed when nobody said one", () => {
    const parse = parseFoodUtterance("had porridge oats", [food()]);
    expect(parse.match?.grams).toBe(50);
    expect(parse.match?.portionAssumed).toBe(true);
    expect(parse.match?.slotAssumed).toBe(true);
    expect(parse.match?.slot).toBe("snack");
  });

  it("does not read a product number as a count", () => {
    expect(quantityFromTokens(tokenise("vitamin d three"))).toEqual({ grams: null, count: null });
  });

  it("refuses to choose between two near-identical foods", () => {
    const parse = parseFoodUtterance("ate yogurt", [
      food({ key: "a", name: "Greek yogurt", portionG: 150 }),
      food({ key: "b", name: "Plain yogurt", portionG: 150 }),
    ]);
    expect(parse.match).toBeNull();
    expect(parse.reason).toBe("ambiguous");
  });

  it("finds a real catalogue food from a real sentence", () => {
    const parse = parseFoodUtterance("I ate 150 grams of chicken breast for dinner", FOODS);
    expect(parse.match?.foodKey).toBe("chicken_breast");
    expect(parse.match?.grams).toBe(150);
    expect(parse.match?.slot).toBe("dinner");
  });

  it("caps a preposterous quantity rather than writing it", () => {
    const parse = parseFoodUtterance("ate 99999 grams of porridge oats", [food()]);
    expect(parse.match?.grams).toBeLessThanOrEqual(3000);
  });

  it("returns nothing for an empty catalogue or an empty phrase", () => {
    expect(parseFoodUtterance("porridge", []).match).toBeNull();
    expect(parseFoodUtterance("  ", [food()]).reason).toBe("empty");
  });
});

describe("time-of-day and meal words", () => {
  it("maps spoken times onto the timings the stack already uses", () => {
    expect(timingFromTokens(tokenise("morning tablets"))).toBe("am");
    expect(timingFromTokens(tokenise("before bed"))).toBe("pre-bed");
    expect(timingFromTokens(tokenise("before the gym"))).toBe("pre-workout");
    expect(timingFromTokens(tokenise("tonight"))).toBe("pm");
    expect(timingFromTokens(tokenise("metformin"))).toBeNull();
  });

  it("maps spoken meals onto slots", () => {
    expect(slotFromTokens(tokenise("for lunch"))).toBe("lunch");
    expect(slotFromTokens(tokenise("as a snack"))).toBe("snack");
    expect(slotFromTokens(tokenise("porridge"))).toBeNull();
  });

  it("folds a spoken number run back into one number", () => {
    expect(composeNumberRuns(["2", "100"])).toEqual(["200"]);
    expect(composeNumberRuns(["20", "5"])).toEqual(["25"]);
    expect(composeNumberRuns(["2", "chicken"])).toEqual(["2", "chicken"]);
  });
});

/* ===== the credential: shown once, then never again ===== */

function tokenRow(over: Partial<IngestTokenRow> = {}): IngestTokenRow {
  return {
    id: "t1",
    token: `${TOKEN_PREFIX}abcdefghijklmnop9f3x`,
    label: "iPhone",
    createdDate: TODAY,
    revoked: false,
    ...over,
  };
}

function recent(over: Partial<IngestRecentRow> = {}): IngestRecentRow {
  return { id: "r1", kind: "dose", label: "Metformin", detail: "Morning", date: TODAY, at: 1, ...over };
}

describe("maskToken", () => {
  it("keeps only the prefix and the last four characters", () => {
    const masked = maskToken(`${TOKEN_PREFIX}abcdefghijklmnop9f3x`);
    expect(masked.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(masked.endsWith("9f3x")).toBe(true);
    expect(masked).not.toContain("abcdefghij");
  });
});

describe("buildHandsFreeView", () => {
  const base = { mode: "maintain" as const, date: TODAY, endpoint: "https://x.convex.site", timings: ["am"] };

  it("never puts a full token in the token list", () => {
    const view = buildHandsFreeView({ ...base, tokens: [tokenRow()], recent: [] });
    expect(view.tokens[0].masked).not.toContain("abcdefghij");
    expect(JSON.stringify(view.tokens)).not.toContain("abcdefghijklmnop9f3x");
  });

  it("reveals a never-used token exactly once, then never again", () => {
    const unused = buildHandsFreeView({ ...base, tokens: [tokenRow()], recent: [] });
    expect(unused.pendingSecret).toBe(`${TOKEN_PREFIX}abcdefghijklmnop9f3x`);

    // The first accepted call stamps lastUsedAt — and the secret is gone for good.
    const used = buildHandsFreeView({
      ...base,
      tokens: [tokenRow({ lastUsedAt: 1_700_000_000_000 })],
      recent: [],
    });
    expect(used.pendingSecret).toBeNull();
    expect(used.tokens[0].neverUsed).toBe(false);
  });

  it("never reveals a revoked token", () => {
    const view = buildHandsFreeView({ ...base, tokens: [tokenRow({ revoked: true })], recent: [] });
    expect(view.pendingSecret).toBeNull();
  });

  it("puts live tokens above revoked ones", () => {
    const view = buildHandsFreeView({
      ...base,
      tokens: [tokenRow({ id: "old", revoked: true }), tokenRow({ id: "live" })],
      recent: [],
    });
    expect(view.tokens.map((t) => t.id)).toEqual(["live", "old"]);
  });

  it("shows the newest entries first and never more than ten", () => {
    const rows = Array.from({ length: 25 }, (_, i) => recent({ id: `r${i}`, at: i }));
    const view = buildHandsFreeView({ ...base, tokens: [], recent: rows });
    expect(view.recent).toHaveLength(MAX_RECENT);
    expect(view.recent[0].id).toBe("r24");
  });

  it("collapses to the floor in survival — no history to answer to", () => {
    const view = buildHandsFreeView({
      ...base,
      mode: "survival",
      tokens: [tokenRow()],
      recent: [recent()],
    });
    expect(view.survival).toBe(true);
    expect(view.recent).toEqual([]);
    // Revoking is a safety control, not an obligation — it stays.
    expect(view.tokens).toHaveLength(1);
  });

  it("says so when there is no deployment to post to", () => {
    const view = buildHandsFreeView({ ...base, endpoint: "", tokens: [], recent: [] });
    expect(view.endpointReady).toBe(false);
    expect(view.shortcutRecipe.url).toBe("https://YOUR-DEPLOYMENT.convex.site/ingest/dose");
  });
});

describe("buildShortcutRecipe", () => {
  it("gives every field as a thing to copy, not a thing to retype", () => {
    const recipe = buildShortcutRecipe("https://x.convex.site", "tmnt_secret", "am");
    expect(recipe.url).toBe("https://x.convex.site/ingest/dose");
    expect(recipe.method).toBe("POST");
    expect(recipe.phrase).toBe("Hey Siri, took my morning tablets");
    expect(recipe.steps.filter((s) => s.copy !== null).length).toBeGreaterThanOrEqual(3);
    expect(JSON.parse(recipe.body)).toMatchObject({ token: "tmnt_secret", timing: "am" });
  });

  it("uses a placeholder rather than a real token when there is none to show", () => {
    const recipe = buildShortcutRecipe("https://x.convex.site", null);
    expect(JSON.parse(recipe.body).token).toBe("YOUR-TOKEN");
  });
});
