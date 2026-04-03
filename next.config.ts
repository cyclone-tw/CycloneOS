import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: ["mac-mini.tail6deda3.ts.net"],
};

export default nextConfig;
