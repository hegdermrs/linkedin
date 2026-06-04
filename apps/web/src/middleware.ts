import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Fastify routes — proxied to API when API_URL is set (Railway / production). */
const BACKEND_PREFIXES = [
  "/auth",
  "/admin",
  "/dashboard",
  "/prospects",
  "/campaigns",
  "/tenant",
  "/orchestrate",
  "/webhooks",
  "/health",
];

function isBackendPath(pathname: string): boolean {
  return BACKEND_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function middleware(request: NextRequest) {
  if (!isBackendPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const apiOrigin = process.env.API_URL?.replace(/\/$/, "");
  if (!apiOrigin) {
    return NextResponse.next();
  }

  const target = new URL(
    request.nextUrl.pathname + request.nextUrl.search,
    apiOrigin
  );

  const requestHeaders = new Headers(request.headers);
  const host = request.headers.get("host");
  if (host) {
    requestHeaders.set("x-forwarded-host", host);
    requestHeaders.set(
      "x-forwarded-proto",
      request.nextUrl.protocol.replace(":", "")
    );
  }

  return NextResponse.rewrite(target, {
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/auth/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
    "/prospects/:path*",
    "/campaigns/:path*",
    "/tenant/:path*",
    "/orchestrate",
    "/webhooks/:path*",
    "/health",
  ],
};
