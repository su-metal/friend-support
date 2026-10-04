import { describe, expect, it } from "vitest";
import {
  pageDraftSchema,
  canAssign,
  fillStats,
  todayJst,
  addDays,
} from "@/lib/domain";
import { pricing, getFeatureFlags } from "@/config/product";
import { draft } from "../fixtures";
describe("日付、状態、容量、料金", () => {
  it("JSTの日付境界を扱う", () => {
    expect(todayJst(new Date("2026-10-03T15:00:00Z"))).toBe("2026-10-04");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("逆転、実在しない日付、期間外の予定を拒否する", () => {
    const d = draft();
    expect(
      pageDraftSchema.safeParse({ ...d, endDate: "2000-01-01" }).success,
    ).toBe(false);
    expect(
      pageDraftSchema.safeParse({ ...d, startDate: "2026-02-30" }).success,
    ).toBe(false);
    expect(
      pageDraftSchema.safeParse({
        ...d,
        slots: [{ ...d.slots[0], date: "2000-01-01" }],
      }).success,
    ).toBe(false);
  });
  it("終了時刻、容量、パスコードを検証する", () => {
    const d = draft();
    expect(
      pageDraftSchema.safeParse({
        ...d,
        slots: [{ ...d.slots[0], endTime: "17:00" }],
      }).success,
    ).toBe(false);
    expect(
      pageDraftSchema.safeParse({
        ...d,
        slots: [{ ...d.slots[0], quantityNeeded: 2 }],
      }).success,
    ).toBe(false);
    expect(
      pageDraftSchema.safeParse({ ...d, visibility: "passcode" }).success,
    ).toBe(false);
    expect(
      pageDraftSchema.safeParse({
        ...d,
        visibility: "passcode",
        passcode: "1234",
      }).success,
    ).toBe(true);
  });
  it("1枠1人、公開済み、受付中の日付だけ担当可能", () => {
    const p = { status: "published" as const, endDate: "2026-10-30" };
    const s = {
      status: "open" as const,
      date: "2026-10-20",
      quantityNeeded: 1,
      supporterNames: [] as string[],
    };
    expect(canAssign(p, s, "2026-10-04")).toBe(true);
    expect(canAssign(p, { ...s, supporterNames: ["誰か"] }, "2026-10-04")).toBe(
      false,
    );
    expect(canAssign({ ...p, status: "draft" }, s, "2026-10-04")).toBe(false);
    expect(canAssign(p, s, "2026-10-21")).toBe(false);
  });
  it("空の充足率は0、寄付は常に無効", () => {
    expect(fillStats([]).percent).toBe(0);
    expect(Number.isSafeInteger(pricing.plus.price)).toBe(true);
    expect(pricing.plus.price).toBeGreaterThan(0);
    expect(getFeatureFlags().contributions).toBe(false);
  });
});
