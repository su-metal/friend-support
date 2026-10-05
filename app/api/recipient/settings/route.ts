import { z } from "zod";
import { api, json, sameOrigin, rateLimit, readBody } from "@/lib/api";
import { considerationsSchema, recipientTokenSchema } from "@/lib/domain";
import { recipientService } from "@/services/factory";
import { requireRecipientAccess } from "../guard";

export async function POST(request: Request) {
  return api(async () => {
    requireRecipientAccess();
    sameOrigin(request);
    await rateLimit(request, "recipient", 30);
    const { token, ...settings } = z
      .object({
        token: recipientTokenSchema,
        paused: z.boolean().optional(),
        considerations: considerationsSchema.optional(),
      })
      .parse(await readBody(request));
    await (await recipientService()).updateSettings(token, settings);
    return json({ ok: true });
  });
}
