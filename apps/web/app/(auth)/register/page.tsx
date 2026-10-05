import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/AuthForms";
import { getAuthProviders } from "@/lib/google-auth";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Sign up", "สมัครสมาชิก") };
}

export default async function RegisterPage() {
  const [{ google }, t] = await Promise.all([getAuthProviders(), getT()]);
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">{t("Sign up", "สมัครสมาชิก")}</h1>
      <p className="mb-5 text-sm text-muted">
        {google
          ? t("Use your Google account or sign up with email — we'll send a verification link", "ใช้บัญชี Google หรือสมัครด้วย Email — เราจะส่ง Link ยืนยันไปให้")
          : t("We'll send a verification link to your email", "เราจะส่ง Link ยืนยันไปที่ Email ของคุณ")}
      </p>
      <RegisterForm google={google} />
    </>
  );
}
