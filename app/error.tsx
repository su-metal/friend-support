"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="container not-found">
      <h1>ページを読み込めませんでした。</h1>
      <p>時間をおいて、もう一度お試しください。</p>
      <button className="button primary" onClick={reset}>
        再読み込み
      </button>
    </main>
  );
}
