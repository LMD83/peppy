import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the workspace root to this directory — the repo also has a
  // top-level package-lock.json (the sibling `peppy` app), which Next.js
  // would otherwise mistake for the workspace root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
