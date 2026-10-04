"use client";
import { useEffect } from "react";
import type { AnalyticsEventName } from "@/services/contracts";
export function track(
  name: AnalyticsEventName,
  properties: Record<string, string | number> = {},
) {
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, properties }),
    keepalive: true,
  }).catch(() => {});
}
export function TrackView({
  name,
  pageId,
}: {
  name: AnalyticsEventName;
  pageId?: string;
}) {
  useEffect(() => {
    track(name, pageId ? { pageId } : {});
  }, [name, pageId]);
  return null;
}
