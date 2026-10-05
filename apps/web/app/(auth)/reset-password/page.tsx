import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/AuthForms";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Set a new password", "ตั้งรหัสผ่านใหม่") };
}

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const t = await getT();
  if (typeof token !== "string" || !token) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">{t("Incomplete link", "Link ไม่ครบ")}</h1>
        <p className="text-sm text-muted">{t("Open the link from your email again, or request a new one", "เปิด Link จาก Email อีกครั้ง หรือขอ Link ใหม่")}</p>
        <Link href="/forgot-password" className="btn w-full">{t("Request a new link", "ขอ Link ใหม่")}</Link>
      </div>
    );
  }
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">{t("Set a new password", "ตั้งรหัสผ่านใหม่")}</h1>
      <p className="mb-5 text-sm text-muted">
        {t("Other devices that are signed in will be signed out.", "หลังตั้งรหัสผ่านใหม่ อุปกรณ์อื่นที่เข้าสู่ระบบอยู่จะถูกออกจากระบบ")}
      </p>
      <ResetPasswordForm token={token} />
    </>
  );
}
