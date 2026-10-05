import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Forgot password", "ลืมรหัสผ่าน") };
}

export default async function ForgotPasswordPage() {
  const t = await getT();
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">{t("Forgot password", "ลืมรหัสผ่าน")}</h1>
      <p className="mb-5 text-sm text-muted">
        {t(
          "Enter your account's email and we'll send you a link to set a new password",
          "กรอก Email ของบัญชี เราจะส่ง Link สำหรับตั้งรหัสผ่านใหม่ไปให้",
        )}
      </p>
      <ForgotPasswordForm devMailUrl={process.env.NODE_ENV !== "production" ? "http://localhost:8025" : undefined} />
    </>
  );
}
