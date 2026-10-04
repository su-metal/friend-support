import { z } from "zod";
import type { SupportPage, SupportSlot } from "@/types/domain";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "正しい日付を入力してください");
const text = (max: number) => z.string().trim().max(max);
const time = z.union([
  z.literal(""),
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
]);
export const slotSchema = z
  .object({
    id: z.string().uuid().optional(),
    categoryId: z.enum([
      "meal",
      "shopping",
      "transport",
      "housework",
      "pet",
      "other",
    ]),
    title: text(80).min(1, "予定の名前を入力してください"),
    description: text(500),
    date: dateSchema,
    startTime: time,
    endTime: time,
    quantityNeeded: z.literal(1),
    locationSummary: text(100),
    privateInstructions: text(1000),
    mealPeople: z.number().int().min(1).max(20).optional(),
    foodDislikes: text(200).optional(),
    allergyNotes: text(300).optional(),
    handoffPreference: text(200).optional(),
  })
  .refine((s) => !s.endTime || (!!s.startTime && s.endTime > s.startTime), {
    message: "終了時刻は開始時刻より後にしてください",
    path: ["endTime"],
  });
export const pageDraftSchema = z
  .object({
    recipientDisplayName: text(60).min(
      1,
      "サポートする方のお名前を入力してください",
    ),
    description: text(600),
    startDate: dateSchema,
    endDate: dateSchema,
    visibility: z.enum(["link", "passcode"]),
    passcode: z
      .string()
      .regex(/^\d{4,8}$/, "パスコードは4〜8桁の数字です")
      .optional(),
    slots: z
      .array(slotSchema)
      .min(1, "サポート予定を1件以上追加してください")
      .max(60),
  })
  .superRefine((p, ctx) => {
    if (p.endDate < p.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "終了日は開始日以降にしてください",
      });
    if (Date.parse(p.endDate) - Date.parse(p.startDate) > 62 * 86400000)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "支援期間は最大63日です",
      });
    if (p.visibility === "passcode" && !p.passcode)
      ctx.addIssue({
        code: "custom",
        path: ["passcode"],
        message: "パスコードを入力してください",
      });
    p.slots.forEach((s, i) => {
      if (s.date < p.startDate || s.date > p.endDate)
        ctx.addIssue({
          code: "custom",
          path: ["slots", i, "date"],
          message: "予定の日付は支援期間内にしてください",
        });
    });
    const ids = p.slots.filter((s) => s.id).map((s) => s.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        path: ["slots"],
        message: "予定が重複しています",
      });
  });
export const assignmentSchema = z.object({
  slotId: z.string().uuid(),
  supporterName: text(40).min(1, "お名前を入力してください"),
  supporterEmail: z.union([z.literal(""), z.email().max(254)]).optional(),
  message: text(300).optional(),
});
export function todayJst(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function dateLabel(date: string, withYear = false) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    ...(withYear ? { year: "numeric" as const } : {}),
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00+09:00`));
}
export function shortDate(date: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00+09:00`));
}
export function canAssign(
  page: Pick<SupportPage, "status" | "endDate">,
  slot: Pick<
    SupportSlot,
    "status" | "date" | "quantityNeeded" | "supporterNames"
  >,
  today = todayJst(),
) {
  return (
    page.status === "published" &&
    page.endDate >= today &&
    slot.date >= today &&
    slot.status === "open" &&
    slot.supporterNames.length < slot.quantityNeeded
  );
}
export function fillStats(slots: SupportSlot[]) {
  const available = slots.filter((s) => s.status !== "cancelled");
  const filled = available.filter(
    (s) => s.status === "assigned" || s.status === "completed",
  ).length;
  return {
    total: available.length,
    filled,
    open: available.length - filled,
    percent: available.length
      ? Math.round((filled / available.length) * 100)
      : 0,
  };
}
export function isPageClosed(page: Pick<SupportPage, "status" | "endDate">) {
  return page.status === "closed" || page.endDate < todayJst();
}
