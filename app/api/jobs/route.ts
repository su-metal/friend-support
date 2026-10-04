import { api, json } from "@/lib/api";
import { equalSecret } from "@/lib/security";
import { getStore } from "@/services/factory";
import { SupportService } from "@/services/support";
import { isDemoMode } from "@/lib/env";
import {
  NotificationService,
  ResendEmailProvider,
} from "@/services/notifications";
import { AppError } from "@/lib/errors";
export async function GET(request: Request) {
  return api(async () => {
    if (
      !process.env.CRON_SECRET ||
      !(await equalSecret(
        request.headers.get("authorization") ?? "",
        `Bearer ${process.env.CRON_SECRET}`,
      ))
    )
      throw new AppError("unauthorized", "認証が必要です", 401);
    if (isDemoMode()) return json({ demo: true, sent: 0 });
    const store = await getStore();
    const deleted = await new SupportService(store).retryDeletions();
    if (deleted) return json({ deleted, closed: 0, sent: 0, failed: 0 });
    const buckets = await store.query<{ id: string; expiresAt: string }>(
      "rate_limit_buckets",
    );
    const expired = buckets
      .filter((b) => b.id && b.expiresAt < new Date().toISOString())
      .slice(0, 100);
    if (expired.length)
      await store.transaction(async (tx) =>
        expired.forEach((b) => tx.delete(`rate_limit_buckets/${b.id}`)),
      );
    const service = new NotificationService(store, new ResendEmailProvider());
    const closed = await service.closeExpiredPages();
    const result =
      process.env.RESEND_API_KEY && process.env.EMAIL_FROM
        ? await service.dispatch()
        : { sent: 0, failed: 0, emailConfigured: false };
    return json({ closed, deleted, ...result });
  });
}
