import { notFound } from "next/navigation";
import { Header, Footer } from "@/components/shell";
import { supportService } from "@/services/factory";
import { ManageAssignment } from "@/components/manage-assignment";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "あなたのサポート予定",
  robots: { index: false, follow: false },
};
export default async function Manage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { token } = await params;
  const assignment = await (await supportService()).manage(token);
  if (!assignment) notFound();
  return (
    <>
      <Header minimal />
      <main id="main" className="container">
        <ManageAssignment
          assignment={assignment}
          token={token}
          isNew={(await searchParams).new === "1"}
          emailEnabled={
            !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
          }
        />
      </main>
      <Footer />
    </>
  );
}
