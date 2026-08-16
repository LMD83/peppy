import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const tmMode = v.union(v.literal("cut"), v.literal("maintain"), v.literal("survival"));

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
});
