import { describe, expect, it } from "vitest";
import { buildIcs } from "@/lib/calendar";

const base = {
  uid: "slot-1@tonarino-te",
  title: "夕食を届ける（さくらへのサポート）",
  date: "2026-10-05",
  description:
    "担当者用の管理リンク\nhttps://example.test/manage-assignment/abc",
  url: "https://example.test/manage-assignment/abc",
};
const now = new Date("2026-10-04T00:00:00Z");

describe("カレンダー登録用ファイル", () => {
  it("JSTの時刻をUTCに変換し、終了時刻がなければ1時間にする", () => {
    const ics = buildIcs({ ...base, startTime: "18:00" }, now);
    expect(ics).toContain("DTSTART:20261005T090000Z");
    expect(ics).toContain("DTEND:20261005T100000Z");
    expect(ics).toContain("DTSTAMP:20261004T000000Z");
  });
  it("終了時刻があれば使い、時刻がなければ終日にする", () => {
    expect(
      buildIcs({ ...base, startTime: "08:30", endTime: "10:00" }, now),
    ).toContain("DTEND:20261005T010000Z");
    const allDay = buildIcs(base, now);
    expect(allDay).toContain("DTSTART;VALUE=DATE:20261005");
    expect(allDay).toContain("DTEND;VALUE=DATE:20261006");
  });
  it("特殊文字をエスケープし、75オクテットで折り返す", () => {
    const ics = buildIcs(
      { ...base, title: "買い物, 送迎; 家事\\", description: "あ".repeat(60) },
      now,
    );
    expect(ics).toContain("SUMMARY:買い物\\, 送迎\\; 家事\\\\");
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n"))
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(`DESCRIPTION:${"あ".repeat(60)}`);
  });
});
