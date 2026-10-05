import type { Metadata } from "next";
import Link from "next/link";
import { VerifyEmailForm } from "@/components/auth/AuthForms";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Verify email", "ยืนยัน Email") };
}

// The emailed link opens this page; verifying needs a click (a POST) so link scanners that
// prefetch URLs can't use up the token.
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { token } = await searchParams;
  const t = await getT();
  if (typeof token !== "string" || !token) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">{t("Incomplete link", "Link ไม่ครบ")}</h1>
        <p className="text-sm text-muted">
          {t(
            "Open the link from your email again, or request a new one from the sign-in page",
            "เปิด Link จาก Email อีกครั้ง หรือขอ Link ใหม่จากหน้าเข้าสู่ระบบ",
          )}
        </p>
        <Link href="/login" className="btn w-full">{t("Go to sign in", "ไปหน้าเข้าสู่ระบบ")}</Link>
      </div>
    );
  }
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">{t("Verify email", "ยืนยัน Email")}</h1>
      <p className="mb-5 text-sm text-muted">{t("Press the button below to activate your account", "กดปุ่มด้านล่างเพื่อเปิดใช้งานบัญชีของคุณ")}</p>
      <VerifyEmailForm token={token} />
    </>
  );
}
