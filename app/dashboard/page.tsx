import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { supportService } from "@/services/factory";
import { Header, Footer } from "@/components/shell";
import { DashboardList, AccountSignOut } from "@/components/dashboard";
export const metadata = {
  title: "マイページ",
  robots: { index: false, follow: false },
};
export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const pages = await (await supportService()).list(user);
  return (
    <>
      <Header minimal />
      <main id="main" className="container dashboard-container">
        <div className="account-bar">
          <span>{user.email}</span>
          <AccountSignOut />
        </div>
        <DashboardList pages={pages} />
      </main>
      <Footer />
    </>
  );
}
