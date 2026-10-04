"use client";
import { useState } from "react";
import { Share2, Copy, Check, MessageCircle } from "lucide-react";
import { track } from "./analytics";
export function ShareButtons({
  url,
  title,
  pageId,
}: {
  url: string;
  title: string;
  pageId: string;
}) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("リンクをコピーしました");
      track("share_clicked", { pageId, method: "copy" });
    } catch {
      setMessage(
        "コピーできませんでした。下のリンクを選択してコピーしてください。",
      );
    }
  }
  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title,
          text: "できることを、できる日に。サポート予定を見てみてください。",
          url,
        });
        track("share_clicked", { pageId, method: "native" });
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError"))
          setMessage("共有できませんでした。リンクをコピーしてください。");
      }
    } else await copy();
  }
  return (
    <div className="share-box">
      <div className="row wrap">
        <button
          className="button line-button"
          onClick={async () => {
            if (typeof navigator.share === "function") await share();
            else {
              track("share_clicked", { pageId, method: "line" });
              window.open(
                `https://line.me/R/msg/text/?${encodeURIComponent(`${title}\n${url}`)}`,
                "_blank",
                "noopener,noreferrer",
              );
            }
          }}
        >
          <MessageCircle size={17} />
          LINEで共有
        </button>
        <button className="button secondary" onClick={copy}>
          {message === "リンクをコピーしました" ? (
            <Check size={17} />
          ) : (
            <Copy size={17} />
          )}
          リンクをコピー
        </button>
        <button className="button subtle" onClick={share}>
          <Share2 size={17} />
          その他の方法で共有
        </button>
      </div>
      <input
        className="share-url"
        aria-label="共有リンク"
        readOnly
        value={url}
        onFocus={(e) => e.target.select()}
      />
      <p className="status-message" role="status">
        {message}
      </p>
    </div>
  );
}
