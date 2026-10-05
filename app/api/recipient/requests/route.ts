import { z } from "zod";
import { api, json, sameOrigin, rateLimit, readBody } from "@/lib/api";
import { recipientRequestSchema, recipientTokenSchema } from "@/lib/domain";
import { recipientService } from "@/services/factory";
import { requireRecipientAccess } from "../guard";

export async function POST(request: Request) {
  return api(async () => {
    requireRecipientAccess();
    sameOrigin(request);
    await rateLimit(request, "recipient", 30);
    const { token, request: input } = z
      .object({ token: recipientTokenSchema, request: recipientRequestSchema })
      .parse(await readBody(request));
    const result = await (await recipientService()).addRequest(token, input);
    return json({ ok: true, ...result });
  });
}
