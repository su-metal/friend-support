import Link from "next/link";
import { Header, Footer } from "@/components/shell";
export default function NotFound() {
  return (
    <>
      <Header minimal />
      <main id="main" className="container not-found">
        <p className="eyebrow" style={{ justifyContent: "center" }}>
          PAGE NOT FOUND
        </p>
        <h1>ページを開けませんでした。</h1>
        <p>
          リンクが正しいか、ページが公開されているか、
          <br />
          共有した方にご確認ください。
        </p>
        <Link href="/" className="button primary">
          トップに戻る
        </Link>
      </main>
      <Footer />
    </>
  );
}
