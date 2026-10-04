import { redirect } from "next/navigation";
import { Header, Footer } from "@/components/shell";
import { LoginForm } from "@/components/login-form";
import { currentUser } from "@/lib/auth/server";
import { isDemoMode } from "@/lib/env";
export const metadata = {
  title: "ログイン",
  robots: { index: false, follow: false },
};
export default async function Login() {
  if (await currentUser()) redirect("/dashboard");
  return (
    <>
      <Header minimal />
      <main id="main" className="auth-page">
        <div className="auth-card">
          <LoginForm demo={isDemoMode()} />
        </div>
      </main>
      <Footer />
    </>
  );
}
