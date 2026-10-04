import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { Header, Footer } from "@/components/shell";
import { Wizard } from "@/components/wizard";
import { TrackView } from "@/components/analytics";
export const metadata = {
  title: "サポートページを作る",
  robots: { index: false, follow: false },
};
export default async function Create() {
  if (!(await currentUser())) redirect("/login");
  return (
    <>
      <Header minimal />
      <TrackView name="create_started" />
      <main id="main" className="form-page container">
        <Wizard />
      </main>
      <Footer />
    </>
  );
}
