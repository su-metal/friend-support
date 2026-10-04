import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "@/services/memory-store";
import {
  SupportService,
  type PageDocument,
  type NotificationDocument,
} from "@/services/support";
import { AnalyticsService } from "@/services/analytics";
import { NotificationService } from "@/services/notifications";
import { hashToken } from "@/lib/security";
import { draft, user } from "../fixtures";
let store: MemoryStore, service: SupportService;
beforeEach(() => {
  store = new MemoryStore();
  service = new SupportService(store);
});
async function published(passcode?: string) {
  const id = await service.create(user, {
    ...draft(),
    ...(passcode ? { visibility: "passcode", passcode } : {}),
  });
  await service.setStatus(user, id, "published");
  const p = await service.organizerPage(user, id);
  return p;
}
describe("支援ページと担当", () => {
  it("担当済み予定を変えずにページ説明を編集できる", async () => {
    const p = await published();
    await service.assign(p.slug, p.slots[0].id, { supporterName: "A" });
    const old = await store.get<Record<string, unknown>>(
      `slot_secrets/${p.slots[0].id}`,
    );
    await store.set(
      `slot_secrets/${p.slots[0].id}`,
      Object.fromEntries(Object.entries(old!).reverse()),
    );
    await expect(
      service.save(user, p.id, {
        ...draft(),
        description: "説明だけ変更",
        slots: [{ ...draft().slots[0], id: p.slots[0].id }],
      }),
    ).resolves.toBeUndefined();
    expect((await service.organizerPage(user, p.id)).slots[0].status).toBe(
      "assigned",
    );
  });
  it("パスコード再設定で既存の解除許可が無効になる", async () => {
    const p = await published("1234"),
      version = await service.unlock(p.slug, "1234");
    await service.save(user, p.id, {
      ...draft(),
      visibility: "passcode",
      passcode: "5678",
      slots: [{ ...draft().slots[0], id: p.slots[0].id }],
    });
    expect(await service.publicPage(p.slug, version)).toBe("locked");
    await expect(service.unlock(p.slug, "1234")).rejects.toMatchObject({
      status: 403,
    });
    expect(
      await service.publicPage(p.slug, await service.unlock(p.slug, "5678")),
    ).toBeTypeOf("object");
  });
  it("キャンセルの計測イベントも1回だけ確定する", async () => {
    const p = await published(),
      a = await service.assign(p.slug, p.slots[0].id, { supporterName: "A" });
    await service.cancel(a.token);
    await service.cancel(a.token);
    expect(
      await store.query("analytics_events", [
        { field: "name", value: "assignment_cancelled" },
      ]),
    ).toHaveLength(1);
  });
  it("中断した削除を定期処理で再開する", async () => {
    const p = await published(),
      raw = await store.get<PageDocument>(`support_pages/${p.id}`);
    await store.set(`support_pages/${p.id}`, {
      ...raw!,
      status: "archived",
      deletionRequestedAt: new Date().toISOString(),
    });
    expect(await service.publicPage(p.slug)).toBeNull();
    expect(await service.retryDeletions()).toBe(1);
    expect(await store.get(`support_pages/${p.id}`)).toBeNull();
    expect(await store.query("page_members")).toHaveLength(0);
  });
  it("下書きは公開APIから取得できず、他人は編集できない", async () => {
    const id = await service.create(user, draft()),
      p = await service.organizerPage(user, id);
    expect(await service.publicPage(p.slug)).toBeNull();
    await expect(
      service.organizerPage({ ...user, id: "other" }, id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.setStatus({ ...user, id: "other" }, id, "published"),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("公開レスポンスには非公開情報・主催者メールを含めない", async () => {
    const p = await published();
    const json = JSON.stringify(await service.publicPage(p.slug));
    expect(json).not.toContain("privateInstructions");
    expect(json).not.toContain("allergyNotes");
    expect(json).not.toContain("非公開");
    expect(json).not.toContain(user.email);
    expect(json).not.toContain("organizerId");
  });
  it("2人の同時担当は1人のみ確定し、キャンセル後は再担当できる", async () => {
    const p = await published(),
      slot = p.slots[0];
    const results = await Promise.allSettled([
      service.assign(p.slug, slot.id, { supporterName: "A" }),
      service.assign(p.slug, slot.id, { supporterName: "B" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const result = results.find((r) => r.status === "fulfilled")!;
    if (result.status !== "fulfilled") throw new Error("No result");
    expect(
      (await service.manage(result.value.token))?.instructions
        ?.privateInstructions,
    ).toContain("非公開住所");
    await service.cancel(result.value.token);
    await service.cancel(result.value.token);
    expect(
      (await service.manage(result.value.token))?.instructions,
    ).toBeUndefined();
    await expect(
      service.assign(p.slug, slot.id, { supporterName: "C" }),
    ).resolves.toBeDefined();
    expect(
      await store.query<NotificationDocument>("notifications", [
        { field: "kind", value: "organizer_cancelled" },
      ]),
    ).toHaveLength(1);
  });
  it("トークンをハッシュ化し、メール用URLも暗号化する", async () => {
    const p = await published(),
      result = await service.assign(p.slug, p.slots[0].id, {
        supporterName: "A",
        supporterEmail: "a@example.invalid",
      });
    expect(
      await store.get(`assignment_tokens/${await hashToken(result.token)}`),
    ).not.toBeNull();
    expect(JSON.stringify(await store.query("slot_assignments"))).not.toContain(
      result.token,
    );
    expect(JSON.stringify(await store.query("notifications"))).not.toContain(
      result.token,
    );
    expect(await service.manage("x".repeat(43))).toBeNull();
  });
  it("パスコードと担当の両方でアクセスを検証する", async () => {
    const p = await published("1234");
    expect(await service.publicPage(p.slug)).toBe("locked");
    await expect(service.unlock(p.slug, "9999")).rejects.toMatchObject({
      status: 403,
    });
    const grant = await service.unlock(p.slug, "1234");
    expect(await service.publicPage(p.slug, grant)).toBeTypeOf("object");
    await expect(
      service.assign(p.slug, p.slots[0].id, { supporterName: "A" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.assign(p.slug, p.slots[0].id, { supporterName: "A" }, grant),
    ).resolves.toBeDefined();
  });
  it("他ページの予定へ担当できない", async () => {
    const p = await published(),
      other = await published();
    await expect(
      service.assign(p.slug, other.slots[0].id, { supporterName: "A" }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("担当済み予定は変更・削除できない", async () => {
    const p = await published();
    await service.assign(p.slug, p.slots[0].id, { supporterName: "A" });
    await expect(
      service.save(user, p.id, {
        ...draft(),
        slots: [{ ...draft().slots[0], id: p.slots[0].id, title: "変更" }],
      }),
    ).rejects.toMatchObject({ code: "assigned_slot" });
  });
  it("終了したページは受付と再公開を停止する", async () => {
    const p = await published();
    await service.setStatus(user, p.id, "closed");
    await expect(
      service.assign(p.slug, p.slots[0].id, { supporterName: "A" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.setStatus(user, p.id, "published"),
    ).rejects.toMatchObject({ code: "status" });
  });
  it("ページ削除は担当管理リンクと個人情報を削除する", async () => {
    const p = await published(),
      a = await service.assign(p.slug, p.slots[0].id, {
        supporterName: "A",
        supporterEmail: "a@example.invalid",
      });
    await service.remove(user, p.id);
    expect(await service.publicPage(p.slug)).toBeNull();
    expect(await service.manage(a.token)).toBeNull();
    expect(await store.query("slot_assignments")).toHaveLength(0);
    expect(await store.query("notifications")).toHaveLength(0);
    expect(await store.query("assignment_tokens")).toHaveLength(0);
  });
});
describe("通知と計測", () => {
  it("送信中断を繰り返しても5回の上限を超えない", async () => {
    const p = await published();
    await service.assign(p.slug, p.slots[0].id, { supporterName: "A" });
    const n = (await store.query<NotificationDocument>("notifications"))[0];
    await store.set(`notifications/${n.id}`, {
      ...n,
      status: "sending",
      attempts: 5,
      leaseUntil: "2000-01-01T00:00:00.000Z",
    });
    let calls = 0;
    await new NotificationService(store, {
      send: async () => {
        calls++;
      },
    }).dispatch();
    expect(calls).toBe(0);
    expect(
      (await store.get<NotificationDocument>(`notifications/${n.id}`))?.status,
    ).toBe("failed");
  });
  it("メールなしの担当者には主催者通知だけを登録する", async () => {
    const p = await published();
    await service.assign(p.slug, p.slots[0].id, { supporterName: "A" });
    expect(await store.query("notifications")).toHaveLength(1);
  });
  it("配信失敗を再試行し、複数workerでも同じ通知を同時送信しない", async () => {
    const p = await published();
    await service.assign(p.slug, p.slots[0].id, { supporterName: "A" });
    const sent: string[] = [];
    const notifications = new NotificationService(store, {
      send: async (email) => {
        sent.push(email.idempotencyKey);
        await new Promise((r) => setTimeout(r, 10));
      },
    });
    await Promise.all([notifications.dispatch(), notifications.dispatch()]);
    expect(sent).toHaveLength(1);
    const n = (await store.query<NotificationDocument>("notifications"))[0];
    expect(n.status).toBe("sent");
    expect(n.encryptedText).toBe("");
  });
  it("キャンセル後に担当確認メールとリマインドを送らない", async () => {
    const p = await published(),
      a = await service.assign(p.slug, p.slots[0].id, {
        supporterName: "A",
        supporterEmail: "a@example.invalid",
      });
    await service.cancel(a.token);
    const recipients: string[] = [];
    await new NotificationService(store, {
      send: async (email) => {
        recipients.push(email.to);
      },
    }).dispatch();
    expect(recipients).not.toContain("a@example.invalid");
  });
  it("配信エラーでも担当は維持し、通知は再試行待ちにする", async () => {
    const p = await published();
    await service.assign(p.slug, p.slots[0].id, { supporterName: "A" });
    expect(
      (
        await new NotificationService(store, {
          send: async () => {
            throw new Error("fail");
          },
        }).dispatch()
      ).failed,
    ).toBe(1);
    const n = (await store.query<NotificationDocument>("notifications"))[0];
    expect(n.status).toBe("pending");
    expect(n.attempts).toBe(1);
    expect((await service.organizerPage(user, p.id)).slots[0].status).toBe(
      "assigned",
    );
  });
  it("Analyticsから名前、メール、住所、トークンを除外する", async () => {
    await new AnalyticsService(store).track("assignment_started", {
      pageId: "abc",
      step: 2,
      email: "private@example.com",
      token: "secret",
      name: "山田",
      address: "住所",
    });
    const events = await store.query<{ properties: object }>(
      "analytics_events",
    );
    expect(events[0].properties).toEqual({ pageId: "abc", step: 2 });
  });
  it("JSTで期間終了を閉じる", async () => {
    const p = await published(),
      raw = await store.get<PageDocument>(`support_pages/${p.id}`);
    await store.set(`support_pages/${p.id}`, {
      ...raw!,
      endDate: "2000-01-01",
    });
    expect(
      await new NotificationService(store, {
        send: async () => {},
      }).closeExpiredPages(),
    ).toBe(1);
    expect(
      (await store.get<PageDocument>(`support_pages/${p.id}`))?.status,
    ).toBe("closed");
  });
});
