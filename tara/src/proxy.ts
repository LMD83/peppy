import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same mechanism, new
// file/export name) — see node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
// Only one proxy.ts is supported per project, so auth routing and the CSP
// nonce both live here.
const isSignInPage = createRouteMatcher(["/signin"]);
const isAccountRoute = createRouteMatcher(["/account(.*)"]);

const authMiddleware = convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authenticated = await convexAuth.isAuthenticated();
  if (isSignInPage(request) && authenticated) {
    return nextjsMiddlewareRedirect(request, "/account");
  }
  if (isAccountRoute(request) && !authenticated) {
    return nextjsMiddlewareRedirect(request, "/signin");
  }
});

// A fresh nonce per request lets script-src stay strict (no
// 'unsafe-inline'/'unsafe-eval') while Next.js's own hydration/RSC bootstrap
// scripts still execute — Next reads this nonce back out of the response's
// Content-Security-Policy header and stamps it onto its own inline scripts
// automatically. Every route here is already dynamically rendered (see
// docs/SECURITY.md — ConvexAuthNextjsServerProvider reads cookies on every
// request), so nonces cost nothing extra; they're not a new trade-off.
function buildCsp(nonce: string): string {
  // React's dev-mode error reconstruction uses eval() — harmless there
  // ("React will never use eval() in production mode," per its own console
  // message) and never included outside `next dev`.
  const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://gateway.sumup.com https://accounts.google.com${devEval}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.convex.cloud https://lh3.googleusercontent.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://api.sumup.com https://gateway.sumup.com",
    "frame-src https://gateway.sumup.com https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const response = (await authMiddleware(request, event)) ?? NextResponse.next();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  return response;
}

export const config = {
  // Skip static assets/image optimization; run everywhere else (including
  // the /api/auth/* route Convex Auth itself handles).
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
