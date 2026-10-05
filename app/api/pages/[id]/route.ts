import { z } from "zod";
import { considerationsSchema, pageDraftSchema } from "@/lib/domain";
import { AppError } from "@/lib/errors";
import { appUrl } from "@/lib/env";
import { getFeatureFlags } from "@/config/product";
import { api, json, sameOrigin, readBody } from "@/lib/api";
import { requireUser } from "@/lib/auth/server";
import { recipientService, supportService } from "@/services/factory";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  return api(async () => {
    sameOrigin(request);
    const user = await requireUser(),
      { id } = await context.params,
      body = await readBody(request),
      service = await supportService();
    if (
      typeof body.action === "string" &&
      body.action.startsWith("recipient_") &&
      !getFeatureFlags().recipientAccess
    )
      throw new AppError("not_found", "見つかりません", 404);
    if (body.action === "save")
      await service.save(
        user,
        id,
        pageDraftSchema.parse(body.draft),
        z.number().int().min(0).parse(body.baseRevision),
      );
    else if (body.action === "recipient_link_issue") {
      const { token } = await (await recipientService()).issueLink(user, id);
      return json({ ok: true, url: `${appUrl()}/r/${token}` });
    } else if (body.action === "recipient_link_revoke")
      await (await recipientService()).revokeLink(user, id);
    else if (body.action === "recipient_settings")
      await (
        await recipientService()
      ).updateSettingsAsOrganizer(
        user,
        id,
        z
          .object({
            paused: z.boolean().optional(),
            considerations: considerationsSchema.optional(),
          })
          .parse(body.settings),
      );
    else if (body.action === "complete")
      await service.complete(user, id, z.string().uuid().parse(body.slotId));
    else {
      const status = z
        .enum(["draft", "published", "closed"])
        .parse(body.status);
      await service.setStatus(user, id, status);
    }
    return json({ ok: true });
  });
}
export async function DELETE(request: Request, context: Context) {
  return api(async () => {
    sameOrigin(request);
    const user = await requireUser(),
      { id } = await context.params;
    await (await supportService()).remove(user, id);
    return json({ ok: true });
  });
}
