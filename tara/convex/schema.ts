import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// TARA Peptides — Convex schema.
// Prices are stored in cents, VAT-INCLUSIVE (Irish VAT 23%). Never add VAT at checkout.

export default defineSchema({
  // Convex Auth's own tables (authAccounts, authSessions, authRefreshTokens, ...).
  ...authTables,

  users: defineTable({
    // Convex Auth reads/writes these fields directly — keep names/optionality as-is.
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // TARA profile fields.
    defaultAddress: v.optional(
      v.object({
        addr: v.string(),
        city: v.string(),
        post: v.string(),
        country: v.string(),
      })
    ),
    createdAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

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
      v.literal("failed"),
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
    sumupCheckoutReference: v.optional(v.string()),
    confirmationEmailSentAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_orderNo", ["orderNo"])
    .index("by_sumupCheckoutId", ["sumupCheckoutId"]),

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

  // Inbound webhook events we've processed — dedupe replays and keep an audit trail.
  webhookEvents: defineTable({
    source: v.union(v.literal("sumup"), v.literal("resend")),
    eventKey: v.string(), // sumup: checkout id; resend: svix-id
    receivedAt: v.number(),
    payload: v.string(), // raw JSON, for audit/debugging
  }).index("by_source_key", ["source", "eventKey"]),
});
