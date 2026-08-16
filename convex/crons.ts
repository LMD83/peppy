import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { SWEEP_MINUTES } from "./tm/push";

/**
 * The reminder schedule, and nothing else.
 *
 * iOS gives a web app no Background Sync and no Periodic Sync at all, and a
 * timer in an open tab is not a reminder system — it is a tab that happens to
 * be open. So the schedule lives here, on the server, and the only thing the
 * device does is receive.
 *
 * The sweep asks for the slice of the day that has just elapsed. That window is
 * how "a missed dose is mentioned once" is kept without a sent-log table: each
 * due thing falls inside exactly one sweep, so it goes out once and is never
 * escalated into a second, louder copy. What is due is decided in
 * convex/tm/logic-remind.ts — the same pure module the Reminders tab previews
 * from, so the lock screen and the tab can never disagree.
 *
 * Delivery itself is convex/tm/push.ts, which is a Node-runtime action because
 * web-push needs Node built-ins. This file cannot carry `"use node";` — Convex
 * analyses crons.ts in the default runtime — which is exactly why the two are
 * separate modules rather than one.
 */

const crons = cronJobs();

crons.interval("timento reminder sweep", { minutes: SWEEP_MINUTES }, internal.tm.push.sweep, {});

export default crons;
