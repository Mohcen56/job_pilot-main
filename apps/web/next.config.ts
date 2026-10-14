import type { NextConfig } from "next";
import { workspaceRoot } from "../../scripts/workspace.mjs";

const nextConfig: NextConfig = {
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: ["@jobhunt/api", "@jobhunt/shared"],
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
