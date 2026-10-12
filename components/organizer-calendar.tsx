"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { categories } from "@/config/product";
import { dateLabel, slotSchema, todayJst } from "@/lib/domain";
import type { OrganizerPage, SlotDraft } from "@/types/domain";
import { ErrorMessage, Modal, postJson } from "./ui";

const weekDays = ["日", "月", "火", "水", "木", "金", "土"];
type SlotFields = Omit<SlotDraft, "id">;

function monthOffset(month: string, change: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + change);
  return date.toISOString().slice(0, 7);
}

function initialSlot(date: string): SlotFields {
  const category = categories[0];
  return {
    categoryId: category.id,
    title: category.suggestedTitle,
    description: "",
    date,
    startTime: "",
    endTime: "",
    quantityNeeded: 1,
    locationSummary: "",
    privateInstructions: "",
  };
}

export function OrganizerCalendar({ page }: { page: OrganizerPage }) {
  const router = useRouter();
  const [month, setMonth] = useState(page.startDate.slice(0, 7));
  const [multiple, setMultiple] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [dialogDates, setDialogDates] = useState<string[]>([]);
  const [slot, setSlot] = useState<SlotFields>(() =>
    initialSlot(page.startDate),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const firstWeekDay = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const daysInMonth = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
  const count = page.slots.length;
  const startMonth = page.startDate.slice(0, 7);
  const endMonth = page.endDate.slice(0, 7);

  function openForDates(dates: string[]) {
    if (!dates.length || count + dates.length > 60) return;
    setDialogDates(dates);
    setSlot(initialSlot(dates[0]));
    setError("");
  }

  function toggleDate(date: string) {
    if (multiple) {
      setSelected((previous) =>
        previous.includes(date)
          ? previous.filter((item) => item !== date)
          : [...previous, date].sort(),
      );
      return;
    }
    setSelected([date]);
    openForDates([date]);
  }

  async function addSlots(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const slots = dialogDates.map((date) =>
        slotSchema.parse({ ...slot, date }),
      );
      await postJson(
        `/api/pages/${page.id}`,
        { action: "add_slots", slots, baseRevision: page.revision },
        "PATCH",
      );
      setDialogDates([]);
      setSelected([]);
      setMultiple(false);
      setBusy(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "予定を追加できませんでした");
      setBusy(false);
    }
  }

  return (
    <section className="organizer-calendar" aria-labelledby="calendar-title">
      <div className="calendar-header">
        <div>
          <h2 id="calendar-title">予定をカレンダーから追加</h2>
          <p className="muted">
            日付を選び、種類をタップ。詳しい内容はあとから加えられます。
          </p>
        </div>
        <button
          aria-pressed={multiple}
          className="button secondary calendar-multiple"
          disabled={count >= 60}
          onClick={() => {
            setMultiple((value) => !value);
            setSelected([]);
          }}
          type="button"
        >
          {multiple ? "日付選択をやめる" : "複数日に追加"}
        </button>
      </div>

      <div className="calendar-month">
        <button
          aria-label="前の月"
          className="icon-button calendar-month-arrow"
          disabled={month <= startMonth}
          onClick={() => setMonth((current) => monthOffset(current, -1))}
          type="button"
        >
          <ChevronLeft size={20} />
        </button>
        <h3>
          {Number(month.slice(0, 4))}年 {Number(month.slice(5, 7))}月
        </h3>
        <button
          aria-label="次の月"
          className="icon-button calendar-month-arrow"
          disabled={month >= endMonth}
          onClick={() => setMonth((current) => monthOffset(current, 1))}
          type="button"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {weekDays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div
        className="calendar-days"
        role="group"
        aria-label="予定を追加する日付"
      >
        {Array.from({ length: firstWeekDay }, (_, i) => (
          <span
            aria-hidden="true"
            className="calendar-day-empty"
            key={`empty-${i}`}
          />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const daySlots = page.slots.filter((item) => item.date === date);
          const countLabel = daySlots.length
            ? `、予定${daySlots.length}件`
            : "、予定なし";
          const unavailable =
            date < page.startDate || date > page.endDate || date < todayJst();
          return (
            <button
              aria-label={`${dateLabel(date)}${countLabel}`}
              aria-pressed={selected.includes(date)}
              className="calendar-day"
              data-date={date}
              disabled={unavailable || count >= 60}
              key={date}
              onClick={() => toggleDate(date)}
              type="button"
            >
              <span>{day}</span>
              <span
                aria-hidden="true"
                className={
                  daySlots.length
                    ? "calendar-day-dot"
                    : "calendar-day-dot empty"
                }
              />
            </button>
          );
        })}
      </div>

      {multiple && (
        <div className="calendar-batch-action">
          <span aria-live="polite">{selected.length}日を選択中</span>
          <button
            className="button primary"
            disabled={!selected.length || count + selected.length > 60}
            onClick={() => openForDates(selected)}
            type="button"
          >
            選択した日に追加
          </button>
        </div>
      )}

      {count === 0 ? (
        <p className="calendar-empty">
          最初の予定は、日付をタップして追加できます。
        </p>
      ) : (
        <p className="calendar-caption">
          ● 予定あり <span>　</span>1日に複数の予定も追加できます
        </p>
      )}
      <p className="calendar-count">{count}/60件</p>

      {dialogDates.length > 0 && (
        <Modal
          onClose={() => {
            setDialogDates([]);
            setError("");
          }}
          title={
            dialogDates.length === 1
              ? `${dateLabel(dialogDates[0])}の予定を追加`
              : `${dialogDates.length}日分の予定を追加`
          }
        >
          <form className="calendar-slot-form" onSubmit={addSlots}>
            <fieldset className="calendar-category-picker">
              <legend>どんなサポート？</legend>
              <div className="calendar-categories">
                {categories.map((category) => (
                  <button
                    aria-pressed={slot.categoryId === category.id}
                    className="calendar-category"
                    key={category.id}
                    onClick={() =>
                      setSlot((current) => ({
                        ...current,
                        categoryId: category.id,
                        title: category.suggestedTitle,
                      }))
                    }
                    type="button"
                  >
                    <span aria-hidden="true">{category.icon}</span>
                    {category.name}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="field">
              <label htmlFor="calendar-slot-title">予定の名前</label>
              <input
                autoFocus
                id="calendar-slot-title"
                maxLength={80}
                onChange={(event) =>
                  setSlot((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                required
                value={slot.title}
              />
            </div>

            <details className="calendar-slot-details">
              <summary>時刻・詳しい案内（任意）</summary>
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="calendar-start-time">開始時刻</label>
                  <input
                    id="calendar-start-time"
                    onChange={(event) =>
                      setSlot((current) => ({
                        ...current,
                        startTime: event.target.value,
                      }))
                    }
                    type="time"
                    value={slot.startTime}
                  />
                </div>
                <div className="field">
                  <label htmlFor="calendar-end-time">終了時刻</label>
                  <input
                    id="calendar-end-time"
                    onChange={(event) =>
                      setSlot((current) => ({
                        ...current,
                        endTime: event.target.value,
                      }))
                    }
                    type="time"
                    value={slot.endTime}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="calendar-description">みんなに見える説明</label>
                <textarea
                  id="calendar-description"
                  maxLength={500}
                  onChange={(event) =>
                    setSlot((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={2}
                  value={slot.description}
                />
              </div>
              <div className="field">
                <label htmlFor="calendar-location">
                  受け渡しの概要（任意）
                </label>
                <input
                  id="calendar-location"
                  maxLength={100}
                  onChange={(event) =>
                    setSlot((current) => ({
                      ...current,
                      locationSummary: event.target.value,
                    }))
                  }
                  value={slot.locationSummary}
                />
              </div>
              <div className="private-form">
                <span className="tag">担当が決まった人だけに表示</span>
                <div className="field">
                  <label htmlFor="calendar-private">
                    詳しい受け渡し方法・住所（任意）
                  </label>
                  <textarea
                    id="calendar-private"
                    maxLength={1000}
                    onChange={(event) =>
                      setSlot((current) => ({
                        ...current,
                        privateInstructions: event.target.value,
                      }))
                    }
                    rows={3}
                    value={slot.privateInstructions}
                  />
                </div>
                {slot.categoryId === "meal" && (
                  <>
                    <div className="field">
                      <label htmlFor="calendar-meal-people">
                        食事の人数（任意）
                      </label>
                      <input
                        id="calendar-meal-people"
                        max={20}
                        min={1}
                        onChange={(event) =>
                          setSlot((current) => ({
                            ...current,
                            mealPeople: event.target.value
                              ? Number(event.target.value)
                              : undefined,
                          }))
                        }
                        type="number"
                        value={slot.mealPeople ?? ""}
                      />
                    </div>
                    {(
                      [
                        ["foodDislikes", "苦手な食べ物"],
                        ["allergyNotes", "アレルギー等の注意"],
                        ["handoffPreference", "受け渡しの希望"],
                      ] as const
                    ).map(([key, label]) => (
                      <div className="field" key={key}>
                        <label htmlFor={`calendar-${key}`}>
                          {label}（任意）
                        </label>
                        <input
                          id={`calendar-${key}`}
                          maxLength={key === "allergyNotes" ? 300 : 200}
                          onChange={(event) =>
                            setSlot((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                          value={slot[key] ?? ""}
                        />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </details>

            <ErrorMessage message={error} />
            <button
              className="button primary full"
              disabled={busy}
              type="submit"
            >
              {busy
                ? "追加しています…"
                : page.status === "published"
                  ? "公開ページに追加する"
                  : "下書きに追加する"}
              <Plus size={17} />
            </button>
            {page.status === "published" && (
              <p className="field-hint">
                追加すると、すぐに共有ページで募集されます。
              </p>
            )}
          </form>
        </Modal>
      )}
    </section>
  );
}
