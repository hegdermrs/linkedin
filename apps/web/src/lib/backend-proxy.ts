import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveApiOrigins, shouldTryNextOrigin } from "./api-origin";

const PROXY_PREFIX = "/api/proxy";

const STRIP_REQUEST_HEADERS = [
  "host",
  "connection",
  "accept-encoding",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "keep-alive",
  "proxy-connection",
];

const STRIP_RESPONSE_HEADERS = [
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
];

/** Map /api/proxy/auth/me → /auth/me for the upstream API. */
export function upstreamPathname(pathname: string): string {
  if (pathname.startsWith(PROXY_PREFIX)) {
    const rest = pathname.slice(PROXY_PREFIX.length);
    return rest.length > 0 ? rest : "/";
  }
  return pathname;
}

function buildUpstreamHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  for (const name of STRIP_REQUEST_HEADERS) {
    headers.delete(name);
  }
  const host = request.headers.get("host");
  if (host) {
    headers.set("x-forwarded-host", host);
    headers.set(
      "x-forwarded-proto",
      request.nextUrl.protocol.replace(":", "")
    );
  }
  headers.set("accept-encoding", "identity");
  return headers;
}

function buildClientResponseHeaders(upstream: Headers): Headers {
  const headers = new Headers(upstream);
  for (const name of STRIP_RESPONSE_HEADERS) {
    headers.delete(name);
  }
  return headers;
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
  const headers = buildUpstreamHeaders(request);

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await request.arrayBuffer();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
  }

  let lastError: unknown;
  for (let i = 0; i < apiOrigins.length; i++) {
    const apiOrigin = apiOrigins[i]!;
    const hasMore = i < apiOrigins.length - 1;
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

      if (shouldTryNextOrigin(upstream.status) && hasMore) {
        console.warn(
          "[backend-proxy] retrying after",
          upstream.status,
          targetUrl
        );
        continue;
      }

      const bytes = await upstream.arrayBuffer();
      const responseHeaders = buildClientResponseHeaders(upstream.headers);
      return new NextResponse(bytes, {
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

/** Server-side fetch to Fastify (used by /api/session). */
export async function fetchFromBackend(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const apiOrigins = resolveApiOrigins();
  if (apiOrigins.length === 0) {
    return new Response(
      JSON.stringify({
        error:
          "API_URL is not set on the web service. Set API_URL and optional API_FALLBACK_URL, then redeploy web.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let lastError: unknown;
  for (let i = 0; i < apiOrigins.length; i++) {
    const apiOrigin = apiOrigins[i]!;
    const hasMore = i < apiOrigins.length - 1;
    let targetUrl: string;
    try {
      targetUrl = new URL(path, apiOrigin).toString();
    } catch {
      continue;
    }

    try {
      const upstream = await fetch(targetUrl, {
        ...init,
        cache: "no-store",
        headers: {
          ...init?.headers,
          "accept-encoding": "identity",
        },
      });
      if (shouldTryNextOrigin(upstream.status) && hasMore) {
        console.warn("[fetchFromBackend] retrying after", upstream.status, targetUrl);
        continue;
      }
      return upstream;
    } catch (err) {
      lastError = err;
      console.error("[fetchFromBackend]", targetUrl, err);
    }
  }

  return new Response(
    JSON.stringify({
      error: `API unreachable: ${lastError instanceof Error ? lastError.message : "connection failed"}`,
    }),
    { status: 502, headers: { "Content-Type": "application/json" } }
  );
}
