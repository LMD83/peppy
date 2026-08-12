import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const cartLine = v.object({
  id: v.string(),
  handle: v.string(),
  name: v.string(),
  flavour: v.string(),
  subscribe: v.boolean(),
  qty: v.number(),
  unitPrice: v.number(),
  accent: v.array(v.string()),
});

const tmMode = v.union(v.literal("cut"), v.literal("maintain"), v.literal("survival"));

export default defineSchema({
  // ===== Timento (performance file) tables — prefixed tm_ =====
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

  // ===== Store tables =====
  collections: defineTable({
    slug: v.string(),
    name: v.string(),
    heading: v.string(),
    intro: v.string(),
    accent: v.array(v.string()),
  }).index("by_slug", ["slug"]),

  products: defineTable({
    handle: v.string(),
    name: v.string(),
    collection: v.string(),
    tagline: v.string(),
    price: v.number(),
    servings: v.number(),
    size: v.string(),
    flavours: v.array(v.string()),
    informedSport: v.boolean(),
    vegan: v.boolean(),
    bestseller: v.optional(v.boolean()),
    benefits: v.array(v.string()),
    facts: v.array(v.object({ label: v.string(), value: v.string() })),
    howToUse: v.string(),
    accent: v.array(v.string()),
  })
    .index("by_handle", ["handle"])
    .index("by_collection", ["collection"]),

  reviews: defineTable({
    productHandle: v.string(),
    author: v.string(),
    location: v.string(),
    rating: v.number(),
    date: v.string(),
    title: v.string(),
    body: v.string(),
    verified: v.boolean(),
  }).index("by_product", ["productHandle"]),

  articles: defineTable({
    slug: v.string(),
    title: v.string(),
    metaTitle: v.string(),
    description: v.string(),
    cluster: v.string(),
    keyword: v.string(),
    authorName: v.string(),
    authorRole: v.string(),
    reviewerName: v.string(),
    reviewerRole: v.string(),
    datePublished: v.string(),
    readingMinutes: v.number(),
    excerpt: v.string(),
    intro: v.array(v.string()),
    sections: v.array(
      v.object({
        heading: v.string(),
        paragraphs: v.array(v.string()),
        list: v.optional(v.array(v.string())),
      }),
    ),
    takeaways: v.array(v.string()),
    faqs: v.array(v.object({ q: v.string(), a: v.string() })),
    ctaLabel: v.string(),
    ctaHref: v.string(),
    related: v.array(v.string()),
  }).index("by_slug", ["slug"]),

  pages: defineTable({
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    intro: v.optional(v.string()),
    legal: v.optional(v.boolean()),
    blocks: v.array(
      v.object({
        heading: v.optional(v.string()),
        body: v.optional(v.array(v.string())),
        list: v.optional(v.array(v.string())),
      }),
    ),
  }).index("by_slug", ["slug"]),

  carts: defineTable({
    sessionId: v.string(),
    lines: v.array(cartLine),
  }).index("by_session", ["sessionId"]),

  orders: defineTable({
    sessionId: v.string(),
    lines: v.array(cartLine),
    subtotal: v.number(),
    shipping: v.number(),
    total: v.number(),
    email: v.optional(v.string()),
    status: v.string(),
  }).index("by_session", ["sessionId"]),
});
