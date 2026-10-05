import Link from "next/link";
import {
  ArrowRight,
  Check,
  ShieldCheck,
  Link2,
  Heart,
  CalendarDays,
  UserRoundCheck,
} from "lucide-react";
import { Header, Footer } from "@/components/shell";
import { TrackView } from "@/components/analytics";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "身近な人の生活支援を予定にする",
  description:
    "出産後や療養中など、暮らしに手助けが必要なとき。食事、買い物、送迎の予定を家族や友人と共有し、できる人が担当できます。",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "身近な人の生活支援を予定にする | となりの手",
    description:
      "出産後や療養中など、暮らしに手助けが必要なとき。家族や友人と支援予定を共有し、できる人が担当できます。",
    url: "/",
  },
};
const examples = [
  {
    date: "10 / 8",
    day: "木",
    icon: "🍱",
    title: "夕食を届ける",
    time: "18:00 – 19:00",
    name: "できる人を募集中",
    open: true,
  },
  {
    date: "10 / 9",
    day: "金",
    icon: "🛒",
    title: "食料品を買う",
    time: "16:00 – 17:00",
    name: "佐藤さんが担当",
    open: false,
  },
  {
    date: "10 / 10",
    day: "土",
    icon: "🐕",
    title: "犬の散歩",
    time: "16:00 – 17:00",
    name: "できる人を募集中",
    open: true,
  },
];
export default function Home() {
  return (
    <>
      <Header />
      <TrackView name="landing_viewed" />
      <main id="main">
        <section className="hero container">
          <div className="hero-copy">
            <p className="eyebrow">
              <span />
              大切な人の、新しい毎日を。
            </p>
            <h1>
              「何かあったら
              <br />
              言ってね」を、
              <br />
              <span>本当に手伝える形に。</span>
            </h1>
            <p className="hero-description">
              出産後や療養中、家族のケアなど、
              <br className="mobile-only" />
              暮らしに手助けが必要なときに。
              <br />
              食事や買い物、送迎の予定を、
              <br className="mobile-only" />
              家族や友人で無理なく分担できます。
              <br />
              誰が・いつ手伝うかが、ひと目でわかります。
            </p>
            <Link href="/create" className="button primary hero-cta">
              サポートページを作る
              <ArrowRight size={19} />
            </Link>
            <p className="cta-note">
              <Check size={14} />
              無料で作成 · 支援する人は登録不要
            </p>
          </div>
          <div className="hero-visual">
            <div className="visual-dot dot-one" />
            <div className="visual-dot dot-two" />
            <div className="hero-paper" aria-hidden="true">
              <div className="paper-top">
                <span className="mini-brand">
                  <HandMark />
                  となりの手
                </span>
                <span className="paper-label">サポートページの見本</span>
              </div>
              <div className="paper-family">
                <span className="family-monogram">
                  T<span>♡</span>
                </span>
                <div>
                  <small>ようこそ、小さな家族。</small>
                  <h2>
                    田中さん家族を
                    <br />
                    みんなでサポート
                  </h2>
                </div>
              </div>
              <p className="paper-period">
                <CalendarDays size={14} />
                10月8日 – 11月7日
              </p>
              <div className="paper-line">
                <span>できることを、できる日に。</span>
                <Heart size={15} />
              </div>
              <div className="paper-slots">
                {examples.map((e) => (
                  <div className="paper-slot" key={e.date}>
                    <div className="paper-date">
                      {e.date}
                      <small>{e.day}曜日</small>
                    </div>
                    <div className="paper-slot-content">
                      <strong>
                        <span>{e.icon}</span>
                        {e.title}
                      </strong>
                      <small>{e.time}</small>
                      <span
                        className={
                          e.open ? "paper-status open" : "paper-status"
                        }
                      >
                        {!e.open && <Check size={12} />} {e.name}
                      </span>
                    </div>
                    {e.open && (
                      <span className="paper-arrow">
                        <ArrowRight size={16} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="paper-footer">
                <ShieldCheck size={14} />
                リンクを知っている人だけに共有
              </div>
            </div>
            <div className="hero-note">
              <span className="note-heart">
                <Heart size={18} />
              </span>
              <div>
                あなたの「できる」が、
                <br />
                <strong>誰かの「助かった」に。</strong>
              </div>
            </div>
            <span className="visual-caption">
              ひとつの予定から、気持ちがつながる。
            </span>
          </div>
        </section>
        <section className="category-strip">
          <div className="container">
            <p>
              いつものことが、
              <br />
              大きな手助けになります。
            </p>
            <div>
              {[
                "🍱 食事",
                "🛒 買い物",
                "🚗 送迎",
                "🧹 家事",
                "🐕 ペット",
                "📦 その他",
              ].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
        </section>
        <section className="section container how-section" id="how-it-works">
          <div className="section-heading">
            <p className="eyebrow">HOW IT WORKS</p>
            <h2>
              手助けがつながる、
              <br className="mobile-only" />
              3つのステップ。
            </h2>
            <p>
              「お願いする」の負担を、
              <br className="mobile-only" />
              「選んでもらう」しくみに。
            </p>
          </div>
          <div className="steps">
            <article>
              <span className="step-number">01</span>
              <div className="step-art">
                <CalendarDays size={34} strokeWidth={1.4} />
                <span className="art-check">
                  <Check size={15} />
                </span>
              </div>
              <h3>必要なサポートを登録</h3>
              <p>
                誰に、いつ、どんな手助けが必要か。
                <br />
                テンプレートから、かんたんに。
              </p>
            </article>
            <article>
              <span className="step-number">02</span>
              <div className="step-art">
                <Link2 size={36} strokeWidth={1.4} />
                <span className="art-bubble">♡</span>
              </div>
              <h3>LINEでみんなに共有</h3>
              <p>
                できたページのリンクを、
                <br />
                家族や友人など、身近な人へ。
              </p>
            </article>
            <article>
              <span className="step-number">03</span>
              <div className="step-art">
                <UserRoundCheck size={36} strokeWidth={1.4} />
                <span className="art-check">
                  <Check size={15} />
                </span>
              </div>
              <h3>できる人が担当する</h3>
              <p>
                空いている予定から、できるものを。
                <br />
                名前を入れるだけで担当できます。
              </p>
            </article>
          </div>
        </section>
        <section className="story-section">
          <div className="container story-inner">
            <div>
              <p className="eyebrow">SMALL HELP, BIG COMFORT</p>
              <h2>
                頼む人にも、
                <br />
                手伝う人にも、
                <br />
                <span>ちょうどいい距離感を。</span>
              </h2>
            </div>
            <div className="story-text">
              <p>
                うれしい変化のそばには、
                <br />
                手が足りない毎日もあるから。
              </p>
              <p>
                ごはんを一食。買い物を一回。
                <br />
                特別なことをしなくても、いつものあなたに
                <br className="desktop-only" />
                できることが、大切な人の力になります。
              </p>
              <p>
                予定を見て、自分ができることを選ぶ。
                <br />
                お互いに無理をしないサポートを、ここから。
              </p>
              <Link href="/demo" className="text-link">
                サポートページの見本を見る
                <ArrowRight size={17} />
              </Link>
              <Link href="/guides" className="text-link">
                支援の予定を作るガイド
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </section>
        <section className="section container assurance">
          <div>
            <ShieldCheck size={27} />
            <h3>身近な人とのサポートに。</h3>
            <p>
              共有リンクでつながる、家族や友人のためのページ。
              <br />
              住所などの詳しい情報は、担当する人だけに伝えられます。
            </p>
          </div>
          <div className="assurance-list">
            <p>
              <Check size={17} />
              支援する人はアカウント登録不要
            </p>
            <p>
              <Check size={17} />
              ページにはパスコードも設定できます
            </p>
            <p>
              <Check size={17} />
              予定が変わったら、管理リンクからキャンセル
            </p>
          </div>
        </section>
        <section className="closing-cta">
          <div className="container">
            <span className="closing-icon">
              <HandMark />
            </span>
            <h2>
              大切な人の毎日に、
              <br className="mobile-only" />
              あなたの手を。
            </h2>
            <p>まずは、ひとつのサポートページから。</p>
            <Link href="/create" className="button primary">
              無料でサポートページを作る
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
function HandMark() {
  return <Heart size={18} strokeWidth={1.8} />;
}
