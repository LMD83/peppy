// One-off seed for the Convex dev deployment. Run with:
//   npx convex run seed:run
// Safe to re-run — it clears each table before re-inserting the fixtures.

import { internalMutation } from "./_generated/server";
import { collections, products } from "../src/lib/products";
import { REVIEW_SETS, DEFAULT_REVIEW_SET } from "../src/lib/reviews";
import { infoPages } from "../src/lib/pages";
import { articles } from "../src/lib/articles";

const TABLES = ["collections", "products", "reviews", "articles", "pages"] as const;

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const table of TABLES) {
      const existing = await ctx.db.query(table).collect();
      await Promise.all(existing.map((doc) => ctx.db.delete(doc._id)));
    }

    for (const c of collections) {
      await ctx.db.insert("collections", c);
    }

    for (const p of products) {
      await ctx.db.insert("products", p);
    }

    for (const p of products) {
      const set = REVIEW_SETS[p.handle] ?? DEFAULT_REVIEW_SET;
      for (const review of set.reviews) {
        await ctx.db.insert("reviews", { productHandle: p.handle, ...review });
      }
    }

    for (const page of infoPages) {
      await ctx.db.insert("pages", page);
    }

    for (const a of articles) {
      await ctx.db.insert("articles", {
        slug: a.slug,
        title: a.title,
        metaTitle: a.metaTitle,
        description: a.description,
        cluster: a.cluster,
        keyword: a.keyword,
        authorName: a.author.name,
        authorRole: a.author.role,
        reviewerName: a.reviewer.name,
        reviewerRole: a.reviewer.role,
        datePublished: a.datePublished,
        readingMinutes: a.readingMinutes,
        excerpt: a.excerpt,
        intro: a.intro,
        sections: a.sections,
        takeaways: a.takeaways,
        faqs: a.faqs,
        ctaLabel: a.cta.label,
        ctaHref: a.cta.href,
        related: a.related,
      });
    }
  },
});
