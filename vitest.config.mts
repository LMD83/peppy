import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The app's own path aliases, so a test can import the constant it guards
  // instead of restating it and drifting from the source of truth.
  resolve: {
    alias: {
      "@convex": fileURLToPath(new URL("./convex", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "edge-runtime",
    include: ["tests/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
