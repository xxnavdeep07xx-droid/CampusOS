import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

/**
 * Only the public, indexable pages are listed. Everything under /dashboard
 * and /register is session-scoped and excluded (see robots.txt).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const lastModified = new Date();

  return [
    { url: `${base}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/login`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    {
      url: `${base}/register/principal`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    { url: `${base}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
