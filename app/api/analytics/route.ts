import { z } from "zod";
import { api, json, sameOrigin, rateLimit, readBody } from "@/lib/api";
import { getStore } from "@/services/factory";
import { AnalyticsService, eventNames } from "@/services/analytics";
export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    await rateLimit(request, "analytics", 150);
    const body = z
      .object({
        name: z.enum(eventNames),
        properties: z
          .record(z.string(), z.union([z.string(), z.number()]))
          .default({}),
      })
      .parse(await readBody(request));
    if (
      ![
        "landing_viewed",
        "create_started",
        "create_step_completed",
        "share_clicked",
        "public_page_viewed",
        "slot_impression",
        "slot_viewed",
        "assignment_started",
      ].includes(body.name)
    )
      return json({ ok: true });
    await new AnalyticsService(await getStore()).track(
      body.name,
      body.properties,
    );
    return json({ ok: true });
  });
}
