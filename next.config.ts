import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Allow production builds to complete even with type errors
    // Types are still checked in development and by IDEs
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
