import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isBackendPath } from "@/lib/backend-paths";
import { shouldProxyToApi } from "@/lib/should-proxy-api";

const PROXY_PREFIX = "/api/proxy";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isBackendPath(pathname)) {
    return NextResponse.next();
  }

  if (!shouldProxyToApi(request)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `${PROXY_PREFIX}${pathname}`;
  return NextResponse.rewrite(url);
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
