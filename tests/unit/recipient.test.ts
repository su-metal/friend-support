import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "@/services/memory-store";
import {
  SupportService,
  type NotificationDocument,
  type PageDocument,
} from "@/services/support";
import { RecipientService } from "@/services/recipient";
import { addDays, todayJst } from "@/lib/domain";
import type { RecipientRequestInput } from "@/types/domain";
import { draft, user } from "../fixtures";
let store: MemoryStore, support: SupportService, recipient: RecipientService;
beforeEach(() => {
  store = new MemoryStore();
  support = new SupportService(store);
  recipient = new RecipientService(store);
});
// 今日から始まる公開ページ（ご本人が今日のお願いを出せる）
async function published(owner = user) {
  const base = draft(),
    start = todayJst();
  const id = await support.create(owner, {
    ...base,
    startDate: start,
    endDate: addDays(start, 30),
    slots: [{ ...base.slots[0], date: addDays(start, 2) }],
  });
  await support.setStatus(owner, id, "published");
  return support.organizerPage(owner, id);
}
function request(
  input: Partial<RecipientRequestInput> = {},
): RecipientRequestInput {
  return {
    kind: "supplies",
    date: todayJst(),
    startTime: "",
    endTime: "",
    title: "日用品を買って届ける",
    description: "",
    privateInstructions: "新生児用テープ1パック",
    ...input,
  };
}
describe("ご本人用リンク", () => {
  it("お願いが公開ページに出て、非公開欄と本人の印は公開しない", async () => {
    const p = await published();
    const { token } = await recipient.issueLink(user, p.id);
    const { slotId } = await recipient.addRequest(token, request());
    const pub = await support.publicPage(p.slug);
    if (!pub || pub === "locked") throw new Error("unexpected");
    expect(pub.slots.map((s) => s.id)).toContain(slotId);
    const json = JSON.stringify(pub);
    expect(json).not.toContain("新生児用テープ");
    expect(json).not.toContain("recipientSlotIds");
    expect(json).not.toContain("recipientTokenHash");
    expect(json).not.toContain(token);
    const organizer = await support.organizerPage(user, p.id);
    expect(organizer.recipientSlotIds).toEqual([slotId]);
    expect(
      organizer.slots.find((s) => s.id === slotId)?.privateInstructions,
    ).toBe("新生児用テープ1パック");
  });
  it("お願い・計測・窓口役への通知を同じcommitで確定する", async () => {
    const p = await published();
    const { token } = await recipient.issueLink(user, p.id);
    const { slotId } = await recipient.addRequest(token, request());
    expect(
      await store.get(`analytics_events/recipient-request-${slotId}`),
    ).toMatchObject({
      name: "recipient_request_created",
      properties: { pageId: p.id, slotId, categoryId: "shopping" },
    });
    const n = await store.get<NotificationDocument>(
      `notifications/${slotId}-recipient-request`,
    );
    expect(n).toMatchObject({
      kind: "organizer_recipient_request",
      to: user.email,
      status: "pending",
    });
  });
  it("支援者は本人のお願いを通常どおり担当できる", async () => {
    const p = await published();
    const { token } = await recipient.issueLink(user, p.id);
    const { slotId } = await recipient.addRequest(token, request());
    const a = await support.assign(p.slug, slotId, { supporterName: "A" });
    const managed = await support.manage(a.token);
    expect(managed?.instructions?.privateInstructions).toBe(
      "新生児用テープ1パック",
    );
    await expect(
      support.assign(p.slug, slotId, { supporterName: "B" }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("作り直した古いリンクと無効にしたリンクでは何もできない", async () => {
    const p = await published();
    const first = await recipient.issueLink(user, p.id);
    const second = await recipient.issueLink(user, p.id);
    expect(await recipient.view(first.token)).toBeNull();
    await expect(
      recipient.addRequest(first.token, request()),
    ).rejects.toMatchObject({ status: 404 });
    expect(await recipient.view(second.token)).not.toBeNull();
    await recipient.revokeLink(user, p.id);
    expect(await recipient.view(second.token)).toBeNull();
    expect((await support.organizerPage(user, p.id)).recipientLinkActive).toBe(
      false,
    );
  });
  it("別の主催者はリンクを発行できず、別ページのお願いは取り消せない", async () => {
    const p = await published();
    const other = { id: "owner-two", email: "two@example.invalid" };
    await expect(recipient.issueLink(other, p.id)).rejects.toMatchObject({
      status: 404,
    });
    const q = await published(other);
    const mine = await recipient.issueLink(user, p.id);
    const theirs = await recipient.issueLink(other, q.id);
    const { slotId } = await recipient.addRequest(theirs.token, request());
    await recipient.withdrawRequest(mine.token, slotId);
    expect(
      (await support.organizerPage(other, q.id)).slots.map((s) => s.id),
    ).toContain(slotId);
  });
  it("窓口役が作った予定と担当が決まったお願いは取り消せない", async () => {
    const p = await published();
    const { token } = await recipient.issueLink(user, p.id);
    await expect(
      recipient.withdrawRequest(token, p.slots[0].id),
    ).rejects.toMatchObject({ status: 403 });
    const { slotId } = await recipient.addRequest(token, request());
    await support.assign(p.slug, slotId, { supporterName: "A" });
    await expect(
      recipient.withdrawRequest(token, slotId),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("担当前のお願いは取り消せ、再送しても壊れない", async () => {
    const p = await published();
    const { token } = await recipient.issueLink(user, p.id);
    const { slotId } = await recipient.addRequest(token, request());
    await recipient.withdrawRequest(token, slotId);
    await recipient.withdrawRequest(token, slotId);
    const organizer = await support.organizerPage(user, p.id);
    expect(organizer.slots.map((s) => s.id)).not.toContain(slotId);
    expect(organizer.recipientSlotIds).toEqual([]);
    expect(await store.get(`slot_secrets/${slotId}`)).toBeNull();
  });
  it("期間外・過去の日付と公開前のページにはお願いを出せない", async () => {
    const p = await published();
    const { token } = await recipient.issueLink(user, p.id);
    await expect(
      recipient.addRequest(token, request({ date: addDays(todayJst(), 40) })),
    ).rejects.toMatchObject({ code: "period" });
    await expect(
      recipient.addRequest(token, request({ date: addDays(todayJst(), -1) })),
    ).rejects.toMatchObject({ code: "period" });
    await support.setStatus(user, p.id, "draft");
    await expect(recipient.addRequest(token, request())).rejects.toMatchObject({
      code: "closed",
    });
  });
  it("お休み中は新しい担当を受け付けず、決まった担当は残る", async () => {
    const p = await published();
    const { token } = await recipient.issueLink(user, p.id);
    const first = await recipient.addRequest(token, request());
    const second = await recipient.addRequest(token, request());
    await support.assign(p.slug, first.slotId, { supporterName: "A" });
    await recipient.updateSettings(token, { paused: true });
    await expect(
      support.assign(p.slug, second.slotId, { supporterName: "B" }),
    ).rejects.toMatchObject({ status: 409 });
    const pub = await support.publicPage(p.slug);
    if (!pub || pub === "locked") throw new Error("unexpected");
    expect(pub.pausedAt).toBeTruthy();
    expect(pub.slots.find((s) => s.id === first.slotId)?.status).toBe(
      "assigned",
    );
    await recipient.updateSettingsAsOrganizer(user, p.id, { paused: false });
    await expect(
      support.assign(p.slug, second.slotId, { supporterName: "B" }),
    ).resolves.toBeTruthy();
  });
  it("支援する方へのお願いは許可した定型だけを保存して公開する", async () => {
    const p = await published();
    const { token } = await recipient.issueLink(user, p.id);
    await recipient.updateSettings(token, {
      considerations: ["no_return_gift", "no_return_gift", "no_reply"],
    });
    const pub = await support.publicPage(p.slug);
    if (!pub || pub === "locked") throw new Error("unexpected");
    expect(pub.considerations).toEqual(["no_return_gift", "no_reply"]);
    await expect(
      recipient.updateSettings(token, {
        // @ts-expect-error 定型にない値は拒否する
        considerations: ["free text"],
      }),
    ).rejects.toBeTruthy();
  });
  it("古い画面からの保存は拒否し、本人のお願いを消さない", async () => {
    const p = await published();
    const { token } = await recipient.issueLink(user, p.id);
    const stale = p.revision;
    const { slotId } = await recipient.addRequest(token, request());
    const base = draft();
    const editedDraft = {
      ...base,
      startDate: p.startDate,
      endDate: p.endDate,
      slots: [{ ...p.slots[0], description: "変更" }],
    };
    await expect(
      support.save(user, p.id, editedDraft, stale),
    ).rejects.toMatchObject({ status: 409, code: "stale" });
    const fresh = await support.organizerPage(user, p.id);
    expect(fresh.slots.map((s) => s.id)).toContain(slotId);
    await support.save(
      user,
      p.id,
      {
        ...editedDraft,
        slots: fresh.slots.map((s) => ({ ...s })),
      },
      fresh.revision,
    );
    const after = await support.organizerPage(user, p.id);
    expect(after.recipientSlotIds).toEqual([slotId]);
    expect(after.revision).toBe(fresh.revision + 1);
  });
  it("ページ削除でご本人用リンクも消える", async () => {
    const p = await published();
    const { token } = await recipient.issueLink(user, p.id);
    const hash = (await store.get<PageDocument>(`support_pages/${p.id}`))!
      .recipientTokenHash;
    await support.remove(user, p.id);
    expect(await store.get(`recipient_tokens/${hash}`)).toBeNull();
    expect(await recipient.view(token)).toBeNull();
  });
  it("ご本人用の表示に非公開欄や担当者の連絡先を含めない", async () => {
    const p = await published();
    await support.assign(p.slug, p.slots[0].id, {
      supporterName: "A",
      supporterEmail: "a@example.invalid",
      message: "主催者向けメッセージ",
    });
    const { token } = await recipient.issueLink(user, p.id);
    const view = await recipient.view(token);
    const json = JSON.stringify(view);
    expect(json).toContain("A");
    expect(json).not.toContain("a@example.invalid");
    expect(json).not.toContain("主催者向けメッセージ");
    expect(json).not.toContain("非公開住所サンプル");
    expect(json).not.toContain("organizerEmail");
    expect(json).not.toContain(user.email);
  });
});
