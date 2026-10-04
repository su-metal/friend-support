import { categories } from "@/config/product";
import { addDays, todayJst } from "@/lib/domain";
import { MemoryStore } from "./memory-store";
import { SupportService } from "./support";
export const demoUser = { id: "demo-organizer", email: "demo@example.invalid" };
export async function makeDemoStore() {
  const store = new MemoryStore(),
    service = new SupportService(store),
    start = addDays(todayJst(), 1);
  const id = await service.create(demoUser, {
    recipientDisplayName: "田中さん家族",
    description:
      "新しい家族を迎えた田中さん家族の、最初の1か月をサポートします。できることを、できる日に。無理のない範囲で参加してもらえたらうれしいです。",
    startDate: start,
    endDate: addDays(start, 30),
    visibility: "link",
    slots: Array.from({ length: 8 }, (_, i) => {
      const c = categories[[0, 1, 2, 0, 4, 3, 0, 1][i]];
      return {
        categoryId: c.id,
        title: c.suggestedTitle,
        description:
          c.id === "meal"
            ? "おとな2人分。手作りでも、お店のお惣菜でもうれしいです。"
            : "短い時間のお手伝いで大丈夫です。",
        date: addDays(start, i),
        startTime: c.id === "meal" ? "18:00" : "16:00",
        endTime: c.id === "meal" ? "19:00" : "17:00",
        quantityNeeded: 1,
        locationSummary: "自宅の玄関前で受け渡し",
        privateInstructions:
          "【デモ用】サンプルマンション101号室。インターホンを押さず、玄関前のボックスへお願いします。",
        ...(c.id === "meal"
          ? {
              mealPeople: 2,
              foodDislikes: "辛いもの",
              allergyNotes: "【デモ】卵を含まないもの",
              handoffPreference: "玄関前のボックス",
            }
          : {}),
      };
    }),
  });
  const p = await store.get<import("./support").PageDocument>(
    `support_pages/${id}`,
  );
  if (!p) throw new Error("seed failed");
  await store.set(`support_pages/${id}`, {
    ...p,
    slug: "demo",
    status: "published",
  });
  await store.set("page_slugs/demo", { pageId: id });
  for (const [i, name] of [
    [1, "佐藤"],
    [3, "山田"],
    [5, "鈴木"],
  ] as const)
    await service.assign("demo", p.slotIds[i], { supporterName: name });
  return store;
}
