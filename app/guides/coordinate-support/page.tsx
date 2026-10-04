import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Header, Footer } from "@/components/shell";

export const metadata: Metadata = {
  title: "身近な人への生活支援を予定にする7つの手順",
  description:
    "出産後や療養中など、家族や友人に手助けを頼むときの準備方法。食事や買い物などの用事を小さな予定に分け、無理なく共有するコツを解説します。",
  alternates: { canonical: "/guides/coordinate-support" },
  openGraph: {
    type: "article",
    title: "身近な人への生活支援を予定にする7つの手順",
    description:
      "頼む側も手伝う側も迷わない、短期の生活支援の整え方を紹介します。",
    url: "/guides/coordinate-support",
  },
  twitter: {
    card: "summary",
    title: "身近な人への生活支援を予定にする7つの手順 | となりの手",
    description:
      "頼む側も手伝う側も迷わない、短期の生活支援の整え方を紹介します。",
  },
};

const steps = [
  {
    title: "まず、本人が望む支援と共有範囲を確認する",
    body: "本人の了承を得て、どんな用事を誰に頼みたいかを一緒に整理します。本人が自分で決められない状況では、必要な範囲を家族で確認し、共有する情報を最小限にします。",
  },
  {
    title: "助けが必要な期間を決める",
    body: "「しばらく」ではなく、まずは一週間など見通せる期間に区切ります。状況が変わったら、期間を延ばすかをあらためて相談します。",
  },
  {
    title: "毎日の負担を、具体的な用事に分ける",
    body: "食事を届ける、買い物をする、送迎をする、ゴミを出すなど、ひとつずつ分けます。「何かできることある？」より、用事の例があると、手伝う側が自分にできることを選びやすくなります。",
  },
  {
    title: "日時と所要時間をはっきりさせる",
    body: "一つの予定に一つの用事を入れ、日付、時間帯、所要時間の目安を伝えます。長い用事は短く分け、対応できる人が限られる予定は個別に相談します。",
  },
  {
    title: "できる人が選べる形にする",
    body: "すべての予定を埋めようとせず、手伝える人が自分の都合に合うものを選べるようにします。担当が決まった予定と募集中の予定を分けると、重複や行き違いを減らせます。",
  },
  {
    title: "公開する説明と、担当者だけに伝える案内を分ける",
    body: "共有リンクで見せる説明には、用事の概要と時間など必要な情報だけを書きます。詳しい住所、受け渡し方法、食事の注意などは、担当が決まった人にだけ伝えます。",
  },
  {
    title: "変更やキャンセルの連絡方法も決める",
    body: "都合が変わったときに誰へ知らせるかを事前に共有します。予定が空いた場合に、別の人が引き受けられる形にしておくと、主催者が一人で調整を抱えずに済みます。",
  },
];

export default function CoordinateSupportGuide() {
  return (
    <>
      <Header />
      <main id="main" className="guide-article-wrap">
        <article className="guide-article">
          <nav className="guide-breadcrumb" aria-label="パンくずリスト">
            <Link href="/">トップ</Link>
            <span aria-hidden="true">/</span>
            <Link href="/guides">支援ガイド</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">予定の作り方</span>
          </nav>

          <header className="guide-article-header">
            <p className="eyebrow">支援を頼む前の準備</p>
            <h1>身近な人への生活支援を、無理のない予定にする7つの手順</h1>
            <p className="guide-article-lead">
              出産後や療養中など、暮らしに手助けが必要なとき。家族や友人ができることを少しずつ持ち寄れるよう、頼みたい内容を具体的な予定に分ける方法を紹介します。
            </p>
          </header>

          <nav className="guide-toc" aria-label="この記事の目次">
            <strong>この記事の内容</strong>
            <ol>
              {steps.map((step, index) => (
                <li key={step.title}>
                  <a href={`#step-${index + 1}`}>{step.title}</a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="guide-steps">
            {steps.map((step, index) => (
              <section
                className="guide-step"
                id={`step-${index + 1}`}
                key={step.title}
              >
                <span className="guide-step-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2>{step.title}</h2>
                  <p>{step.body}</p>
                </div>
              </section>
            ))}
          </div>

          <aside className="guide-safety-note">
            <ShieldCheck size={23} />
            <div>
              <h2>個人情報は必要な人にだけ共有しましょう</h2>
              <p>
                共有リンクは受け取った人が転送できます。住所、連絡先、健康上の注意などは公開する案内文に書かず、担当が決まった人へ個別に伝えてください。ページのパスコードも設定できます。
              </p>
            </div>
          </aside>

          <section className="guide-product-note">
            <h2>予定の共有には「となりの手」を使えます</h2>
            <p>
              食事、買い物、送迎、家事などを予定にして、家族や友人へ共有できます。支援する人はアカウント登録なしで、できる予定を選べます。現在の初期テンプレートは産後の暮らし向けです。
            </p>
            <div className="row wrap">
              <Link href="/create" className="button primary">
                サポートページを作る <ArrowRight size={18} />
              </Link>
              <Link href="/demo" className="button secondary">
                ページの見本を見る
              </Link>
            </div>
          </section>

          <nav className="guide-bottom-nav" aria-label="関連ページ">
            <Link href="/guides" className="text-link">
              <ArrowLeft size={16} /> ガイド一覧へ
            </Link>
            <Link href="/privacy" className="text-link">
              <Check size={16} /> 個人情報の扱いを見る
            </Link>
          </nav>
        </article>
      </main>
      <Footer />
    </>
  );
}
