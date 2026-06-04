import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Proxy browser API calls to Fastify (same-origin; avoids broken external rewrites in middleware). */
export async function proxyToBackend(
  request: NextRequest
): Promise<NextResponse> {
  const apiOrigin = process.env.API_URL?.replace(/\/$/, "");
  if (!apiOrigin) {
    return NextResponse.json(
      { error: "API_URL is not set on the web service." },
      { status: 503 }
    );
  }

  let targetUrl: string;
  try {
    targetUrl = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      apiOrigin
    ).toString();
  } catch {
    return NextResponse.json(
      { error: "Invalid API_URL on the web service." },
      { status: 503 }
    );
  }

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
    console.error("[backend-proxy]", targetUrl, err);
    return NextResponse.json(
      {
        error:
          "API unreachable. On Railway set API_URL to http://api.railway.internal:${{api.PORT}} and ensure the api service is Online.",
      },
      { status: 502 }
    );
  }
}
