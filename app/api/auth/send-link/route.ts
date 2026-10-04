import { z } from "zod";
import { api, json, sameOrigin, rateLimit, readBody } from "@/lib/api";
import { appUrl, isDemoMode } from "@/lib/env";
import { AppError } from "@/lib/errors";
export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    await rateLimit(request, "magic-link", 5);
    const { email } = z
      .object({ email: z.email().max(254) })
      .parse(await readBody(request));
    if (isDemoMode()) return json({ demo: true });
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY)
      throw new AppError("config", "ログイン設定の準備中です", 503);
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "EMAIL_SIGNIN",
          email,
          continueUrl: `${appUrl()}/auth/complete`,
          canHandleCodeInApp: true,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new AppError(
        "send",
        "メールを送れませんでした。アドレスを確認してお試しください",
        503,
      );
    return json({ ok: true });
  });
}
