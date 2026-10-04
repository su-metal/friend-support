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
import { draft, user } from "../fixtures";
let environment: RulesTestEnvironment;
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
    });
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
