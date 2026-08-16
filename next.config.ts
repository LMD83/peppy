import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone is for the Docker/self-hosted path; Vercel's builder does its
  // own output tracing and the flag only adds build work there.
  output: process.env.VERCEL ? undefined : "standalone",
  // Pin the workspace root — parent lockfiles (home + Documents) would
  // otherwise be treated as the monorepo root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
