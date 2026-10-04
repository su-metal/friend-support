"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, CheckCircle2 } from "lucide-react";
import { postJson, ErrorMessage } from "./ui";
import {
  completeEmailLogin,
  type FirebaseClientConfig,
} from "@/lib/auth/client";
export function LoginForm({
  demo,
  complete = false,
  config,
}: {
  demo: boolean;
  complete?: boolean;
  config?: FirebaseClientConfig;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (complete && config) {
        const idToken = await completeEmailLogin(config, email);
        await postJson("/api/auth/session", { idToken });
        router.replace("/create");
        router.refresh();
      } else {
        await postJson("/api/auth/send-link", { email });
        setSent(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "処理できませんでした");
    } finally {
      setBusy(false);
    }
  }
  async function demoLogin() {
    setBusy(true);
    try {
      await postJson("/api/auth/session", { idToken: "demo" });
      router.replace("/create");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "処理できませんでした");
      setBusy(false);
    }
  }
  if (sent)
    return (
      <div className="sent-state">
        <CheckCircle2 size={42} />
        <h2>ログインリンクを送りました</h2>
        <p>
          {email} に届いたメールのリンクを開いてください。
          <br />
          届かない場合は迷惑メールフォルダもご確認ください。
        </p>
        <button className="button secondary" onClick={() => setSent(false)}>
          別のメールアドレスを使う
        </button>
      </div>
    );
  return (
    <>
      <div className="auth-icon">
        <Mail size={25} />
      </div>
      <h1>
        {complete ? "ログインを完了する" : "大切な人へのサポートを、ここから。"}
      </h1>
      <p className="muted">
        {complete
          ? "ログインリンクを送ったメールアドレスを入力してください。"
          : "ページを作る方は、メールアドレスでログインしてください。"}
      </p>
      {demo ? (
        <div className="demo-login">
          <p>
            ローカルデモでは、メール認証を体験用アカウントに置き換えています。
          </p>
          <button
            className="button primary full"
            onClick={demoLogin}
            disabled={busy}
          >
            {busy ? "準備しています…" : "デモでページ作成を試す"}
            <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="email">メールアドレス</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="field-hint">パスワードの設定は不要です。</p>
          <ErrorMessage message={error} />
          <button className="button primary full" disabled={busy}>
            {busy
              ? "処理しています…"
              : complete
                ? "ログインする"
                : "ログインリンクを送る"}
            <ArrowRight size={18} />
          </button>
        </form>
      )}
      <ErrorMessage message={demo ? error : ""} />
      <p className="auth-footnote">
        <Link href="/terms">利用について</Link>・
        <Link href="/privacy">プライバシー</Link>をご確認ください。
      </p>
      <Link href="/demo" className="text-link">
        まずはページの見本を見る
        <ArrowRight size={16} />
      </Link>
    </>
  );
}
