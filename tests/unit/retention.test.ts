import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "@/services/memory-store";
import {
  SupportService,
  type NotificationDocument,
  type PageDocument,
} from "@/services/support";
import { NotificationService, isStale } from "@/services/notifications";
import { addDays, todayJst } from "@/lib/domain";
import { RETENTION_DAYS } from "@/config/product";
import { draft, user } from "../fixtures";
let store: MemoryStore, service: SupportService;
beforeEach(() => {
  store = new MemoryStore();
  service = new SupportService(store);
});
async function published() {
  const id = await service.create(user, draft());
  await service.setStatus(user, id, "published");
  return service.organizerPage(user, id);
}
async function setEndDate(id: string, endDate: string) {
  const raw = await store.get<PageDocument>(`support_pages/${id}`);
  await store.set(`support_pages/${id}`, { ...raw!, endDate });
}
describe("終了後の自動削除", () => {
  it(`終了日から${RETENTION_DAYS}日を過ぎたページと個人情報を削除する`, async () => {
    const p = await published();
    const a = await service.assign(p.slug, p.slots[0].id, {
      supporterName: "A",
      supporterEmail: "a@example.invalid",
    });
    await setEndDate(p.id, addDays(todayJst(), -RETENTION_DAYS - 1));
    expect(await service.purgeExpired()).toBe(1);
    expect(await store.get(`support_pages/${p.id}`)).toBeNull();
    expect(await store.get(`slot_secrets/${p.slots[0].id}`)).toBeNull();
    expect(await store.query("slot_assignments")).toHaveLength(0);
    expect(await store.query("notifications")).toHaveLength(0);
    expect(await service.manage(a.token)).toBeNull();
    expect(
      await store.get(`analytics_events/auto-deleted-${p.id}`),
    ).toMatchObject({
      name: "page_auto_deleted",
      properties: { pageId: p.id },
    });
  });
  it(`終了日から${RETENTION_DAYS}日以内のページと公開中のページは残す`, async () => {
    const recent = await published();
    await setEndDate(recent.id, addDays(todayJst(), -RETENTION_DAYS));
    const active = await published();
    expect(await service.purgeExpired(10)).toBe(0);
    expect(await store.get(`support_pages/${recent.id}`)).not.toBeNull();
    expect(await store.get(`support_pages/${active.id}`)).not.toBeNull();
  });
  it("一度に削除する件数を制限する", async () => {
    const one = await published(),
      two = await published();
    const old = addDays(todayJst(), -RETENTION_DAYS - 5);
    await setEndDate(one.id, old);
    await setEndDate(two.id, old);
    expect(await service.purgeExpired(1)).toBe(1);
    expect(await service.purgeExpired(1)).toBe(1);
    expect(await service.purgeExpired(1)).toBe(0);
  });
});
describe("期限を過ぎた通知", () => {
  it("リマインドは12時間、ほかは24時間を過ぎると期限切れにする", () => {
    const now = Date.parse("2026-10-10T00:00:00Z");
    const at = (hours: number) => new Date(now - hours * 3600000).toISOString();
    expect(isStale({ kind: "same_day", dueAt: at(11) }, now)).toBe(false);
    expect(isStale({ kind: "same_day", dueAt: at(13) }, now)).toBe(true);
    expect(isStale({ kind: "confirmed", dueAt: at(23) }, now)).toBe(false);
    expect(isStale({ kind: "confirmed", dueAt: at(25) }, now)).toBe(true);
  });
  it("溜まった古い通知を送らず、本文を消す", async () => {
    const p = await published();
    await service.assign(p.slug, p.slots[0].id, {
      supporterName: "A",
      supporterEmail: "a@example.invalid",
    });
    const all = await store.query<NotificationDocument>("notifications");
    const old = all.find((n) => n.kind === "confirmed")!;
    await store.set(`notifications/${old.id}`, {
      ...old,
      dueAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    });
    const sent: string[] = [];
    const notifications = new NotificationService(store, {
      send: async (email) => {
        sent.push(email.idempotencyKey);
      },
    });
    expect(await notifications.expireStale()).toBe(1);
    await notifications.dispatch(10);
    expect(sent).not.toContain(old.id);
    expect(sent).toContain(`${all[0].assignmentId}-organizer`);
    const after = await store.get<NotificationDocument>(
      `notifications/${old.id}`,
    );
    expect(after?.status).toBe("skipped");
    expect(after?.encryptedText).toBe("");
  });
  it("送信時にも期限切れを確認する", async () => {
    const p = await published();
    await service.assign(p.slug, p.slots[0].id, { supporterName: "A" });
    const [n] = await store.query<NotificationDocument>("notifications");
    await store.set(`notifications/${n.id}`, {
      ...n,
      dueAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    });
    const sent: string[] = [];
    await new NotificationService(store, {
      send: async (email) => {
        sent.push(email.idempotencyKey);
      },
    }).dispatch();
    expect(sent).toEqual([]);
    expect(
      (await store.get<NotificationDocument>(`notifications/${n.id}`))?.status,
    ).toBe("skipped");
  });
});
