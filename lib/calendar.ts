import { addDays } from "./domain";

// 担当者の端末だけで作るカレンダー登録用ファイル。住所・食事の注意・非公開指示は含めない。
export interface CalendarEventInput {
  uid: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  description: string;
  url: string;
}

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC 5545: 75オクテットを超える行は折り返し、続きの行は空白で始める。
function foldLine(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "",
    size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function jstToUtc(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h - 9, min));
}

function utcStamp(value: Date) {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function buildIcs(event: CalendarEventInput, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//tonarino-te//support//JA",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
  ];
  if (event.startTime) {
    const start = jstToUtc(event.date, event.startTime);
    const end =
      event.endTime && event.endTime > event.startTime
        ? jstToUtc(event.date, event.endTime)
        : new Date(start.getTime() + 60 * 60 * 1000);
    lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`);
  } else {
    lines.push(
      `DTSTART;VALUE=DATE:${event.date.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${addDays(event.date, 1).replace(/-/g, "")}`,
    );
  }
  lines.push(
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `URL:${event.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  );
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
