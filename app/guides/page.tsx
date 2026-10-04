import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  HeartHandshake,
  ShieldCheck,
} from "lucide-react";
import { Header, Footer } from "@/components/shell";

export const metadata: Metadata = {
  title: "家族や友人と支援を分担するガイド",
  description:
    "食事や買い物など、身近な人への一時的な生活支援を頼むときの準備、予定の分け方、安全な共有方法を紹介します。",
  alternates: { canonical: "/guides" },
  openGraph: {
    type: "website",
    title: "家族や友人と支援を分担するガイド | となりの手",
    description:
      "一時的な生活支援を頼むときの準備、予定の分け方、安全な共有方法を紹介します。",
    url: "/guides",
  },
  twitter: {
    card: "summary",
    title: "家族や友人と支援を分担するガイド | となりの手",
    description:
      "一時的な生活支援を頼むときの準備、予定の分け方、安全な共有方法を紹介します。",
  },
};

export default function GuidesIndex() {
  return (
    <>
      <Header />
      <main id="main" className="guide-index">
        <section className="guide-index-hero">
          <div className="container">
            <p className="eyebrow">となりの手 · 支援ガイド</p>
            <h1>「手伝えるよ」を、予定につなげる。</h1>
            <p>
              出産後や療養中など、暮らしに手助けが必要なとき。
              <br className="desktop-only" />
              家族や友人と無理なく支援を分け合うためのヒントをまとめました。
            </p>
            <Link href="/create" className="button primary">
              サポートページを作る <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section className="container guide-index-content">
          <div className="section-heading">
            <p className="eyebrow">GUIDES</p>
            <h2>必要なところから読めます。</h2>
            <p>頼む前の整理から、予定の共有まで。</p>
          </div>
          <article className="guide-card">
            <div className="guide-card-icon">
              <CalendarDays size={24} />
            </div>
            <div className="guide-card-copy">
              <p className="guide-label">はじめての方向け</p>
              <h2>
                <Link href="/guides/coordinate-support">
                  身近な人への手助けを、無理のない予定にする7つの手順
                </Link>
              </h2>
              <p>
                頼む側も手伝う側も迷わないように、必要なことを小さな予定に分けて共有する方法を紹介します。
              </p>
              <Link href="/guides/coordinate-support" className="text-link">
                ガイドを読む <ArrowRight size={17} />
              </Link>
            </div>
          </article>

          <div className="guide-index-note">
            <HeartHandshake size={23} />
            <div>
              <h2>「となりの手」でできること</h2>
              <p>
                食事、買い物、送迎、家事などの予定を作り、共有リンクから身近な人に参加してもらえます。現在の初期テンプレートは産後の暮らし向けです。
              </p>
            </div>
          </div>

          <div className="guide-index-privacy">
            <ShieldCheck size={20} />
            <p>
              住所や詳しい受け渡し方法などは、公開する案内文ではなく、担当する人への非公開情報として扱ってください。
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
