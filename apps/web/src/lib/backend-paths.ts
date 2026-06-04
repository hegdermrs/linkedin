/** URL segments proxied to Fastify (see next.config rewrites). */
export const BACKEND_PATH_PREFIXES = [
  "auth",
  "admin",
  "dashboard",
  "prospects",
  "campaigns",
  "tenant",
  "orchestrate",
  "webhooks",
  "health",
] as const;
