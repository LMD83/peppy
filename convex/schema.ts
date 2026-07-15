import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// TARA Peptides — Convex schema.
// Prices are stored in cents, VAT-INCLUSIVE (Irish VAT 23%). Never add VAT at checkout.

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.string(),
    // auth handled by Convex Auth; this mirrors profile + address
    passwordHash: v.optional(v.string()),
    defaultAddress: v.optional(
      v.object({
        addr: v.string(),
        city: v.string(),
        post: v.string(),
        country: v.string(),
      })
    ),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  products: defineTable({
    slug: v.string(), // e.g. "bpc157"
    name: v.string(),
    category: v.string(),
    purity: v.string(),
    method: v.string(),
    batch: v.string(),
    format: v.string(),
    plain: v.string(), // plain-English one-liner
    stacks: v.string(), // stack guidance
    accent: v.string(), // gradient css
    stock: v.union(v.literal("in"), v.literal("low"), v.literal("out")),
    // strength variants; priceCents is VAT-inclusive final price
    variants: v.array(
      v.object({ label: v.string(), priceCents: v.number() })
    ),
  }).index("by_slug", ["slug"]),

  orders: defineTable({
    userId: v.optional(v.id("users")), // guest checkout allowed
    orderNo: v.string(),
    invoiceNo: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("dispatched"),
      v.literal("cancelled")
    ),
    email: v.string(),
    shipTo: v.object({
      name: v.string(),
      addr: v.string(),
      city: v.string(),
      post: v.string(),
      country: v.string(),
    }),
    subtotalCents: v.number(),
    discountCents: v.number(),
    discountLabel: v.string(),
    shippingCents: v.number(),
    vatCents: v.number(), // contained within total
    totalCents: v.number(),
    sumupCheckoutId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_orderNo", ["orderNo"]),

  orderItems: defineTable({
    orderId: v.id("orders"),
    productSlug: v.string(),
    name: v.string(),
    variantLabel: v.string(),
    batch: v.string(),
    verifyId: v.string(), // the invoice moat
    unitPriceCents: v.number(),
    qty: v.number(),
  }).index("by_order", ["orderId"]),

  verifications: defineTable({
    verifyId: v.string(),
    batch: v.string(),
    productSlug: v.string(),
    coaUrl: v.optional(v.string()),
    firstScannedAt: v.optional(v.number()),
    userId: v.optional(v.id("users")), // for "My Verifications"
  })
    .index("by_verifyId", ["verifyId"])
    .index("by_user", ["userId"]),

  loyalty: defineTable({
    userId: v.id("users"),
    code: v.string(),
    percent: v.number(),
    reason: v.string(), // e.g. "repeat-customer"
    used: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  subscriptions: defineTable({
    userId: v.id("users"),
    productSlug: v.string(),
    variantLabel: v.string(),
    intervalDays: v.number(),
    percentOff: v.number(),
    nextRunAt: v.number(),
    active: v.boolean(),
  }).index("by_user", ["userId"]),
});
