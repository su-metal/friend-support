"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ArrowRight } from "lucide-react";
import { postJson, ErrorMessage } from "./ui";
export function PasscodeForm({ slug }: { slug: string }) {
  const router = useRouter(),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="auth-card">
      <div className="auth-icon">
        <LockKeyhole size={25} />
      </div>
      <h1>パスコードを入力</h1>
      <p className="muted">
        ページを共有した方に、パスコードをご確認ください。
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await postJson(`/api/support/${slug}`, { passcode: code });
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "確認できませんでした");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="page-passcode">パスコード</label>
        <input
          id="page-passcode"
          type="password"
          inputMode="numeric"
          minLength={4}
          maxLength={8}
          pattern="[0-9]{4,8}"
          required
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <ErrorMessage message={error} />
        <button className="button primary full" disabled={busy}>
          {busy ? "確認しています…" : "ページを開く"}
          <ArrowRight size={17} />
        </button>
      </form>
    </div>
  );
}
