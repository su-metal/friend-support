"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import type { OrganizerPage } from "@/types/domain";
import { ErrorMessage, Modal, postJson } from "./ui";
import { ConsiderationsForm } from "./recipient";

// 窓口役（主催者）がご本人用リンクを発行・無効化し、お休みと配慮の文を設定する。
export function RecipientPanel({ page }: { page: OrganizerPage }) {
  const router = useRouter(),
    [url, setUrl] = useState(""),
    [confirm, setConfirm] = useState<"reissue" | "revoke" | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const published = page.status === "published",
    paused = !!page.pausedAt;
  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const result = await postJson<{ url?: string }>(
        `/api/pages/${page.id}`,
        body,
        "PATCH",
      );
      router.refresh();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "変更できませんでした");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function issue() {
    const result = await run({ action: "recipient_link_issue" });
    if (result && result.url) {
      setUrl(result.url);
      setMessage("");
    }
    setConfirm(null);
  }
  const lineText = `困ったことがあったら、ここからお願いを出してね（あなた専用のリンクです）\n${url}`;
  return (
    <section className="recipient-panel">
      <div className="row between">
        <h2>ご本人用リンク</h2>
        <span className={`tag ${page.recipientLinkActive ? "" : "tag-open"}`}>
          {page.recipientLinkActive ? "有効" : "未発行"}
        </span>
      </div>
      <p className="muted small">
        ご本人（{page.recipientDisplayName}
        ）が、困りごとを直接お願いとして出せるリンクです。ご本人にだけ送ってください。
      </p>
      <ErrorMessage message={error} />
      {url ? (
        <div className="share-box">
          <div className="row wrap">
            <a
              className="button line-button"
              href={`https://line.me/R/msg/text/?${encodeURIComponent(lineText)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={17} />
              LINEで送る
            </a>
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setMessage("リンクをコピーしました");
                } catch {
                  setMessage(
                    "コピーできませんでした。下のリンクを選択してコピーしてください。",
                  );
                }
              }}
            >
              <Copy size={17} />
              リンクをコピー
            </button>
          </div>
          <input
            className="share-url"
            aria-label="ご本人用リンク"
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
          />
          <p className="field-hint">
            このリンクは今だけ表示されます。あとで送り直すときは、作り直してください。
          </p>
          <p className="status-message" role="status">
            {message}
          </p>
        </div>
      ) : (
        <div className="row wrap recipient-panel-actions">
          {page.recipientLinkActive ? (
            <>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setConfirm("reissue")}
              >
                作り直して送る
              </button>
              <button
                className="text-button danger-text"
                disabled={busy}
                onClick={() => setConfirm("revoke")}
              >
                無効にする
              </button>
            </>
          ) : (
            <button
              className="button secondary"
              disabled={busy}
              onClick={issue}
            >
              ご本人用リンクを作る
            </button>
          )}
        </div>
      )}
      {published && (
        <>
          <div className="recipient-pause">
            <div>
              <strong>受付のお休み</strong>
              <p className="muted small">
                {paused
                  ? "お休み中です。新しい担当を受け付けていません。"
                  : "いまは受付中です。"}
              </p>
            </div>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                run({
                  action: "recipient_settings",
                  settings: { paused: !paused },
                })
              }
            >
              {paused ? "受付を再開する" : "お休みにする"}
            </button>
          </div>
          <ConsiderationsForm
            initial={page.considerations ?? []}
            busy={busy}
            onSave={(considerations) =>
              run({
                action: "recipient_settings",
                settings: { considerations },
              })
            }
          />
        </>
      )}
      {confirm && (
        <Modal
          title={
            confirm === "reissue"
              ? "リンクを作り直しますか？"
              : "リンクを無効にしますか？"
          }
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm === "reissue"
              ? "今のリンクはすぐに使えなくなります。新しいリンクをご本人に送ってください。"
              : "ご本人はこのリンクからお願いを出せなくなります。出したお願いは残ります。"}
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setConfirm(null)}
            >
              戻る
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (confirm === "reissue") await issue();
                else {
                  await run({ action: "recipient_link_revoke" });
                  setConfirm(null);
                }
              }}
            >
              {confirm === "reissue" ? "作り直す" : "無効にする"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
