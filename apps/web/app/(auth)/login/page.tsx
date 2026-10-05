import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/AuthForms";
import { getAuthProviders, googleErrorMessage } from "@/lib/google-auth";
import { getT } from "@/lib/i18n-server";
import { safeNext } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Sign in", "เข้าสู่ระบบ") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const t = await getT();
  const notice = sp.expired ? t("Your session has expired — please sign in again", "Session หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง") : undefined;
  const { google } = await getAuthProviders();
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">{t("Sign in", "เข้าสู่ระบบ")}</h1>
      <p className="mb-5 text-sm text-muted">{t("Keep track of your projects' progress", "ติดตามความคืบหน้า Project ของคุณ")}</p>
      <LoginForm next={safeNext(sp.next)} notice={notice} error={googleErrorMessage(sp.error, t)} google={google} />
    </>
  );
}
