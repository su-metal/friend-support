import { addDays, todayJst } from "@/lib/domain";
import type { PageDraft } from "@/types/domain";
export const user = { id: "owner-one", email: "owner@example.invalid" };
export function draft(): PageDraft {
  const date = addDays(todayJst(), 2);
  return {
    recipientDisplayName: "テスト家族",
    description: "できることから。",
    startDate: date,
    endDate: addDays(date, 30),
    visibility: "link",
    slots: [
      {
        categoryId: "meal",
        title: "夕食を届ける",
        description: "夕食2人分",
        date,
        startTime: "18:00",
        endTime: "19:00",
        quantityNeeded: 1,
        locationSummary: "玄関前",
        privateInstructions: "非公開住所サンプル101号室",
        mealPeople: 2,
        allergyNotes: "非公開アレルギー",
      },
    ],
  };
}
