import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { AppError } from "@/lib/errors";
import { supportService } from "@/services/factory";
import { appUrl } from "@/lib/env";
import { Header, Footer } from "@/components/shell";
import { DashboardDetail } from "@/components/dashboard";
import { getFeatureFlags } from "@/config/product";
export const metadata = {
  title: "サポートの管理",
  robots: { index: false, follow: false },
};
export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ published?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const page = await (
    await supportService()
  )
    .organizerPage(user, id)
    .catch((e) => {
      if (e instanceof AppError && e.status === 404) notFound();
      throw e;
    });
  return (
    <>
      <Header minimal />
      <main id="main" className="container dashboard-container">
        <DashboardDetail
          page={page}
          publicUrl={`${appUrl()}/s/${page.slug}`}
          justPublished={(await searchParams).published === "1"}
          recipientEnabled={getFeatureFlags().recipientAccess}
        />
      </main>
      <Footer />
    </>
  );
}
