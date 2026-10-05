import type { Metadata } from "next";
import { connection } from "next/server";
import { ActionButton } from "@/components/ActionButton";
import { BackupDownload } from "@/components/BackupDownload";
import { DeleteAllButton } from "@/components/DeleteAllButton";
import { ImportForm } from "@/components/ImportForm";
import { loadSampleData, resetAllData } from "@/lib/actions";
import { getT } from "@/lib/i18n-server";
import { getStats } from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Manage data", "จัดการข้อมูล") };
}

export default async function DataPage() {
  await connection();
  const [stats, t] = await Promise.all([getStats(), getT()]);
  const counts = [
    { value: stats.projects, label: "Project" },
    { value: stats.tasks, label: t("tasks", "งาน") },
    { value: stats.logs, label: t("history entries", "ประวัติ") },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-3 pb-1">
        <h1 className="page-title sm:text-[30px]">{t("Manage data", "จัดการข้อมูล")}</h1>
        <dl className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {counts.map((c) => (
            <div key={c.label} className="card rounded-xl! px-3 py-3 sm:px-4">
              <dd className="text-[22px] leading-tight font-semibold tabular-nums sm:text-2xl">{c.value}</dd>
              <dt className="text-xs text-muted sm:text-[13px]">{c.label}</dt>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted sm:text-[13px]">{t("All data is stored in PostgreSQL via the API", "ข้อมูลทั้งหมดเก็บในฐานข้อมูล PostgreSQL ผ่าน API")}</p>
      </div>

      <section className="card p-5 sm:p-6">
        <BackupDownload />
      </section>

      <section className="card space-y-3 p-5 sm:p-6">
        <div>
          <h2 className="section-title">{t("Restore from a backup", "กู้คืนจาก File สำรอง")}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {t(
              <>Your current data will be <b className="font-semibold text-bad">completely replaced</b> by the file&apos;s data. A backup of your current data is downloaded first.</>,
              <>ข้อมูลปัจจุบันจะถูก<b className="font-semibold text-bad">แทนที่ทั้งหมด</b>ด้วยข้อมูลใน File โดยระบบจะ Download File สำรองของข้อมูลปัจจุบันให้ก่อน</>,
            )}
          </p>
        </div>
        <ImportForm current={stats} />
      </section>

      <section className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex-1">
          <h2 className="section-title">{t("Sample data", "ข้อมูลตัวอย่าง")}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {t(
              "Adds 3 sample projects to try things out — your own projects stay as they are.",
              "เพิ่ม Project ตัวอย่าง 3 อันไว้ลองใช้งาน — Project เดิมของคุณอยู่ครบ ไม่ถูกลบ",
            )}
          </p>
        </div>
        <ActionButton action={loadSampleData}>{t("Add sample data", "เพิ่มข้อมูลตัวอย่าง")}</ActionButton>
      </section>

      <section className="flex flex-col gap-3 border border-bad-soft p-5 sm:flex-row sm:items-center sm:p-6" style={{ borderRadius: "var(--radius)" }}>
        <div className="flex-1">
          <h2 className="section-title text-bad">{t("Delete all data", "ลบข้อมูลทั้งหมด")}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {t(
              "Permanently deletes every project, task and history entry in your account. A backup file is downloaded first.",
              "ลบ Project งาน และประวัติทั้งหมดในบัญชีนี้ถาวร โดยระบบจะ Download File สำรองให้ก่อน",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DeleteAllButton action={resetAllData} counts={stats} />
        </div>
      </section>
    </div>
  );
}
