import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

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

export async function middleware(request: NextRequest) {
  if (!isBackendPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!process.env.API_URL?.replace(/\/$/, "")) {
    return NextResponse.next();
  }

  return proxyToBackend(request);
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
