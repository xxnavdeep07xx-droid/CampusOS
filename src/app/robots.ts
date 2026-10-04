import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

/**
 * Generated at /robots.txt so the Sitemap line can use the real site URL.
 * Tenant-facing routes are excluded from crawling.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register/principal", "/privacy", "/terms"],
        disallow: [
          "/dashboard",
          "/register/teacher",
          "/register/student",
          "/api/",
          "/setup",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
