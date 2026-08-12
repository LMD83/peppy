import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // standalone is for the Docker/self-hosted path; Vercel's builder does its
  // own output tracing and the flag only adds build work there.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
