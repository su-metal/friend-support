import { z } from "zod";
import { api, json, sameOrigin, rateLimit, readBody } from "@/lib/api";
import { supportService } from "@/services/factory";

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    await rateLimit(request, "cancel", 20);
    const { token } = z
      .object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
      .parse(await readBody(request));
    const service = await supportService();
    await service.cancel(token);
    return json({ ok: true });
  });
}
