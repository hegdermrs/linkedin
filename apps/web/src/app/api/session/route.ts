import { NextResponse } from "next/server";
import { fetchFromBackend } from "@/lib/backend-proxy";

export const runtime = "nodejs";

/** Load session on the server (avoids browser proxy compression / decoding issues). */
export async function GET() {
  const upstream = await fetchFromBackend("/auth/me");
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
