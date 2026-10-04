import { Header, Footer } from "@/components/shell";
import { SupportPageView } from "@/components/support-page";
import { makeDemoStore } from "@/services/demo";
import { SupportService } from "@/services/support";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "サポートページの見本",
  robots: { index: false, follow: false },
};
export default async function Demo() {
  const page = await new SupportService(await makeDemoStore()).publicPage(
    "demo",
  );
  if (!page || page === "locked") throw new Error("Sample unavailable");
  return (
    <>
      <Header minimal />
      <main id="main">
        <SupportPageView page={page} sample />
      </main>
      <Footer />
    </>
  );
}
