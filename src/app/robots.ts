import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/login"],
        disallow: ["/feed", "/likes", "/messages", "/plan", "/profile", "/properties", "/settings", "/rent"]
      }
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`
  };
}
