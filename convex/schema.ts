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

export default defineSchema({
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
      })
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
      })
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
