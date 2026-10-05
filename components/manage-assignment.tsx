"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Check,
  CalendarDays,
  CalendarPlus,
  Clock3,
  Copy,
  Link2,
  LockKeyhole,
  Heart,
  ArrowRight,
  MessageCircle,
} from "lucide-react";
import { categories } from "@/config/product";
import { buildIcs } from "@/lib/calendar";
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
      {a.status === "active" && (
        <SaveManageLink
          assignment={a}
          token={token}
          isNew={isNew}
          emailEnabled={emailEnabled}
        />
      )}
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
              この案内は、ほかの人に共有しないでください。
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
function SaveManageLink({
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
  const [message, setMessage] = useState("");
  const manageUrl = () =>
    `${window.location.origin}/manage-assignment/${token}`;
  const eventTitle = `${a.slot.title}（${a.page.recipientDisplayName}へのサポート）`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(manageUrl());
      setMessage("リンクをコピーしました");
    } catch {
      setMessage(
        "コピーできませんでした。この画面をブックマークしてください。",
      );
    }
  }
  function sendToLine() {
    const text = `【となりの手】あなた専用の担当管理リンクです。他の人には送らないでください。\n${eventTitle} ${dateLabel(a.slot.date)}\n${manageUrl()}`;
    window.open(
      `https://line.me/R/msg/text/?${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }
  function addToCalendar() {
    const url = manageUrl();
    const ics = buildIcs({
      uid: `${a.slot.id}@tonarino-te`,
      title: eventTitle,
      date: a.slot.date,
      startTime: a.slot.startTime,
      endTime: a.slot.endTime,
      description: `担当者用の管理リンク（予定の確認・キャンセル）\n${url}\n共有カレンダーに入れると、ほかの人もこのリンクを開けます。`,
      url,
    });
    const href = URL.createObjectURL(
      new Blob([ics], { type: "text/calendar;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = href;
    link.download = "tonarino-te.ics";
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    setMessage("カレンダー用のファイルを作成しました");
  }
  return (
    <section className="save-link" aria-labelledby="save-link-title">
      <div className="save-link-heading">
        <Link2 size={20} aria-hidden="true" />
        <div>
          <h2 id="save-link-title">
            {isNew
              ? "この画面のリンクを、いま保存してください"
              : "この画面のリンクを保存しておきましょう"}
          </h2>
          <p>
            予定の確認とキャンセルは、このリンクからだけできます。
            {emailEnabled
              ? "メールを入力した場合は確認メールでもお知らせします。"
              : "確認メールはまだ届きません。"}
          </p>
        </div>
      </div>
      <button className="button line-button full" onClick={sendToLine}>
        <MessageCircle size={18} />
        LINEで自分に送る
      </button>
      <p className="save-link-hint">
        LINEの「Keepメモ」に送ると、自分だけが見られます。
      </p>
      <div className="save-link-actions">
        <button className="button secondary" onClick={copy}>
          {message === "リンクをコピーしました" ? (
            <Check size={16} />
          ) : (
            <Copy size={16} />
          )}
          リンクをコピー
        </button>
        <button className="button secondary" onClick={addToCalendar}>
          <CalendarPlus size={16} />
          カレンダーに追加
        </button>
      </div>
      <p className="status-message" role="status">
        {message}
      </p>
    </section>
  );
}
