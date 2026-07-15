import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    SUMUP_SECRET_KEY: v.optional(v.string()),
    SUMUP_WEBHOOK_SECRET: v.optional(v.string()),
    JWT_PRIVATE_KEY: v.optional(v.string()),
    JWKS: v.optional(v.string()),
  },
});

export default app;
