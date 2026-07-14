"use client"

import { ConvexProvider, ConvexReactClient } from "convex/react"

// Falls back to a placeholder when NEXT_PUBLIC_CONVEX_URL isn't set (e.g. a
// CI job that only lints/typechecks/builds and has no deployment configured)
// so prerendering client components doesn't crash the build. Real
// deployments (Vercel, `next dev` with .env.local) always have the env var
// set, so this path is never hit outside of build-only CI.
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://placeholder.convex.cloud"

const convex = new ConvexReactClient(convexUrl)

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}
