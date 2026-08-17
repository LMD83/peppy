"use node";

import { v } from "convex/values";
import { Resend } from "resend";
import webpush from "web-push";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { SweepBatch, SweepNotification } from "./remind";
import { emailFromEnv, emailMessage } from "./logicEmail";
import {
  blockedLog,
  blockedReport,
  classifyError,
  deliveryResult,
  encodePayload,
  nothingDue,
  sentReport,
  SWEEP_MINUTES,
  type DeliveryResult,
  type SweepReport,
} from "./logicPush";

/**
 * Delivery. The half of the reminder system that touches the network.
 *
 * This is a separate module from convex/crons.ts, and separate from
 * convex/tm/remind.ts, for a reason that is not stylistic: signing a VAPID JWT
 * and encrypting a payload per RFC 8291 needs Node built-ins, so this file
 * carries `"use node";` — and a file with that pragma may export actions only.
 * remind.ts holds the queries and mutations and cannot have it; crons.ts is
 * analysed in the default runtime and cannot have it either.
 *
 * What is *decided* here: nothing. Which reminders are due, in what words, for
 * whom, is settled in logicRemind.ts and gathered by remind.sweepPlan. What
 * counts as a dead endpoint and what goes on the wire is in logicPush.ts. This
 * module sends, and reports back what happened.
 *
 * ## When it cannot send
 *
 * Without VAPID keys this does nothing, loudly, and touches no subscription.
 * That is the important behaviour, not a placeholder for it: a sweep that
 * cannot deliver must never mark anything delivered, and must never count a
 * failure against a device that was never contacted. The person's next sweep
 * has to be able to reach them.
 */

function vapid(): { subject: string; publicKey: string; privateKey: string } | null {
  const publicKey = (process.env.VAPID_PUBLIC_KEY ?? "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY ?? "").trim();
  const subject = (process.env.VAPID_SUBJECT ?? "").trim();
  if (publicKey === "" || privateKey === "" || subject === "") return null;
  return { subject, publicKey, privateKey };
}

/**
 * What should be sent right now, sent.
 *
 * `nowMs` is read here rather than in the query it calls: a Convex query is not
 * rerun because time passed, so a query that reads the clock returns whatever
 * it cached. The action owns the clock and hands it down.
 */
export const sweep = internalAction({
  args: { windowMinutes: v.optional(v.number()) },
  handler: async (ctx, { windowMinutes }): Promise<SweepReport> => {
    const nowMs = Date.now();
    const window = windowMinutes ?? SWEEP_MINUTES;

    const batches: SweepBatch[] = await ctx.runQuery(internal.tm.remind.sweepPlan, {
      nowMs,
      windowMinutes: window,
    });
    if (batches.length === 0) return nothingDue();

    const users = batches.length;
    const notifications = batches.reduce((n, b) => n + b.notifications.length, 0);

    const keys = vapid();
    const mailKey = (process.env.RESEND_API_KEY ?? "").trim();
    if (keys === null && mailKey === "") {
      console.warn(blockedLog(users, notifications));
      return blockedReport(users, notifications);
    }

    if (keys !== null) webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
    const mailer = mailKey !== "" ? new Resend(mailKey) : null;
    const from = emailFromEnv(process.env.REMIND_EMAIL_FROM);

    const results: DeliveryResult<Id<"tm_pushSubscriptions">>[] = [];
    let sent = 0;

    for (const batch of batches) {
      // The plan only *asks* for Taken hand-offs — sweepPlan is a query and
      // cannot write. Grants are minted here, one per notification, and only
      // when a push can actually carry the button: an email has no buttons,
      // and a credential nothing can use is pure exposure.
      let notes: SweepNotification[] = batch.notifications;
      if (keys !== null && batch.targets.length > 0) {
        const pending: { date: string; doses: { itemId: Id<"tm_protocolItems">; timing: string }[] }[] = [];
        for (const note of batch.notifications) {
          if (note.grant !== undefined) pending.push({ date: note.grant.date, doses: note.grant.doses });
        }
        if (pending.length > 0) {
          const tokens: string[] = await ctx.runMutation(internal.tm.remind.mintTakenGrants, {
            userId: batch.userId,
            nowMs,
            grants: pending,
          });
          let next = 0;
          notes = batch.notifications.map((note): SweepNotification => {
            if (note.grant === undefined) return note;
            const url = note.grant.url;
            const token = tokens[next];
            next += 1;
            const { grant: _grant, ...wire } = note;
            // A token that failed to come back drops the button, never the note.
            return token === undefined ? wire : { ...wire, taken: { url, token } };
          });
        }
      }

      if (keys !== null) {
        for (const target of batch.targets) {
          const subscription = {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
          };

          // One delivery per notification. The worker's per-subject tag replaces
          // rather than stacks, so a device never receives a pile — but a device
          // that has just failed is not asked again in the same sweep either.
          let outcome: "ok" | "gone" | "failed" = "ok";
          for (const note of notes) {
            try {
              await webpush.sendNotification(subscription, encodePayload(note));
              sent += 1;
            } catch (error) {
              outcome = classifyError(error);
              console.warn(
                `[timento reminders] delivery failed for one device (${outcome}): ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
              break;
            }
          }
          results.push(deliveryResult(target.subscriptionId, outcome));
        }
      }

      if (mailer !== null && batch.email !== "") {
        for (const note of notes) {
          const msg = emailMessage(batch.email, note);
          const { error } = await mailer.emails.send({
            from,
            to: msg.to,
            subject: msg.subject,
            text: msg.text,
          });
          if (error) {
            console.warn(
              `[timento reminders] email failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            continue;
          }
          sent += 1;
        }
      }
    }

    if (results.length > 0) {
      await ctx.runMutation(internal.tm.remind.recordDelivery, { results, atMs: nowMs });
    }
    return sentReport(users, notifications, sent);
  },
});
