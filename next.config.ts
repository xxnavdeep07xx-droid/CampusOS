import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel handles Next.js natively — no need for standalone output.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai"],
};

export default nextConfig;
