import { after } from "next/server";
import {
  api,
  json,
  sameOrigin,
  rateLimit,
  readBody,
  pageAccessVersion,
} from "@/lib/api";
import { assignmentSchema } from "@/lib/domain";
import { isDemoMode } from "@/lib/env";
import { supportService, getStore } from "@/services/factory";

import {
  NotificationService,
  ResendEmailProvider,
} from "@/services/notifications";
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    await rateLimit(request, "assign", 20);
    const { slug } = await context.params,
      input = assignmentSchema.parse(await readBody(request)),
      service = await supportService();
    const result = await service.assign(
      slug,
      input.slotId,
      input,
      await pageAccessVersion(slug),
    );
    if (!isDemoMode() && process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
      after(async () => {
        await new NotificationService(
          await getStore(),
          new ResendEmailProvider(),
        ).dispatch(1);
      });
    return json(
      { ...result, emailQueued: !!input.supporterEmail, demo: isDemoMode() },
      201,
    );
  });
}
