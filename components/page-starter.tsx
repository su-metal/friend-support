"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addDays, todayJst } from "@/lib/domain";
import type { PageDraft } from "@/types/domain";
import { ErrorMessage, postJson } from "./ui";

const periods = [2, 4, 8] as const;

export function PageStarter() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [weeks, setWeeks] = useState<(typeof periods)[number]>(4);
  const [startDate, setStartDate] = useState(() => addDays(todayJst(), 1));
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = name.trim();
    if (!displayName) {
      setError("サポートする方の呼び名を入力してください");
      return;
    }
    setBusy(true);
    setError("");
    const draft: PageDraft = {
      recipientDisplayName: displayName,
      description,
      startDate,
      endDate: addDays(startDate, weeks * 7 - 1),
      visibility: "link",
      slots: [],
    };
    try {
      const { id } = await postJson<{ id: string }>("/api/pages", draft);
      router.push(`/dashboard/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "下書きを保存できませんでした");
      setBusy(false);
    }
  }

  return (
    <div className="wizard-wrap page-starter">
      <div className="wizard-heading">
        <p className="eyebrow">CREATE YOUR SUPPORT PAGE</p>
        <h1>サポートページを作る</h1>
        <p>まずはページだけ。予定はあとから追加できます。</p>
      </div>
      <form className="wizard-card" onSubmit={createPage}>
        <div className="field">
          <label htmlFor="recipient">サポートする方の呼び名</label>
          <input
            autoComplete="off"
            id="recipient"
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder="例：田中さん家族"
            required
            value={name}
          />
          <p className="field-hint">ニックネームでも大丈夫です。</p>
        </div>

        <fieldset className="period-picker">
          <legend>サポート期間の目安</legend>
          <div className="period-options">
            {periods.map((weeksOption) => (
              <button
                aria-pressed={weeks === weeksOption}
                className={`button ${weeks === weeksOption ? "primary" : "secondary"}`}
                key={weeksOption}
                onClick={() => setWeeks(weeksOption)}
                type="button"
              >
                {weeksOption}週間
              </button>
            ))}
          </div>
          <p className="field-hint">あとから変更できます。</p>
        </fieldset>

        <details className="starter-details">
          <summary>開始日や、みんなへのひとことを入力</summary>
          <div className="field">
            <label htmlFor="start-date">開始日</label>
            <input
              id="start-date"
              min={todayJst()}
              onChange={(event) => setStartDate(event.target.value)}
              required
              type="date"
              value={startDate}
            />
          </div>
          <div className="field">
            <label htmlFor="description">みんなへのひとこと（任意）</label>
            <textarea
              id="description"
              maxLength={600}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              value={description}
            />
            <p className="field-hint">
              詳しい住所や健康上の注意は入力しないでください。
            </p>
          </div>
        </details>

        <div className="gentle-note">
          ご本人以外が作る場合は、内容と共有範囲について了承を得てください。
        </div>
        <ErrorMessage message={error} />
        <button className="button primary full" disabled={busy} type="submit">
          {busy ? "下書きを作成しています…" : "ページを作って予定を追加する"}
        </button>
        <p className="field-hint starter-save-note">
          この時点では公開されません。予定は1件から追加できます。
        </p>
      </form>
    </div>
  );
}
