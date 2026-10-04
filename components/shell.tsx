import Link from "next/link";
import { HandHeart, ArrowUpRight } from "lucide-react";
import { isDemoMode } from "@/lib/env";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="となりの手 ホーム">
      <span className="brand-icon">
        <HandHeart size={23} strokeWidth={1.6} />
      </span>
      <span>
        となりの手<span className="brand-sub">小さな手助けを、みんなで。</span>
      </span>
    </Link>
  );
}
export function Header({ minimal = false }: { minimal?: boolean }) {
  return (
    <>
      <a className="skip-link" href="#main">
        本文へ移動
      </a>
      {isDemoMode() && (
        <div className="demo-banner">
          ローカルデモ · 入力したデータは再起動でリセットされます ·
          メールは送信されません
        </div>
      )}
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav aria-label="メインナビゲーション">
            {!minimal && (
              <>
                <Link href="/#how-it-works" className="desktop-only">
                  使い方
                </Link>
                <Link href="/demo" className="desktop-only">
                  ページの見本
                </Link>
                <Link href="/guides" className="desktop-only">
                  支援ガイド
                </Link>
              </>
            )}
            <Link href="/dashboard" className="nav-login">
              マイページ
              <ArrowUpRight size={15} />
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <Brand />
        <p>できることを、できるときに。</p>
        <div className="row">
          <Link href="/guides">支援ガイド</Link>
          <Link href="/privacy">プライバシー</Link>
          <Link href="/terms">利用について</Link>
        </div>
      </div>
      <div className="container copyright">© 2026 となりの手</div>
    </footer>
  );
}
