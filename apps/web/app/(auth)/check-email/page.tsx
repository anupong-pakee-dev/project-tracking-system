import type { Metadata } from "next";
import Link from "next/link";
import { ResendVerification } from "@/components/auth/AuthForms";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Check your email", "ตรวจ Email ของคุณ") };
}

export default async function CheckEmailPage({ searchParams }: PageProps<"/check-email">) {
  const { email } = await searchParams;
  const address = typeof email === "string" ? email : "";
  const t = await getT();
  const who = <b className="text-text">{address || t("this email", "Email นี้")}</b>;

  return (
    <div className="space-y-4">
      <div aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-accent/15 text-2xl">✉</div>
      <h1 className="text-center text-xl font-semibold">{t("Check your email", "ตรวจ Email ของคุณ")}</h1>
      <p className="text-center text-sm text-muted">
        {t(
          <>If {who} can be used, we&apos;ve sent a verification link. Open it to activate your account (the link works for 24 hours).</>,
          <>ถ้า {who} ใช้ได้ เราได้ส่ง Link ยืนยันไปแล้ว กด Link ใน Email เพื่อเปิดใช้งานบัญชี (Link ใช้ได้ 24 ชั่วโมง)</>,
        )}
      </p>
      {process.env.NODE_ENV !== "production" && (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          {t("Dev mode: all email goes to Mailpit", "Mode พัฒนา: Email ทั้งหมดอยู่ใน Mailpit")} —{" "}
          <a href="http://localhost:8025" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            http://localhost:8025
          </a>
        </p>
      )}
      {address && <ResendVerification email={address} label={t("Didn't get it? Send again", "ไม่ได้รับ Email? ส่งอีกครั้ง")} />}
      <p className="text-center text-sm">
        <Link href="/login" className="text-accent hover:underline">{t("Back to sign in", "กลับไปหน้าเข้าสู่ระบบ")}</Link>
      </p>
    </div>
  );
}
