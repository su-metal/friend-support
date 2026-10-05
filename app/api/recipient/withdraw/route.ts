import { z } from "zod";
import { api, json, sameOrigin, rateLimit, readBody } from "@/lib/api";
import { recipientTokenSchema } from "@/lib/domain";
import { recipientService } from "@/services/factory";
import { requireRecipientAccess } from "../guard";

export async function POST(request: Request) {
  return api(async () => {
    requireRecipientAccess();
    sameOrigin(request);
    await rateLimit(request, "recipient", 30);
    const { token, slotId } = z
      .object({ token: recipientTokenSchema, slotId: z.string().uuid() })
      .parse(await readBody(request));
    await (await recipientService()).withdrawRequest(token, slotId);
    return json({ ok: true });
  });
}
