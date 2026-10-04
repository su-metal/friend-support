import { Header, Footer } from "@/components/shell";
import { LoginForm } from "@/components/login-form";
import { isDemoMode } from "@/lib/env";
export const metadata = {
  title: "ログインを完了する",
  robots: { index: false, follow: false },
};
export default function Complete() {
  return (
    <>
      <Header minimal />
      <main id="main" className="auth-page">
        <div className="auth-card">
          <LoginForm
            demo={isDemoMode()}
            complete
            config={{
              apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
              authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
              projectId: process.env.FIREBASE_PROJECT_ID ?? "",
              appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
            }}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
