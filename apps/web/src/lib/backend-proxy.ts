import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROXY_PREFIX = "/api/proxy";

function resolveApiOrigins(): string[] {
  const raw = [
    process.env.API_URL,
    process.env.API_FALLBACK_URL,
  ].filter((v): v is string => Boolean(v?.trim()));

  const origins: string[] = [];
  for (const value of raw) {
    const trimmed = value.trim();
    if (trimmed.includes("${{")) continue;
    const normalized = trimmed.replace(/\/$/, "");
    try {
      new URL(normalized);
      if (!origins.includes(normalized)) origins.push(normalized);
    } catch {
      /* skip invalid */
    }
  }
  return origins;
}

/** Map /api/proxy/auth/login → /auth/login for the upstream API. */
export function upstreamPathname(pathname: string): string {
  if (pathname.startsWith(PROXY_PREFIX)) {
    const rest = pathname.slice(PROXY_PREFIX.length);
    return rest.length > 0 ? rest : "/";
  }
  return pathname;
}

/** Proxy browser API calls to Fastify (Node runtime; Railway private network). */
export async function proxyToBackend(
  request: NextRequest
): Promise<NextResponse> {
  const apiOrigins = resolveApiOrigins();
  if (apiOrigins.length === 0) {
    return NextResponse.json(
      {
        error:
          "API_URL is not set on the web service. In Railway Variables use: http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}} (Reference api PORT). Optional API_FALLBACK_URL = api public https URL.",
      },
      { status: 503 }
    );
  }

  const pathname = upstreamPathname(request.nextUrl.pathname);
  const search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  const host = request.headers.get("host");
  if (host) {
    headers.set("x-forwarded-host", host);
    headers.set(
      "x-forwarded-proto",
      request.nextUrl.protocol.replace(":", "")
    );
  }

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await request.arrayBuffer();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
  }

  let lastError: unknown;
  for (const apiOrigin of apiOrigins) {
    let targetUrl: string;
    try {
      targetUrl = new URL(pathname + search, apiOrigin).toString();
    } catch {
      continue;
    }

    try {
      const upstream = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: body && body.byteLength > 0 ? body : undefined,
        redirect: "manual",
        cache: "no-store",
      });

      const responseHeaders = new Headers(upstream.headers);
      return new NextResponse(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      lastError = err;
      console.error("[backend-proxy]", targetUrl, err);
    }
  }

  console.error("[backend-proxy] all origins failed", apiOrigins, lastError);
  return NextResponse.json(
    {
      error:
        "API unreachable from web. Set API_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}} on web (service name must match your api service). Ensure api is Online. Or set API_FALLBACK_URL to the api public https URL.",
    },
    { status: 502 }
  );
}
