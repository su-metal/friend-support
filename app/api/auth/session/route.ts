import { api, json, sameOrigin, rateLimit, readBody } from "@/lib/api";
import { authService, setSession } from "@/lib/auth/server";
import { z } from "zod";
export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    await rateLimit(request, "session", 20);
    const body = z
      .object({ idToken: z.string().max(5000) })
      .parse(await readBody(request));
    await setSession(await authService.createSession(body.idToken));
    return json({ ok: true });
  });
}
export async function DELETE(request: Request) {
  return api(async () => {
    sameOrigin(request);
    await authService.signOut();
    return json({ ok: true });
  });
}
