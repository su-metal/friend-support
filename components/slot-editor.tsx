"use client";
import { useState } from "react";
import { categories } from "@/config/product";
import { slotSchema } from "@/lib/domain";
import type { SlotDraft } from "@/types/domain";
import { ErrorMessage } from "./ui";
export function SlotEditor({
  initial,
  onSave,
}: {
  initial: SlotDraft;
  onSave: (slot: SlotDraft) => void;
}) {
  const [slot, setSlot] = useState(initial),
    [error, setError] = useState("");
  function update<K extends keyof SlotDraft>(key: K, value: SlotDraft[K]) {
    setSlot((prev) => ({ ...prev, [key]: value }));
  }
  const field = (
    id: "title" | "date" | "startTime" | "endTime" | "locationSummary",
    label: string,
    type = "text",
  ) => (
    <div className="field">
      <label htmlFor={`slot-${id}`}>{label}</label>
      <input
        id={`slot-${id}`}
        type={type}
        value={slot[id]}
        maxLength={id === "title" ? 80 : 100}
        onChange={(e) => update(id, e.target.value)}
        required={id === "title" || id === "date"}
      />
    </div>
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const result = slotSchema.safeParse(slot);
        if (!result.success) {
          setError(result.error.issues[0].message);
          return;
        }
        onSave(result.data);
      }}
      className="slot-form"
    >
      <div className="field">
        <label htmlFor="slot-category">サポートの種類</label>
        <select
          id="slot-category"
          value={slot.categoryId}
          onChange={(e) => update("categoryId", e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>
      {field("title", "予定の名前")}
      {field("date", "日付", "date")}
      <div className="field-grid">
        {field("startTime", "開始時刻（任意）", "time")}
        {field("endTime", "終了時刻（任意）", "time")}
      </div>
      <div className="field">
        <label htmlFor="slot-description">
          予定の説明（任意・共有ページに表示）
        </label>
        <textarea
          id="slot-description"
          rows={2}
          value={slot.description}
          maxLength={500}
          onChange={(e) => update("description", e.target.value)}
        />
        <p className="field-hint">
          住所・連絡先・健康情報は、ここには記入しないでください。
        </p>
      </div>
      {field("locationSummary", "受け渡しの概要（任意・共有ページに表示）")}
      <div className="private-form">
        <span className="tag">担当が決まった人だけに表示</span>
        <div className="field">
          <label htmlFor="private-instructions">
            詳しい受け渡し方法・住所（任意）
          </label>
          <textarea
            id="private-instructions"
            rows={3}
            placeholder="玄関前のボックスへお願いします。"
            value={slot.privateInstructions}
            maxLength={1000}
            onChange={(e) => update("privateInstructions", e.target.value)}
          />
        </div>
        {slot.categoryId === "meal" && (
          <>
            <p className="field-hint">
              食事の希望は、必要な内容だけ入力してください。
            </p>
            <div className="field">
              <label htmlFor="mealPeople">食事の人数（任意）</label>
              <input
                id="mealPeople"
                type="number"
                min={1}
                max={20}
                value={slot.mealPeople ?? ""}
                onChange={(e) =>
                  update(
                    "mealPeople",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
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
                <label htmlFor={key}>{label}（任意）</label>
                <input
                  id={key}
                  value={slot[key] ?? ""}
                  maxLength={key === "allergyNotes" ? 300 : 200}
                  onChange={(e) => update(key, e.target.value)}
                />
              </div>
            ))}
          </>
        )}
      </div>
      <p className="field-hint">この予定の担当者は1人です。</p>
      <ErrorMessage message={error} />
      <button className="button primary full">この予定を保存する</button>
    </form>
  );
}
