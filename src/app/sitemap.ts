import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  return [
    {
      url: `${siteUrl}/`,
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: `${siteUrl}/pricing`,
      changeFrequency: "weekly",
      priority: 0.7
    }
  ];
}
