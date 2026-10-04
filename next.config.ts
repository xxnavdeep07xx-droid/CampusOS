import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  // Dev-only: allow the Arena/E2B preview host + local network origins.
  allowedDevOrigins: ["*.space-z.ai", "*.e2b.app", "*.arena.ai"],
  images: {
    // Allow any remote image for book covers (URLs are user-provided).
    // On Vercel, these go through the image optimization CDN automatically.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
    // Optimize for common book cover sizes.
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  // Baseline hardening. Note: no X-Frame-Options / frame-ancestors here —
  // the app is served inside preview iframes during development.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        // API responses are never cached by intermediaries.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
