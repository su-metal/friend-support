import type { EmailProvider } from "./contracts";
import type { DocumentStore } from "./store";
import type { NotificationDocument, PageDocument } from "./support";
import { decryptContent } from "@/lib/security";
import { todayJst } from "@/lib/domain";
export class ResendEmailProvider implements EmailProvider {
  async send(mail: {
    to: string;
    subject: string;
    text: string;
    idempotencyKey: string;
  }) {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
      throw new Error("メール送信設定が必要です");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": mail.idempotencyKey,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(`メール送信に失敗しました (${response.status})`);
  }
}
export class NotificationService {
  constructor(
    private store: DocumentStore,
    private provider: EmailProvider,
  ) {}
  async dispatch(limit = 2) {
    const stamp = new Date().toISOString();
    const pending = [
      ...(await this.store.query<NotificationDocument>("notifications", [
        { field: "status", value: "pending" },
      ])),
      ...(await this.store.query<NotificationDocument>("notifications", [
        { field: "status", value: "sending" },
      ])),
    ]
      .filter(
        (n) => n.dueAt <= stamp && (!n.leaseUntil || n.leaseUntil <= stamp),
      )
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .slice(0, limit);
    let sent = 0,
      failed = 0;
    for (const item of pending) {
      const leaseId = crypto.randomUUID();
      const claimed = await this.store.transaction(async (tx) => {
        const n = await tx.get<NotificationDocument>(
          `notifications/${item.id}`,
        );
        if (
          !n ||
          !["pending", "sending"].includes(n.status) ||
          (n.leaseUntil && n.leaseUntil > stamp)
        )
          return null;
        if (n.attempts >= 5) {
          tx.set(`notifications/${n.id}`, {
            ...n,
            status: "failed",
            leaseUntil: "",
          });
          return null;
        }
        const p = await tx.get<PageDocument>(
          `support_pages/${n.supportPageId}`,
        );
        const a = n.assignmentId
          ? await tx.get<{ status: string }>(
              `slot_assignments/${n.assignmentId}`,
            )
          : null;
        if (
          !p ||
          p.deletionRequestedAt ||
          (n.assignmentId && a?.status !== "active") ||
          (["previous_day", "same_day"].includes(n.kind) &&
            (p.status !== "published" || p.endDate < todayJst()))
        ) {
          tx.set(`notifications/${n.id}`, { ...n, status: "skipped" });
          return null;
        }
        const claimed = {
          ...n,
          status: "sending" as const,
          attempts: n.attempts + 1,
          leaseId,
          leaseUntil: new Date(Date.now() + 120000).toISOString(),
        };
        tx.set(`notifications/${n.id}`, { ...claimed });
        return claimed;
      });
      if (!claimed) continue;
      let success = false;
      try {
        await this.provider.send({
          to: claimed.to,
          subject: claimed.subject,
          text: await decryptContent(claimed.encryptedText),
          idempotencyKey: claimed.id,
        });
        success = true;
        sent++;
      } catch {
        failed++;
      }
      await this.store.transaction(async (tx) => {
        const n = await tx.get<NotificationDocument>(
          `notifications/${item.id}`,
        );
        if (n?.leaseId !== leaseId) return;
        tx.set(`notifications/${n.id}`, {
          ...n,
          status: success ? "sent" : n.attempts >= 5 ? "failed" : "pending",
          leaseUntil: "",
          ...(success
            ? { sentAt: new Date().toISOString(), encryptedText: "" }
            : {
                dueAt: new Date(
                  Date.now() + 60000 * 2 ** n.attempts,
                ).toISOString(),
              }),
        });
      });
    }
    return { sent, failed };
  }
  async closeExpiredPages(limit = 3) {
    const pages = await this.store.query<PageDocument>("support_pages", [
      { field: "status", value: "published" },
    ]);
    let closed = 0;
    for (const p of pages.filter((p) => p.endDate < todayJst()).slice(0, limit))
      if (p.endDate < todayJst())
        await this.store.transaction(async (tx) => {
          const current = await tx.get<PageDocument>(`support_pages/${p.id}`);
          if (current?.status === "published" && current.endDate < todayJst()) {
            tx.set(`support_pages/${p.id}`, {
              ...current,
              status: "closed",
              updatedAt: new Date().toISOString(),
            });
            tx.set(`analytics_events/closed-${p.id}`, {
              name: "page_completed",
              properties: { pageId: p.id },
              createdAt: new Date().toISOString(),
            });
            closed++;
          }
        });
    return closed;
  }
}
