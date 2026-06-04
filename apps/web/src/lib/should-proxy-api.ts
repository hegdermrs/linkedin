import type { NextRequest } from "next/server";

/**
 * Browser navigation and Next.js client routing must hit App Router pages,
 * not the Fastify JSON API (same paths like /admin/tenants/.../accounts).
 */
export function shouldProxyToApi(request: NextRequest): boolean {
  const mode = request.headers.get("sec-fetch-mode");
  const dest = request.headers.get("sec-fetch-dest");
  if (mode === "navigate" || dest === "document") {
    return false;
  }

  if (request.headers.get("rsc") === "1") {
    return false;
  }
  if (request.headers.has("next-router-state-tree")) {
    return false;
  }

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return false;
  }
  if (accept.includes("text/x-component")) {
    return false;
  }

  return true;
}
