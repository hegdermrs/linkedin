import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@linkedin-agent/shared"],
};

export default nextConfig;
