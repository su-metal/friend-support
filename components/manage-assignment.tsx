"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Check,
  CalendarDays,
  Clock3,
  LockKeyhole,
  Heart,
  ArrowRight,
} from "lucide-react";
import { categories } from "@/config/product";
import { dateLabel } from "@/lib/domain";
import type { ManagedAssignment } from "@/types/domain";
import { Modal, ErrorMessage, postJson } from "./ui";
export function ManageAssignment({
  assignment: a,
  token,
  isNew,
  emailEnabled,
}: {
  assignment: ManagedAssignment;
  token: string;
  isNew: boolean;
  emailEnabled: boolean;
}) {
  const router = useRouter(),
    [cancelOpen, setCancelOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const cancelled = a.status === "cancelled";
  return (
    <div className="manage-wrap">
      <div className="manage-heading">
        <span className="success-icon">
          {cancelled ? <Heart size={27} /> : <Check size={28} />}
        </span>
        <p className="eyebrow">THANK YOU FOR YOUR HELP</p>
        <h1>
          {cancelled
            ? "担当をキャンセルしました"
            : a.status === "completed"
              ? "サポートが完了しました"
              : isNew
                ? "担当が決まりました！"
                : "あなたのサポート予定"}
        </h1>
        <p>
          {cancelled
            ? "予定は再び募集中になりました。"
            : `${a.supporterName}さん、ありがとうございます。`}
        </p>
      </div>
      <div className="manage-card">
        <p className="small muted">{a.page.recipientDisplayName}へのサポート</p>
        <div className="assignment-summary">
          <span className="category-icon">
            {categories.find((c) => c.id === a.slot.categoryId)?.icon}
          </span>
          <h2>{a.slot.title}</h2>
        </div>
        <p className="period">
          <CalendarDays size={17} />
          {dateLabel(a.slot.date, true)}
        </p>
        {a.slot.startTime && (
          <p className="period">
            <Clock3 size={17} />
            {a.slot.startTime}
            {a.slot.endTime && ` – ${a.slot.endTime}`}
          </p>
        )}
        {a.instructions && (
          <div className="private-details">
            <h3>
              <LockKeyhole size={17} />
              担当する方へのご案内
            </h3>
            <p className="preserve-lines">
              {a.instructions.privateInstructions ||
                "詳しい受け渡し方法は、ページを共有した方にご確認ください。"}
            </p>
            {a.slot.categoryId === "meal" && (
              <dl>
                {a.instructions.mealPeople && (
                  <>
                    <dt>食事の人数</dt>
                    <dd>{a.instructions.mealPeople}人</dd>
                  </>
                )}
                {a.instructions.foodDislikes && (
                  <>
                    <dt>苦手な食べ物</dt>
                    <dd>{a.instructions.foodDislikes}</dd>
                  </>
                )}
                {a.instructions.allergyNotes && (
                  <>
                    <dt>アレルギー等の注意</dt>
                    <dd>{a.instructions.allergyNotes}</dd>
                  </>
                )}
                {a.instructions.handoffPreference && (
                  <>
                    <dt>受け渡しの希望</dt>
                    <dd>{a.instructions.handoffPreference}</dd>
                  </>
                )}
              </dl>
            )}
            <p className="field-hint">
              この情報と管理リンクは、ご本人だけで保管してください。
            </p>
          </div>
        )}
        {!cancelled && (
          <div className="gentle-note">
            <strong>このページをブックマークしてください。</strong>
            <p>
              この管理リンクから、予定の確認とキャンセルができます。
              {emailEnabled
                ? "メールを入力した場合は確認メールでもお知らせします。"
                : "通知メールは準備中です。管理リンクから予定をご確認ください。"}
            </p>
          </div>
        )}
        <Link className="button secondary full" href={`/s/${a.page.slug}`}>
          サポートページに戻る
          <ArrowRight size={16} />
        </Link>
        {a.status === "active" && (
          <button className="cancel-link" onClick={() => setCancelOpen(true)}>
            担当をキャンセルする
          </button>
        )}
      </div>
      {cancelOpen && (
        <Modal
          title="担当をキャンセルしますか？"
          onClose={() => setCancelOpen(false)}
        >
          <p>
            「{a.slot.title}
            」の担当をキャンセルすると、この予定が再び募集中になります。主催者の管理画面にも反映します。
          </p>
          <ErrorMessage message={error} />
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setCancelOpen(false)}
            >
              戻る
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await postJson("/api/assignments/cancel", { token });
                  setCancelOpen(false);
                  router.replace(`/manage-assignment/${token}`);
                  router.refresh();
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "キャンセルできませんでした",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "処理しています…" : "担当をキャンセル"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
