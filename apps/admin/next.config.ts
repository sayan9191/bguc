import path from "path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

loadEnvConfig(path.resolve(__dirname, "../.."));

const nextConfig: NextConfig = {
  transpilePackages: ["@exhibition/database", "@exhibition/ui"],
  allowedDevOrigins: ["192.168.1.6"],
};

export default nextConfig;
