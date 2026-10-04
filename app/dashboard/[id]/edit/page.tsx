import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { AppError } from "@/lib/errors";
import { supportService } from "@/services/factory";
import { Header, Footer } from "@/components/shell";
import { Wizard } from "@/components/wizard";
import { isPageClosed } from "@/lib/domain";
export const metadata = {
  title: "サポートページを編集",
  robots: { index: false, follow: false },
};
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
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
  if (isPageClosed(page)) redirect(`/dashboard/${id}`);
  return (
    <>
      <Header minimal />
      <main id="main" className="container form-page">
        <Wizard existing={page} />
      </main>
      <Footer />
    </>
  );
}
