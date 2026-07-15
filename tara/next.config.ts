import path from "node:path";
import type { NextConfig } from "next";

// Content-Security-Policy is set per-request (with a nonce) in src/proxy.ts,
// not here — everything below is static and doesn't need per-request
// computation. See docs/SECURITY.md for the full header rationale.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" }, // legacy fallback for frame-ancestors 'none'
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the workspace root to this directory — the repo also has a
  // top-level package-lock.json (the sibling `peppy` app), which Next.js
  // would otherwise mistake for the workspace root.
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
