import type { SupportCategory, CaseTemplate } from "@/types/domain";
export const categories: SupportCategory[] = [
  { id: "meal", name: "食事", icon: "🍱", suggestedTitle: "夕食を届ける" },
  {
    id: "shopping",
    name: "買い物",
    icon: "🛒",
    suggestedTitle: "食料品を買う",
  },
  {
    id: "transport",
    name: "送迎",
    icon: "🚗",
    suggestedTitle: "上の子を送迎する",
  },
  { id: "housework", name: "家事", icon: "🧹", suggestedTitle: "ゴミ出し" },
  { id: "pet", name: "ペット", icon: "🐕", suggestedTitle: "犬の散歩" },
  {
    id: "other",
    name: "その他",
    icon: "📦",
    suggestedTitle: "ちょっとしたお手伝い",
  },
];
export const caseTemplates: CaseTemplate[] = [
  {
    id: "postpartum-basic",
    caseType: "postpartum",
    name: "産後の暮らし",
    description: "必要なサポートを、できる人が少しずつ。",
    suggestedCategories: categories.map((c) => c.id),
    suggestedSlots: categories.map((c) => ({
      categoryId: c.id,
      title: c.suggestedTitle,
    })),
    active: true,
  },
];
function price(value: string | undefined, fallback: number) {
  const n = Number(value ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error("料金設定が不正です");
  return n;
}
export const pricing = {
  plus: {
    price: price(process.env.PLUS_PRICE_JPY, 980),
    currency: "JPY" as const,
  },
  pro: { monthly: price(process.env.PRO_MONTHLY_PRICE_JPY, 4980) },
};
export function getFeatureFlags() {
  return {
    plus: process.env.ENABLE_PLUS === "true",
    pro: process.env.ENABLE_PRO === "true",
    giftPartners: process.env.ENABLE_GIFT_PARTNERS === "true",
    recipientApproval: process.env.ENABLE_RECIPIENT_APPROVAL === "true",
    contributions: false,
    caseTypes: process.env.ENABLE_CASE_TYPES === "true",
    calendarView: process.env.ENABLE_CALENDAR_VIEW === "true",
    sms: process.env.ENABLE_SMS === "true",
  };
}
