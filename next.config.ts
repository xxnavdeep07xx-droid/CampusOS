import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai"],
  images: {
    // Allow remote patterns if needed in the future.
    remotePatterns: [],
  },
  // Enable experimental features for better performance.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
