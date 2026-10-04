import type { Metadata } from "next";
import { appUrl } from "@/lib/env";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: "となりの手 | 小さな手助けを、みんなで。",
    template: "%s | となりの手",
  },
  description:
    "出産後や療養中など、暮らしに手助けが必要なとき。食事、買い物、送迎の予定を身近な人と共有し、できる人が担当できるサービスです。",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "となりの手",
    title: "となりの手 | 小さな手助けを、みんなで。",
    description:
      "大切な人へのサポートを、家族や友人みんなで少しずつ。誰が・いつ手伝うかを予定にして共有できます。",
  },
  twitter: {
    card: "summary",
    title: "となりの手 | 小さな手助けを、みんなで。",
    description:
      "食事、買い物、送迎など、身近な人との一時的な生活支援を予定にして共有。",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
