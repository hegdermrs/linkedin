import type { NextConfig } from "next";
import { BACKEND_PATH_PREFIXES } from "./src/lib/backend-paths";

/** Same-origin URLs → Node route handler → Fastify (runtime API_URL). */
function backendProxyRewrites() {
  return BACKEND_PATH_PREFIXES.flatMap((segment) => [
    {
      source: `/${segment}`,
      destination: `/api/proxy/${segment}`,
    },
    {
      source: `/${segment}/:path*`,
      destination: `/api/proxy/${segment}/:path*`,
    },
  ]);
}

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@linkedin-agent/shared"],
  async rewrites() {
    return backendProxyRewrites();
  },
};

export default nextConfig;
