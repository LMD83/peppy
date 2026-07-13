import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";

const SUBSCRIBE_DISCOUNT = 0.85;

function lineId(handle: string, flavour: string, subscribe: boolean): string {
  return `${handle}__${flavour}__${subscribe ? "sub" : "one"}`;
}

async function getCartDoc(ctx: QueryCtx | MutationCtx, sessionId: string) {
  return ctx.db
    .query("carts")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .unique();
}

export const get = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const cart = await getCartDoc(ctx, sessionId);
    return cart?.lines ?? [];
  },
});

export const add = mutation({
  args: {
    sessionId: v.string(),
    handle: v.string(),
    name: v.string(),
    flavour: v.string(),
    subscribe: v.boolean(),
    qty: v.number(),
    basePrice: v.number(),
    accent: v.array(v.string()),
  },
  handler: async (ctx, input) => {
    const id = lineId(input.handle, input.flavour, input.subscribe);
    const unitPrice = input.subscribe
      ? input.basePrice * SUBSCRIBE_DISCOUNT
      : input.basePrice;
    const cart = await getCartDoc(ctx, input.sessionId);
    const lines = cart?.lines ?? [];
    const existing = lines.find((l) => l.id === id);
    const nextLines = existing
      ? lines.map((l) => (l.id === id ? { ...l, qty: l.qty + input.qty } : l))
      : [
          ...lines,
          {
            id,
            handle: input.handle,
            name: input.name,
            flavour: input.flavour,
            subscribe: input.subscribe,
            qty: input.qty,
            unitPrice,
            accent: input.accent,
          },
        ];
    if (cart) {
      await ctx.db.patch(cart._id, { lines: nextLines });
    } else {
      await ctx.db.insert("carts", { sessionId: input.sessionId, lines: nextLines });
    }
  },
});

export const setQty = mutation({
  args: { sessionId: v.string(), id: v.string(), qty: v.number() },
  handler: async (ctx, { sessionId, id, qty }) => {
    const cart = await getCartDoc(ctx, sessionId);
    if (!cart) return;
    const nextLines =
      qty <= 0
        ? cart.lines.filter((l) => l.id !== id)
        : cart.lines.map((l) => (l.id === id ? { ...l, qty } : l));
    await ctx.db.patch(cart._id, { lines: nextLines });
  },
});

export const remove = mutation({
  args: { sessionId: v.string(), id: v.string() },
  handler: async (ctx, { sessionId, id }) => {
    const cart = await getCartDoc(ctx, sessionId);
    if (!cart) return;
    await ctx.db.patch(cart._id, {
      lines: cart.lines.filter((l) => l.id !== id),
    });
  },
});

export const clear = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const cart = await getCartDoc(ctx, sessionId);
    if (!cart) return;
    await ctx.db.patch(cart._id, { lines: [] });
  },
});
