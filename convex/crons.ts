import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { SWEEP_MINUTES } from "./tm/logicPush";

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
 * convex/tm/logicRemind.ts — the same pure module the Reminders tab previews
 * from, so the lock screen and the tab can never disagree.
 *
 * Delivery itself is convex/tm/push.ts, which is a Node-runtime action because
 * web-push needs Node built-ins. This file cannot carry `"use node";` — Convex
 * analyses crons.ts in the default runtime — which is exactly why the two are
 * separate modules rather than one.
 */

const crons = cronJobs();

crons.interval("timento reminder sweep", { minutes: SWEEP_MINUTES }, internal.tm.push.sweep, {});

/*
 * The Renpho poll rides the same server-side rule as reminders: the schedule
 * lives here because no tab can be trusted to be open. Twice a day, around
 * the two ends of a Dublin day — a morning weigh-in lands before breakfast
 * is logged, an evening one before the day closes. Delivery is
 * convex/tm/renphoCloud.ts, a Node action for node:crypto, which is why it is
 * not this file; without credentials it logs one line and writes nothing.
 */
crons.cron("timento renpho sync", "45 5,19 * * *", internal.tm.renphoCloud.sweep, {});

export default crons;
