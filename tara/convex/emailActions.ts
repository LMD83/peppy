import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Resend as ResendAPI } from "resend";
import { OrderConfirmationEmail } from "./emails/OrderConfirmationEmail";

// Scheduled by orders.markPaidInternal — never called directly by a client.
export const sendOrderConfirmation = internalAction({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.orders.getOrderForEmail, { orderId: args.orderId });
    if (!data) return;
    const { order, items } = data;
    if (order.confirmationEmailSentAt) return; // idempotent — already sent

    const apiKey = process.env.RESEND_API_KEY;
    const siteUrl = process.env.SITE_URL ?? "https://tarapeptides.com";
    if (!apiKey) {
      console.error("RESEND_API_KEY not set — skipping order confirmation email");
      return;
    }

    const resend = new ResendAPI(apiKey);
    const { error } = await resend.emails.send(
      {
        from: process.env.AUTH_EMAIL_FROM ?? "TARA Peptides <onboarding@resend.dev>",
        to: [order.email],
        subject: `Order confirmed — ${order.orderNo}`,
        react: OrderConfirmationEmail({
          orderNo: order.orderNo,
          invoiceNo: order.invoiceNo,
          totalCents: order.totalCents,
          siteUrl,
          items: items.map((i) => ({
            name: i.name,
            variantLabel: i.variantLabel,
            qty: i.qty,
            unitPriceCents: i.unitPriceCents,
            batch: i.batch,
            verifyId: i.verifyId,
          })),
        }),
      },
      { idempotencyKey: `order-confirmation/${order.orderNo}` }
    );

    if (error) {
      console.error("Resend failed to send order confirmation:", JSON.stringify(error));
      return; // let the order stand as paid regardless — email is best-effort
    }
    await ctx.runMutation(internal.orders.markConfirmationEmailSent, { orderId: args.orderId });
  },
});
