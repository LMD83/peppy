// Seed the Timento demo crew. Run manually with:
//   npx convex run tm/seed:run
// Optionally pass a fixed date: npx convex run tm/seed:run '{"today": "2026-08-12"}'
// On a REAL deployment, override the demo passcodes (they ship in the fixtures):
//   npx convex run tm/seed:run '{"passcodes": {"liam": "…", "conor": "…"}}'
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { buildFixtures } from "./fixtures";
import { isoDate, randomToken, sha256Hex } from "./lib";

const TM_TABLES = [
  "tm_sessions",
  "tm_loginAttempts",
  "tm_days",
  "tm_checks",
  "tm_cravings",
  "tm_lifts",
  "tm_labs",
  "tm_markers",
  "tm_experiments",
  "tm_crewFeed",
  "tm_modeEvents",
  "tm_users",
] as const;

export const run = internalMutation({
  args: {
    today: v.optional(v.string()),
    passcodes: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const today = args.today ?? isoDate(Date.now());
    for (const table of TM_TABLES) {
      // Bounded batches; a dev/demo reset fits one transaction comfortably.
      for (;;) {
        const rows = await ctx.db.query(table).take(1024);
        if (rows.length === 0) break;
        await Promise.all(rows.map((row) => ctx.db.delete(table, row._id)));
      }
    }

    const fx = buildFixtures(today);
    const idBySlug = new Map<string, Id<"tm_users">>();
    for (const u of fx.users) {
      const passcodeSalt = `tm-${u.slug}-${randomToken().slice(0, 8)}`;
      const passcode = args.passcodes?.[u.slug] ?? u.passcode;
      const passcodeHash = await sha256Hex(passcodeSalt + passcode);
      const profile = Object.fromEntries(
        Object.entries(u).filter(([key]) => key !== "passcode"),
      ) as Omit<typeof u, "passcode">;
      const id = await ctx.db.insert("tm_users", {
        ...profile,
        defaultCeilingKg: u.ceilingKg,
        passcodeSalt,
        passcodeHash,
      });
      idBySlug.set(u.slug, id);
    }
    const uid = (slug: string) => {
      const id = idBySlug.get(slug);
      if (!id) throw new Error(`Unknown fixture user ${slug}`);
      return id;
    };

    for (const { userSlug, ...row } of fx.days)
      await ctx.db.insert("tm_days", { userId: uid(userSlug), ...row });
    for (const { userSlug, ...row } of fx.checks)
      await ctx.db.insert("tm_checks", { userId: uid(userSlug), ...row });
    for (const { userSlug, ...row } of fx.cravings)
      await ctx.db.insert("tm_cravings", { userId: uid(userSlug), ...row });
    for (const { userSlug, ...row } of fx.lifts)
      await ctx.db.insert("tm_lifts", { userId: uid(userSlug), ...row });
    for (const { userSlug, ...row } of fx.labs)
      await ctx.db.insert("tm_labs", { userId: uid(userSlug), ...row });
    for (const { userSlug, ...row } of fx.markers)
      await ctx.db.insert("tm_markers", { userId: uid(userSlug), ...row });
    for (const row of fx.experiments) await ctx.db.insert("tm_experiments", row);
    for (const { userSlug, message } of fx.crewFeed) {
      const name = fx.users.find((u) => u.slug === userSlug)?.name ?? userSlug;
      await ctx.db.insert("tm_crewFeed", { userId: uid(userSlug), name, message });
    }
    for (const { userSlug, ...row } of fx.modeEvents)
      await ctx.db.insert("tm_modeEvents", { userId: uid(userSlug), ...row });

    return null;
  },
});
