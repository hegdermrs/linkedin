/** Upstream Fastify origins for server-side fetch (web → api on Railway). */
export function resolveApiOrigins(): string[] {
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

export function shouldTryNextOrigin(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}
