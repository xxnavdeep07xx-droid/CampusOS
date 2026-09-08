import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow the Z.ai preview panel's iframe origin to submit server actions.
  // Without this, Next.js 16 rejects POST requests from server action forms
  // when the Origin header doesn't match the dev server's host — which
  // happens when the app is viewed through the preview panel at
  // https://preview-*.space-z.ai/
  allowedDevOrigins: ["*.space-z.ai"],
};

export default nextConfig;
