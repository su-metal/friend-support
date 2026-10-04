import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  return [
    { url: base, priority: 1 },
    { url: `${base}/guides`, priority: 0.8 },
    { url: `${base}/guides/coordinate-support`, priority: 0.7 },
    { url: `${base}/privacy`, priority: 0.3 },
    { url: `${base}/terms`, priority: 0.3 },
  ];
}
