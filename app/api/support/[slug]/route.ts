import { z } from "zod";
import { cookies } from "next/headers";
import {
  api,
  json,
  sameOrigin,
  rateLimit,
  readBody,
  pageAccessVersion,
} from "@/lib/api";
import { signGrant } from "@/lib/security";
import { appUrl } from "@/lib/env";
import { supportService } from "@/services/factory";
type Context = { params: Promise<{ slug: string }> };
export async function GET(request: Request, context: Context) {
  return api(async () => {
    const { slug } = await context.params;
    const page = await (
      await supportService()
    ).publicPage(slug, await pageAccessVersion(slug));
    return json(page, page ? (page === "locked" ? 403 : 200) : 404);
  });
}
export async function POST(request: Request, context: Context) {
  return api(async () => {
    sameOrigin(request);
    await rateLimit(request, "passcode", 8);
    const { slug } = await context.params;
    const { passcode } = z
      .object({ passcode: z.string().regex(/^\d{4,8}$/) })
      .parse(await readBody(request));
    const version = await (await supportService()).unlock(slug, passcode);
    (await cookies()).set(
      `support-access-${slug}`,
      await signGrant({ purpose: "page-access", slug, version }, "1d"),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(appUrl()).protocol === "https:",
        maxAge: 86400,
        path: "/",
      },
    );
    return json({ ok: true });
  });
}
