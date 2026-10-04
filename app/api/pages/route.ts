import { pageDraftSchema } from "@/lib/domain";
import { api, json, sameOrigin, rateLimit, readBody } from "@/lib/api";
import { requireUser } from "@/lib/auth/server";
import { supportService } from "@/services/factory";

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    const user = await requireUser();
    await rateLimit(request, `create-${user.id}`, 20);
    const draft = pageDraftSchema.parse(await readBody(request));
    const service = await supportService();
    const id = await service.create(user, draft);
    return json({ id }, 201);
  });
}
