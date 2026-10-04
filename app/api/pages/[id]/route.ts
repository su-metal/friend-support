import { z } from "zod";
import { pageDraftSchema } from "@/lib/domain";
import { api, json, sameOrigin, readBody } from "@/lib/api";
import { requireUser } from "@/lib/auth/server";
import { supportService } from "@/services/factory";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  return api(async () => {
    sameOrigin(request);
    const user = await requireUser(),
      { id } = await context.params,
      body = await readBody(request),
      service = await supportService();
    if (body.action === "save")
      await service.save(user, id, pageDraftSchema.parse(body.draft));
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
