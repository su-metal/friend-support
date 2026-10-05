import { notFound } from "next/navigation";
import { Header, Footer } from "@/components/shell";
import { RecipientHome } from "@/components/recipient";
import { getFeatureFlags } from "@/config/product";
import { recipientService } from "@/services/factory";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "ご本人用ページ",
  robots: { index: false, follow: false },
};
export default async function RecipientPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (!getFeatureFlags().recipientAccess) notFound();
  const { token } = await params;
  const view = await (await recipientService()).view(token);
  if (!view) notFound();
  return (
    <>
      <Header minimal />
      <main id="main" className="container">
        <RecipientHome view={view} token={token} />
      </main>
      <Footer />
    </>
  );
}
