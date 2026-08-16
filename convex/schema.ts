import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const tmMode = v.union(v.literal("cut"), v.literal("maintain"), v.literal("survival"));

const mealSlot = v.union(
  v.literal("breakfast"),
  v.literal("lunch"),
  v.literal("dinner"),
  v.literal("snack"),
);

export default defineSchema({
  tm_users: defineTable({
    slug: v.string(),
    name: v.string(),
    passcodeSalt: v.string(),
    passcodeHash: v.string(),
    mode: tmMode,
    modeSince: v.string(),
    modeReason: v.optional(v.string()),
    reviewDate: v.optional(v.string()),
    ceilingKg: v.number(),
    defaultCeilingKg: v.number(),
    goalKg: v.number(),
    startKg: v.number(),
    startDate: v.string(),
    kitchenClose: v.string(),
    protocolTitle: v.string(),
    /** "easy" returns fewer objects, not smaller ones. Enforced at the query boundary. */
    a11yProfile: v.optional(v.union(v.literal("standard"), v.literal("easy"))),
  }).index("by_slug", ["slug"]),

  tm_sessions: defineTable({
    userId: v.id("tm_users"),
    token: v.string(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  tm_loginAttempts: defineTable({
    slug: v.string(),
    at: v.number(),
  }).index("by_slug", ["slug"]),

  tm_days: defineTable({
    userId: v.id("tm_users"),
    date: v.string(),
    weightKg: v.optional(v.number()),
    stress: v.optional(v.number()),
    energy: v.optional(v.number()),
    ritualDone: v.optional(v.boolean()),
    sessionDone: v.optional(v.boolean()),
    note: v.optional(v.string()),
  }).index("by_userId_and_date", ["userId", "date"]),

  tm_checks: defineTable({
    userId: v.id("tm_users"),
    date: v.string(),
    key: v.string(),
    done: v.boolean(),
  }).index("by_userId_and_date", ["userId", "date"]),

  tm_cravings: defineTable({
    userId: v.id("tm_users"),
    date: v.string(),
    time: v.string(),
    signal: v.union(
      v.literal("tired"),
      v.literal("emotion"),
      v.literal("cue"),
      v.literal("bored"),
      v.literal("hungry"),
    ),
    emotionWord: v.optional(v.string()),
    afterState: v.optional(
      v.union(v.literal("relief"), v.literal("guilt"), v.literal("numb"), v.literal("satisfied")),
    ),
    action: v.optional(
      v.union(v.literal("rode"), v.literal("substitute"), v.literal("ate")),
    ),
  }).index("by_userId_and_date", ["userId", "date"]),

  tm_lifts: defineTable({
    userId: v.id("tm_users"),
    date: v.string(),
    exercise: v.string(),
    topSetWeightKg: v.number(),
    topSetReps: v.number(),
  })
    .index("by_userId_and_exercise", ["userId", "exercise"])
    .index("by_userId_and_date", ["userId", "date"]),

  tm_labs: defineTable({
    userId: v.id("tm_users"),
    date: v.string(),
    marker: v.string(),
    value: v.number(),
    unit: v.string(),
    note: v.optional(v.string()),
    recheckDate: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  tm_markers: defineTable({
    userId: v.id("tm_users"),
    gene: v.string(),
    csvCall: v.string(),
    reportCall: v.string(),
    status: v.union(v.literal("confirmed"), v.literal("disputed"), v.literal("resolved")),
    resolvesVia: v.string(),
    resolvedDate: v.optional(v.string()),
    method: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  tm_experiments: defineTable({
    code: v.string(),
    name: v.string(),
    hypothesis: v.string(),
    protocol: v.string(),
    durationDays: v.number(),
    metric: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("supported"),
      v.literal("refuted"),
      v.literal("unclear"),
    ),
    startDate: v.optional(v.string()),
    note: v.optional(v.string()),
    userId: v.optional(v.id("tm_users")),
  }).index("by_code", ["code"]),

  tm_crewFeed: defineTable({
    userId: v.id("tm_users"),
    name: v.string(),
    message: v.string(),
  }).index("by_userId", ["userId"]),

  tm_modeEvents: defineTable({
    userId: v.id("tm_users"),
    date: v.string(),
    mode: tmMode,
    label: v.string(),
  }).index("by_userId_and_date", ["userId", "date"]),

  /** Opaque per-user tokens so a phone Shortcut can log without a session. */
  tm_ingestTokens: defineTable({
    userId: v.id("tm_users"),
    token: v.string(),
    label: v.string(),
    createdDate: v.string(),
    lastUsedAt: v.optional(v.number()),
    revoked: v.boolean(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  /* ===== Reminders — the promise the app has been making without a way to keep it ===== */

  tm_pushSubscriptions: defineTable({
    userId: v.id("tm_users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    label: v.string(),
    createdDate: v.string(),
    lastSuccessAt: v.optional(v.number()),
    lastFailureAt: v.optional(v.number()),
    /** Consecutive failures; a dead subscription is dropped rather than retried forever. */
    failures: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  tm_reminderPrefs: defineTable({
    userId: v.id("tm_users"),
    enabled: v.boolean(),
    /** Nothing fires inside these hours, whatever is due. */
    quietFrom: v.string(),
    quietTo: v.string(),
    doses: v.boolean(),
    supply: v.boolean(),
    checkins: v.boolean(),
    /** A missed reminder is never repeated more than this in a day. */
    maxPerDay: v.number(),
  }).index("by_userId", ["userId"]),

  /** A photo is evidence attached to something you logged — never an identification. */
  tm_captures: defineTable({
    userId: v.id("tm_users"),
    date: v.string(),
    kind: v.union(v.literal("dose"), v.literal("meal"), v.literal("organiser")),
    storageId: v.id("_storage"),
    note: v.optional(v.string()),
    at: v.number(),
  }).index("by_userId_and_date", ["userId", "date"]),

  /* ===== Crew consent — who may see what, and revocably =====
     Sharing adherence is sharing health data. It requires an explicit,
     per-scope grant from the person whose data it is, and a way back out. */

  tm_crewLinks: defineTable({
    /** Whose file is being shared. */
    ownerId: v.id("tm_users"),
    /** Who may see the projection. */
    viewerId: v.id("tm_users"),
    /** Named projections only — never raw entries. */
    scopes: v.array(v.string()),
    /** A peer in the crew, or someone helping from outside it. */
    relationship: v.optional(v.union(v.literal("crew"), v.literal("carer"))),
    status: v.union(v.literal("pending"), v.literal("active"), v.literal("revoked")),
    invitedDate: v.string(),
    respondedDate: v.optional(v.string()),
    revokedDate: v.optional(v.string()),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_viewerId", ["viewerId"]),

  /* ===== Supply — never run out ===== */

  tm_supply: defineTable({
    userId: v.id("tm_users"),
    itemId: v.id("tm_protocolItems"),
    /** Units physically in the house at lastCountedDate. */
    onHand: v.number(),
    unitsPerDose: v.number(),
    packSize: v.number(),
    lastCountedDate: v.string(),
    /** Days between asking for more and having it in hand. */
    reorderLeadDays: v.number(),
    scriptExpiryDate: v.optional(v.string()),
    repeatsRemaining: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_itemId", ["userId", "itemId"]),

  /** GP and pharmacy details, so a refill is one tap rather than a search. */
  tm_contacts: defineTable({
    userId: v.id("tm_users"),
    kind: v.union(v.literal("gp"), v.literal("pharmacy")),
    name: v.string(),
    phone: v.string(),
    note: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  tm_pantry: defineTable({
    userId: v.id("tm_users"),
    foodKey: v.string(),
    grams: v.number(),
    updatedDate: v.string(),
  }).index("by_userId", ["userId"]),

  /* ===== Fuel — targets, meal plan, intake ===== */

  tm_nutritionTargets: defineTable({
    userId: v.id("tm_users"),
    effectiveFrom: v.string(),
    kcal: v.number(),
    proteinG: v.number(),
    carbsG: v.number(),
    fatG: v.number(),
    fiberG: v.number(),
    sodiumMgMax: v.number(),
    basis: v.union(v.literal("adaptive"), v.literal("manual")),
  }).index("by_userId", ["userId"]),

  tm_mealEntries: defineTable({
    userId: v.id("tm_users"),
    date: v.string(),
    slot: mealSlot,
    foodKey: v.string(),
    grams: v.number(),
    planned: v.boolean(),
    eaten: v.boolean(),
  }).index("by_userId_and_date", ["userId", "date"]),

  /** Weekly adaptive-TDEE estimate: intake vs measured weight slope. */
  tm_energyEstimates: defineTable({
    userId: v.id("tm_users"),
    weekStart: v.string(),
    tdeeKcal: v.number(),
    avgIntakeKcal: v.number(),
    weightSlopeKgPerWeek: v.number(),
  }).index("by_userId", ["userId"]),

  tm_kitchenProfiles: defineTable({
    userId: v.id("tm_users"),
    minutes: v.number(),
    equipment: v.union(
      v.literal("none"),
      v.literal("kettle"),
      v.literal("microwave"),
      v.literal("one-pan"),
      v.literal("oven"),
    ),
    hands: v.union(v.literal(1), v.literal(2)),
    canStand: v.boolean(),
    excludeAllergens: v.array(v.string()),
    safeFoodsOnly: v.boolean(),
    pinnedBreakfast: v.optional(v.string()),
    safeFoods: v.array(v.string()),
    neverAgain: v.array(v.string()),
  }).index("by_userId", ["userId"]),

  tm_savedMenus: defineTable({
    userId: v.id("tm_users"),
    name: v.string(),
    slot: mealSlot,
    items: v.array(v.object({ foodKey: v.string(), grams: v.number() })),
  }).index("by_userId", ["userId"]),

  /* ===== Train — mesocycle, programme, set logs ===== */

  tm_mesocycles: defineTable({
    userId: v.id("tm_users"),
    name: v.string(),
    startDate: v.string(),
    weeks: v.number(),
    deloadWeek: v.number(),
    goal: v.union(v.literal("hypertrophy"), v.literal("strength"), v.literal("recomp")),
    status: v.union(v.literal("planned"), v.literal("running"), v.literal("done")),
  }).index("by_userId", ["userId"]),

  tm_programBlocks: defineTable({
    userId: v.id("tm_users"),
    mesocycleId: v.id("tm_mesocycles"),
    weekday: v.number(),
    dayName: v.string(),
    exercise: v.string(),
    muscle: v.string(),
    sets: v.number(),
    repLow: v.number(),
    repHigh: v.number(),
    rirTarget: v.number(),
    orderIndex: v.number(),
  })
    .index("by_userId_and_weekday", ["userId", "weekday"])
    .index("by_mesocycleId", ["mesocycleId"]),

  tm_setLogs: defineTable({
    userId: v.id("tm_users"),
    date: v.string(),
    exercise: v.string(),
    setIndex: v.number(),
    weightKg: v.number(),
    reps: v.number(),
    rir: v.number(),
  })
    .index("by_userId_and_date", ["userId", "date"])
    .index("by_userId_and_exercise", ["userId", "exercise"]),

  tm_volumeLandmarks: defineTable({
    userId: v.id("tm_users"),
    muscle: v.string(),
    mev: v.number(),
    mav: v.number(),
    mrv: v.number(),
  }).index("by_userId", ["userId"]),

  tm_trainProfiles: defineTable({
    userId: v.id("tm_users"),
    setting: v.union(v.literal("home"), v.literal("gym"), v.literal("box")),
    kit: v.array(v.string()),
    experience: v.union(v.literal("new"), v.literal("returning"), v.literal("trained")),
    ageBand: v.union(v.literal("under-40"), v.literal("40-59"), v.literal("60-plus")),
    minutes: v.number(),
    constraints: v.array(v.string()),
  }).index("by_userId", ["userId"]),

  /* ===== Stack — meds, peptides, supplements ===== */

  tm_protocolItems: defineTable({
    userId: v.id("tm_users"),
    name: v.string(),
    kind: v.union(v.literal("med"), v.literal("peptide"), v.literal("supplement")),
    dose: v.number(),
    unit: v.string(),
    route: v.union(
      v.literal("oral"),
      v.literal("subcut"),
      v.literal("intramuscular"),
      v.literal("topical"),
      v.literal("nasal"),
    ),
    timings: v.array(v.string()),
    scheduleType: v.union(
      v.literal("daily"),
      v.literal("weekdays"),
      v.literal("interval"),
      v.literal("cycle"),
    ),
    weekdays: v.optional(v.array(v.number())),
    intervalDays: v.optional(v.number()),
    cycleOnWeeks: v.optional(v.number()),
    cycleOffWeeks: v.optional(v.number()),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    withFood: v.boolean(),
    evidence: v.union(
      v.literal("strong"),
      v.literal("moderate"),
      v.literal("limited"),
      v.literal("anecdotal"),
    ),
    cautions: v.array(v.string()),
    note: v.optional(v.string()),
    /** Peptide reconstitution: vial strength, diluent volume, syringe graduation. */
    recon: v.optional(
      v.object({ vialMg: v.number(), bacMl: v.number(), syringeUnitsPerMl: v.number() }),
    ),
    active: v.boolean(),
  }).index("by_userId", ["userId"]),

  tm_doseLogs: defineTable({
    userId: v.id("tm_users"),
    date: v.string(),
    itemId: v.id("tm_protocolItems"),
    timing: v.string(),
    taken: v.boolean(),
    site: v.optional(v.string()),
  }).index("by_userId_and_date", ["userId", "date"]),

  /* ===== Labs — panels and results ===== */

  tm_labPanels: defineTable({
    userId: v.id("tm_users"),
    date: v.string(),
    name: v.string(),
    lab: v.optional(v.string()),
    fasted: v.optional(v.boolean()),
  }).index("by_userId", ["userId"]),

  tm_labResults: defineTable({
    userId: v.id("tm_users"),
    panelId: v.id("tm_labPanels"),
    date: v.string(),
    marker: v.string(),
    value: v.number(),
    unit: v.string(),
    refLow: v.optional(v.number()),
    refHigh: v.optional(v.number()),
  })
    .index("by_userId_and_marker", ["userId", "marker"])
    .index("by_panelId", ["panelId"]),

  /* ===== Mind — validated instruments, intentions, reflections ===== */

  tm_assessments: defineTable({
    userId: v.id("tm_users"),
    date: v.string(),
    instrument: v.string(),
    answers: v.array(v.number()),
    score: v.number(),
    band: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_instrument", ["userId", "instrument"]),

  tm_intentions: defineTable({
    userId: v.id("tm_users"),
    trigger: v.string(),
    action: v.string(),
    active: v.boolean(),
    createdDate: v.string(),
    wins: v.number(),
  }).index("by_userId", ["userId"]),

  tm_reflections: defineTable({
    userId: v.id("tm_users"),
    date: v.string(),
    prompt: v.string(),
    response: v.string(),
    win: v.optional(v.string()),
  }).index("by_userId_and_date", ["userId", "date"]),
});
