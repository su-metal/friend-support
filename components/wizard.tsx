"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  Eye,
  LockKeyhole,
} from "lucide-react";
import { categories } from "@/config/product";
import { addDays, todayJst, dateLabel, pageDraftSchema } from "@/lib/domain";
import type { PageDraft, SlotDraft, OrganizerPage } from "@/types/domain";
import { Modal, ErrorMessage, postJson } from "./ui";
import { SlotEditor } from "./slot-editor";
import { track } from "./analytics";
const labels = ["だれに", "いつ", "サポート", "確認", "公開"];
export function Wizard({ existing }: { existing?: OrganizerPage }) {
  const router = useRouter();
  const start = addDays(todayJst(), 1);
  const [draft, setDraft] = useState<PageDraft>(
    existing
      ? {
          recipientDisplayName: existing.recipientDisplayName,
          description: existing.description,
          startDate: existing.startDate,
          endDate: existing.endDate,
          visibility: existing.visibility,
          slots: existing.slots.map((s) => ({
            id: s.id,
            categoryId: s.categoryId,
            title: s.title,
            description: s.description,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            quantityNeeded: 1,
            locationSummary: s.locationSummary,
            privateInstructions: s.privateInstructions,
            mealPeople: s.mealPeople,
            foodDislikes: s.foodDislikes,
            allergyNotes: s.allergyNotes,
            handoffPreference: s.handoffPreference,
          })),
        }
      : {
          recipientDisplayName: "",
          description: "",
          startDate: start,
          endDate: addDays(start, 30),
          visibility: "link",
          slots: [],
        },
  );
  const [step, setStep] = useState(0),
    [editor, setEditor] = useState<{ index: number; slot: SlotDraft } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [createdId, setCreatedId] = useState("");
  function update<K extends keyof PageDraft>(key: K, value: PageDraft[K]) {
    setDraft((p) => ({ ...p, [key]: value }));
  }
  function next() {
    setError("");
    if (step === 0 && !draft.recipientDisplayName.trim()) {
      setError("サポートする方のお名前を入力してください");
      return;
    }
    if (
      step === 1 &&
      (draft.endDate < draft.startDate ||
        !draft.startDate ||
        !draft.endDate ||
        Date.parse(draft.endDate) - Date.parse(draft.startDate) > 62 * 86400000)
    ) {
      setError("支援期間は開始日から最大63日で設定してください");
      return;
    }
    if (step === 2) {
      const result = pageDraftSchema.safeParse({
        ...draft,
        visibility: "link",
        passcode: undefined,
      });
      if (!result.success) {
        setError(result.error.issues[0].message);
        return;
      }
    }
    track("create_step_completed", { step: step + 1 });
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function addSlot(categoryId: string) {
    const c = categories.find((c) => c.id === categoryId)!;
    setEditor({
      index: -1,
      slot: {
        categoryId,
        title: c.suggestedTitle,
        description: "",
        date: draft.startDate,
        startTime: "",
        endTime: "",
        quantityNeeded: 1,
        locationSummary: "",
        privateInstructions: "",
      },
    });
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      pageDraftSchema.parse(draft);
      if (existing) {
        await postJson(
          `/api/pages/${existing.id}`,
          { action: "save", draft },
          "PATCH",
        );
        router.push(`/dashboard/${existing.id}`);
        router.refresh();
      } else {
        const { id } = await postJson<{ id: string }>("/api/pages", draft);
        setCreatedId(id);
        setStep(4);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存できませんでした");
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    try {
      await postJson(
        `/api/pages/${createdId}`,
        { status: "published" },
        "PATCH",
      );
      router.push(`/dashboard/${createdId}?published=1`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "公開できませんでした");
      setBusy(false);
    }
  }
  return (
    <div className="wizard-wrap">
      <Link href="/dashboard" className="back-link">
        <ArrowLeft size={16} />
        マイページへ
      </Link>
      <div className="wizard-heading">
        <p className="eyebrow">CREATE YOUR SUPPORT PAGE</p>
        <h1>{existing ? "サポートページを編集" : "サポートページを作る"}</h1>
        <p>大切な人に必要な手助けを、少しずつ。</p>
      </div>
      <ol className="wizard-progress" aria-label="作成のステップ">
        {labels.map((label, i) => (
          <li
            key={label}
            className={i === step ? "current" : i < step ? "done" : ""}
            aria-current={i === step ? "step" : undefined}
          >
            <span>{i < step ? <Check size={15} /> : i + 1}</span>
            <small>{label}</small>
          </li>
        ))}
      </ol>
      <section className="wizard-card" aria-labelledby="wizard-title">
        <p className="step-label">STEP {String(step + 1).padStart(2, "0")}</p>
        {step === 0 && (
          <>
            <h2 id="wizard-title">誰をサポートしますか？</h2>
            <p className="muted">呼び名やニックネームでも大丈夫です。</p>
            <div className="field">
              <label htmlFor="recipient">サポートする方のお名前</label>
              <input
                id="recipient"
                placeholder="例：田中さん家族"
                value={draft.recipientDisplayName}
                maxLength={60}
                onChange={(e) => update("recipientDisplayName", e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="description">みんなへのひとこと（任意）</label>
              <textarea
                id="description"
                rows={4}
                placeholder="新しい家族を迎えた最初の1か月を、みんなで少しずつサポートします。"
                maxLength={600}
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
              />
              <p className="field-hint">
                この文章は共有ページに表示されます。詳細な住所や健康情報は含めないでください。
              </p>
            </div>
            <div className="gentle-note">
              ご本人以外が作る場合は、ページの内容と共有範囲について、ご本人の了承を得てください。
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h2 id="wizard-title">いつから、いつまで？</h2>
            <p className="muted">まずは1か月くらいの、無理のない期間から。</p>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="start">開始日</label>
                <input
                  id="start"
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => update("startDate", e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="end">終了日</label>
                <input
                  id="end"
                  type="date"
                  value={draft.endDate}
                  min={draft.startDate}
                  onChange={(e) => update("endDate", e.target.value)}
                />
              </div>
            </div>
            <p className="field-hint">
              無料プランでは、最大63日まで設定できます。
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <h2 id="wizard-title">どんなサポートが必要ですか？</h2>
            <p className="muted">種類を選んで、日付や希望を追加しましょう。</p>
            <div className="preset-grid">
              {categories.map((c) => (
                <button key={c.id} onClick={() => addSlot(c.id)}>
                  <span>{c.icon}</span>
                  {c.name}
                  <Plus size={15} />
                </button>
              ))}
            </div>
            <div className="draft-slots">
              {draft.slots.length === 0 && (
                <div className="empty-small">
                  必要なサポートを、ひとつ追加してみましょう。
                </div>
              )}
              {draft.slots.map((s, i) => {
                const assigned = !!existing?.slots.find(
                  (o) =>
                    o.id === s.id &&
                    ["assigned", "completed"].includes(o.status),
                );
                return (
                  <div className="draft-slot" key={s.id ?? i}>
                    <span className="category-icon">
                      {categories.find((c) => c.id === s.categoryId)?.icon}
                    </span>
                    <div>
                      <strong>{s.title}</strong>
                      <p>
                        {dateLabel(s.date)} {s.startTime}
                        {assigned && " · 担当確定済み"}
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`${s.title}を編集`}
                      disabled={assigned}
                      onClick={() => setEditor({ index: i, slot: s })}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`${s.title}を削除`}
                      disabled={assigned}
                      onClick={() =>
                        update(
                          "slots",
                          draft.slots.filter((_, index) => i !== index),
                        )
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h2 id="wizard-title">ページを確認しましょう。</h2>
            <p className="muted">
              必要な予定がそろったら、共有の準備は完了です。
            </p>
            <div className="preview-box">
              <span className="tag">
                <Eye size={13} />
                共有ページのプレビュー
              </span>
              <h3>
                {draft.recipientDisplayName}を<br />
                みんなでサポート
              </h3>
              <p className="muted">
                {dateLabel(draft.startDate)} – {dateLabel(draft.endDate)}
              </p>
              <p className="preserve-lines">{draft.description}</p>
              <div className="preview-slots">
                {draft.slots.map((s, i) => (
                  <div key={i}>
                    <span>
                      {categories.find((c) => c.id === s.categoryId)?.icon}
                    </span>
                    <div>
                      <strong>{s.title}</strong>
                      <small>
                        {dateLabel(s.date)} {s.startTime}
                      </small>
                    </div>
                    <span className="tag">募集中</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={draft.visibility === "passcode"}
                  onChange={(e) =>
                    update("visibility", e.target.checked ? "passcode" : "link")
                  }
                />
                <LockKeyhole size={17} />
                ページにパスコードを設定する
              </label>
              <p className="field-hint">
                リンクを知っている人だけに共有します。さらにパスコードでも保護できます。
              </p>
            </div>
            {draft.visibility === "passcode" && (
              <div className="field">
                <label htmlFor="passcode">
                  4〜8桁の数字{existing ? "（編集時は再設定してください）" : ""}
                </label>
                <input
                  id="passcode"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4,8}"
                  minLength={4}
                  maxLength={8}
                  value={draft.passcode ?? ""}
                  onChange={(e) => update("passcode", e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            )}
          </>
        )}
        {step === 4 && (
          <div className="publish-step">
            <span className="success-icon">
              <Check size={29} />
            </span>
            <h2 id="wizard-title">ページの準備ができました。</h2>
            <p className="muted">
              公開すると、共有リンクから予定を見て
              <br />
              担当を選べるようになります。
            </p>
            <div className="gentle-note">
              ご本人に内容を確認してもらい、家族や友人など身近な人に共有してください。
            </div>
            <button
              className="button primary full"
              onClick={publish}
              disabled={busy}
            >
              {busy ? "公開しています…" : "ページを公開する"}
              <ArrowRight size={18} />
            </button>
            <Link href={`/dashboard/${createdId}`} className="text-link">
              下書きのまま保存する
            </Link>
          </div>
        )}
        <ErrorMessage message={error} />
        {step < 4 && (
          <div className="wizard-actions">
            <button
              className="button subtle"
              onClick={() => {
                setError("");
                setStep((s) => s - 1);
              }}
              disabled={step === 0 || busy}
            >
              <ArrowLeft size={17} />
              戻る
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={step === 3 ? save : next}
            >
              {busy
                ? "保存しています…"
                : step === 3
                  ? existing
                    ? "変更を保存"
                    : "下書きを保存して公開へ"
                  : "次へ"}
              <ArrowRight size={17} />
            </button>
          </div>
        )}
      </section>
      {editor && (
        <Modal title="サポート予定を追加・編集" onClose={() => setEditor(null)}>
          <SlotEditor
            initial={editor.slot}
            onSave={(slot) => {
              update(
                "slots",
                editor.index < 0
                  ? [...draft.slots, slot]
                  : draft.slots.map((s, i) => (i === editor.index ? slot : s)),
              );
              setEditor(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
