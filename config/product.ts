import type {
  SupportCategory,
  CaseTemplate,
  ConsiderationId,
  RecipientRequestKind,
} from "@/types/domain";
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
// ご本人が困りごとを出すときの定型。公開される予定名に体調などの理由を入れない。
export const recipientRequestTemplates: {
  kind: RecipientRequestKind;
  label: string;
  hint: string;
  categoryId: string;
  title: string;
  privatePlaceholder: string;
}[] = [
  {
    kind: "meal",
    label: "ご飯がほしい",
    hint: "夕食を届けてもらう",
    categoryId: "meal",
    title: "夕食を届ける",
    privatePlaceholder:
      "例：玄関前の箱に入れてください。チャイムは鳴らさないでください",
  },
  {
    kind: "supplies",
    label: "おむつ・日用品",
    hint: "買って届けてもらう",
    categoryId: "shopping",
    title: "日用品を買って届ける",
    privatePlaceholder: "例：新生児用テープ 1パック、おしりふき",
  },
  {
    kind: "transport",
    label: "上の子の送り迎え",
    hint: "園や習いごと",
    categoryId: "transport",
    title: "上の子を送迎する",
    privatePlaceholder: "例：〇〇園に17時お迎え。先生には伝えてあります",
  },
  {
    kind: "housework",
    label: "家事",
    hint: "ゴミ出し・洗濯など",
    categoryId: "housework",
    title: "家事を手伝う",
    privatePlaceholder: "例：燃えるゴミを朝8時までに出してほしいです",
  },
  {
    kind: "other",
    label: "その他",
    hint: "ちょっとしたお手伝い",
    categoryId: "other",
    title: "ちょっとしたお手伝い",
    privatePlaceholder: "例：やってほしいことを具体的に",
  },
];
export const considerationOptions: { id: ConsiderationId; label: string }[] = [
  { id: "no_return_gift", label: "お返し・内祝いは不要です" },
  {
    id: "doorstep_only",
    label: "玄関先に置いたら、声をかけずにお帰りください",
  },
  { id: "short_visit", label: "会うときは短めにお願いします" },
  { id: "no_reply", label: "お礼の返信は不要です" },
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
    recipientAccess: process.env.ENABLE_RECIPIENT_ACCESS === "true",
    contributions: false,
    caseTypes: process.env.ENABLE_CASE_TYPES === "true",
    calendarView: process.env.ENABLE_CALENDAR_VIEW === "true",
    sms: process.env.ENABLE_SMS === "true",
  };
}
