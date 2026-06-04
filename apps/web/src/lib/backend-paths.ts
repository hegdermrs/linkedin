/** URL prefixes that may be proxied to Fastify (see middleware). */
export const BACKEND_PATH_PREFIXES = [
  "/auth",
  "/admin",
  "/dashboard",
  "/prospects",
  "/campaigns",
  "/tenant",
  "/orchestrate",
  "/webhooks",
  "/health",
] as const;

export function isBackendPath(pathname: string): boolean {
  return BACKEND_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
