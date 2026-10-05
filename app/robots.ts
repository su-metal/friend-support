import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/s/",
        "/manage-assignment/",
        "/r/",
        "/dashboard/",
        "/create/",
        "/auth/",
        "/api/",
      ],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
