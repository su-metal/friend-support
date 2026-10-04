import { notFound } from "next/navigation";
import { supportService } from "@/services/factory";
import { pageAccessVersion } from "@/lib/api";
import { Header, Footer } from "@/components/shell";
import { SupportPageView } from "@/components/support-page";
import { PasscodeForm } from "@/components/passcode";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "サポートの予定",
  robots: { index: false, follow: false },
};
export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(slug)) notFound();
  const page = await (
    await supportService()
  ).publicPage(slug, await pageAccessVersion(slug));
  if (!page) notFound();
  return (
    <>
      <Header minimal />
      <main id="main">
        {page === "locked" ? (
          <div className="auth-page">
            <PasscodeForm slug={slug} />
          </div>
        ) : (
          <SupportPageView
            page={page}
            emailEnabled={
              !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
            }
          />
        )}
      </main>
      <Footer />
    </>
  );
}
