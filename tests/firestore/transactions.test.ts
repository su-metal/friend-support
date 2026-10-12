import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { FirestoreRestStore } from "@/lib/firebase/firestore-rest";
import { SupportService } from "@/services/support";
import { RecipientService } from "@/services/recipient";
import { addDays, todayJst } from "@/lib/domain";
import { draft, user } from "../fixtures";
let environment: RulesTestEnvironment;
function recipientRequest(date: string, title: string) {
  return {
    kind: "meal" as const,
    date,
    startTime: "",
    endTime: "",
    title,
    description: "",
    privateInstructions: "",
  };
}
beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith("127.0.0.1:"))
    throw new Error("ローカルエミュレーターだけで実行してください");
  environment = await initializeTestEnvironment({
    projectId: "demo-friend-support",
    firestore: {
      host: "127.0.0.1",
      port: 8085,
      rules: await readFile("firestore.rules", "utf8"),
    },
  });
});
afterAll(async () => {
  await environment?.cleanup();
});
describe("Firestoreの実トランザクションとSecurity Rules", () => {
  it("60件の予定をまとめて取得し、欠けた文書でも順序を保つ", async () => {
    const store = new FirestoreRestStore(),
      service = new SupportService(store),
      input = draft();
    input.slots = Array.from({ length: 60 }, (_, i) => ({
      ...input.slots[0],
      title: `まとめ取得${i}`,
    }));
    const id = await service.create(user, input);
    await service.setStatus(user, id, "published");
    const p = await service.organizerPage(user, id);
    expect(p.slots).toHaveLength(60);
    const visible = await service.publicPage(p.slug);
    if (!visible || visible === "locked") throw new Error("Missing page");
    expect(visible.slots).toHaveLength(60);
    const result = await store.getMany<{ title: string }>([
      `support_slots/${p.slots[2].id}`,
      "support_slots/missing-document",
      `support_slots/${p.slots[0].id}`,
    ]);
    expect(result.map((s) => s?.title ?? null)).toEqual([
      p.slots[2].title,
      null,
      p.slots[0].title,
    ]);
    await service.save(user, id, {
      ...input,
      description: "説明を編集",
      slots: input.slots.map((s, i) => ({ ...s, id: p.slots[i].id })),
    }, p.revision);
    expect(
      (await service.list(user)).find((n) => n.id === id)?.slots,
    ).toHaveLength(60);
    await service.remove(user, id);
  });
  it("同時申し込み2件で1件だけ成功し、公開データに非公開情報を含めない", async () => {
    const service = new SupportService(new FirestoreRestStore()),
      id = await service.create(user, draft());
    await service.setStatus(user, id, "published");
    const page = await service.organizerPage(user, id);
    const results = await Promise.allSettled([
      new SupportService(new FirestoreRestStore()).assign(
        page.slug,
        page.slots[0].id,
        { supporterName: "A" },
      ),
      new SupportService(new FirestoreRestStore()).assign(
        page.slug,
        page.slots[0].id,
        { supporterName: "B" },
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(JSON.stringify(await service.publicPage(page.slug))).not.toContain(
      "非公開",
    );
    const winner = results.find((r) => r.status === "fulfilled")!;
    if (winner.status !== "fulfilled") throw new Error("No winner");
    expect(
      (await service.manage(winner.value.token))?.instructions?.allergyNotes,
    ).toBe("非公開アレルギー");
    await Promise.all([
      service.cancel(winner.value.token),
      new SupportService(new FirestoreRestStore()).cancel(winner.value.token),
    ]);
    expect(
      (await service.manage(winner.value.token))?.instructions,
    ).toBeUndefined();
    expect((await service.organizerPage(user, id)).slots[0].status).toBe(
      "open",
    );
    await service.remove(user, id);
  });
  it("ご本人の同時のお願いを両方確定し、古い画面からの保存で消さない", async () => {
    const service = new SupportService(new FirestoreRestStore()),
      base = draft(),
      start = todayJst();
    const id = await service.create(user, {
      ...base,
      startDate: start,
      endDate: addDays(start, 30),
    });
    await service.setStatus(user, id, "published");
    const stale = await service.organizerPage(user, id);
    const { token } = await new RecipientService(
      new FirestoreRestStore(),
    ).issueLink(user, id);
    const input = {
      kind: "meal" as const,
      date: start,
      startTime: "",
      endTime: "",
      title: "夕食を届ける",
      description: "",
      privateInstructions: "",
    };
    const results = await Promise.all([
      new RecipientService(new FirestoreRestStore()).addRequest(token, input),
      new RecipientService(new FirestoreRestStore()).addRequest(token, input),
    ]);
    await expect(
      service.save(
        user,
        id,
        {
          ...base,
          startDate: stale.startDate,
          endDate: stale.endDate,
          slots: stale.slots.map((s) => ({ ...s })),
        },
        stale.revision,
      ),
    ).rejects.toMatchObject({ status: 409 });
    const page = await service.organizerPage(user, id);
    expect(page.slots).toHaveLength(3);
    expect([...page.recipientSlotIds].sort()).toEqual(
      results.map((r) => r.slotId).sort(),
    );
    await service.remove(user, id);
  });
  it("最後の本人用予定2件を同時に取り消しても公開中に1件が残る", async () => {
    const service = new SupportService(new FirestoreRestStore()),
      base = draft(),
      start = todayJst(),
      id = await service.create(user, {
        ...base,
        startDate: start,
        endDate: addDays(start, 30),
        slots: [{ ...base.slots[0], date: addDays(start, 2) }],
      });
    await service.setStatus(user, id, "published");
    const { token } = await new RecipientService(
      new FirestoreRestStore(),
    ).issueLink(user, id);
    const requested = await Promise.all([
      new RecipientService(new FirestoreRestStore()).addRequest(
        token,
        recipientRequest(start, "初日の食事を届ける"),
      ),
      new RecipientService(new FirestoreRestStore()).addRequest(
        token,
        recipientRequest(addDays(start, 1), "翌日の食事を届ける"),
      ),
    ]);
    const current = await service.organizerPage(user, id);
    const requestIds = new Set(requested.map((item) => item.slotId));
    await service.save(
      user,
      id,
      {
        ...base,
        recipientDisplayName: current.recipientDisplayName,
        description: current.description,
        startDate: current.startDate,
        endDate: current.endDate,
        visibility: current.visibility,
        slots: current.slots
          .filter((slot) => requestIds.has(slot.id))
          .map((slot) => ({ ...slot })),
      },
      current.revision,
    );

    const outcomes = await Promise.allSettled(
      requested.map(({ slotId }) =>
        new RecipientService(new FirestoreRestStore()).withdrawRequest(
          token,
          slotId,
        ),
      ),
    );
    const fulfilled = outcomes.filter((result) => result.status === "fulfilled");
    const rejected = outcomes.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0]?.status === "rejected")
      expect(rejected[0].reason).toMatchObject({
        status: 409,
        code: "last_published_slot",
      });
    const after = await service.organizerPage(user, id);
    expect(after.slots).toHaveLength(1);
    expect(after.recipientSlotIds).toHaveLength(1);
    const removedId = requested.find(
      (_, index) => outcomes[index]?.status === "fulfilled",
    )?.slotId;
    const retainedId = requested.find((item) => item.slotId !== removedId)?.slotId;
    expect(removedId).toBeTruthy();
    expect(after.slots[0].id).toBe(retainedId);
    expect(
      await new FirestoreRestStore().get(
        `analytics_events/recipient-withdrawn-${removedId}`,
      ),
    ).toMatchObject({ name: "recipient_request_withdrawn" });
    expect(
      await new FirestoreRestStore().get(
        `analytics_events/recipient-withdrawn-${retainedId}`,
      ),
    ).toBeNull();
    await service.remove(user, id);
  });
  it("担当登録・本人の取り消し・ページ終了の競合はFirestoreで直列化する", async () => {
    const service = new SupportService(new FirestoreRestStore()),
      base = draft(),
      start = todayJst(),
      id = await service.create(user, {
        ...base,
        startDate: start,
        endDate: addDays(start, 30),
        slots: [{ ...base.slots[0], date: addDays(start, 2) }],
      });
    await service.setStatus(user, id, "published");
    const page = await service.organizerPage(user, id);
    const { token } = await new RecipientService(
      new FirestoreRestStore(),
    ).issueLink(user, id);
    const { slotId } = await new RecipientService(
      new FirestoreRestStore(),
    ).addRequest(token, recipientRequest(start, "競合するお願い"));
    const assignment = new SupportService(new FirestoreRestStore()).assign(
      page.slug,
      slotId,
      { supporterName: "担当者" },
    );
    const withdrawal = new RecipientService(
      new FirestoreRestStore(),
    ).withdrawRequest(token, slotId);
    const [assigned, withdrawn] = await Promise.allSettled([
      assignment,
      withdrawal,
    ]);
    const after = await service.organizerPage(user, id);
    const target = after.slots.find((slot) => slot.id === slotId);
    if (assigned.status === "fulfilled") {
      expect(withdrawn).toMatchObject({ status: "rejected" });
      if (withdrawn.status === "rejected")
        expect(withdrawn.reason).toMatchObject({
          status: 409,
          code: "assigned_slot",
        });
      expect(target?.status).toBe("assigned");
    } else {
      expect(withdrawn.status).toBe("fulfilled");
      expect(target).toBeUndefined();
    }

    const second = await new RecipientService(
      new FirestoreRestStore(),
    ).addRequest(token, recipientRequest(start, "終了と競合するお願い"));
    const [closed, closeRace] = await Promise.allSettled([
      service.setStatus(user, id, "closed"),
      new RecipientService(new FirestoreRestStore()).withdrawRequest(
        token,
        second.slotId,
      ),
    ]);
    expect(closed.status).toBe("fulfilled");
    const afterClose = await service.organizerPage(user, id);
    expect(afterClose.status).toBe("closed");
    expect(await new RecipientService(new FirestoreRestStore()).view(token)).toBe(
      null,
    );
    if (closeRace.status === "fulfilled") {
      expect(afterClose.slots.map((slot) => slot.id)).not.toContain(
        second.slotId,
      );
    } else {
      expect(afterClose.slots.map((slot) => slot.id)).toContain(second.slotId);
    }
    await expect(
      new RecipientService(new FirestoreRestStore()).withdrawRequest(
        token,
        second.slotId,
      ),
    ).rejects.toMatchObject({ status: 404 });
    await service.remove(user, id);
  });
  it("匿名・認証済みブラウザーから全コレクションの直接読み書きを拒否する", async () => {
    for (const client of [
      environment.unauthenticatedContext(),
      environment.authenticatedContext(user.id),
    ])
      for (const collection of [
        "support_pages",
        "support_slots",
        "slot_secrets",
        "page_secrets",
        "slot_assignments",
        "assignment_tokens",
        "recipient_tokens",
        "notifications",
        "analytics_events",
        "purchases",
        "organizations",
      ]) {
        const ref = doc(client.firestore(), collection, "attempt");
        await assertFails(getDoc(ref));
        await assertFails(setDoc(ref, { status: "published" }));
      }
  });
  it("主催者IDORとパスコード迂回をサーバーで拒否する", async () => {
    const service = new SupportService(new FirestoreRestStore()),
      id = await service.create(user, {
        ...draft(),
        visibility: "passcode",
        passcode: "1234",
      });
    await service.setStatus(user, id, "published");
    const page = await service.organizerPage(user, id);
    await expect(
      service.organizerPage({ ...user, id: "other" }, id),
    ).rejects.toMatchObject({ status: 404 });
    expect(await service.publicPage(page.slug)).toBe("locked");
    await expect(
      service.assign(page.slug, page.slots[0].id, { supporterName: "A" }),
    ).rejects.toMatchObject({ status: 403 });
    const version = await service.unlock(page.slug, "1234");
    expect(await service.publicPage(page.slug, version)).toBeTypeOf("object");
    await service.remove(user, id);
  });
});
