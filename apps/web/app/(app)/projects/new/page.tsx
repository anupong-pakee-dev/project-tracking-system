import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ProjectForm } from "@/components/ProjectForm";
import { createProject } from "@/lib/actions";
import { getT } from "@/lib/i18n-server";
import { addDays, todayISO } from "@tracker/shared/dates";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("New project", "Project ใหม่") };
}

export default async function NewProjectPage() {
  await connection();
  const today = todayISO();
  const t = await getT();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/" className="text-sm text-muted hover:underline">← {t("Overview", "ภาพรวม")}</Link>
      <h1 className="text-2xl font-semibold">{t("New project", "Project ใหม่")}</h1>
      <ProjectForm action={createProject} defaults={{ startDate: today, targetDate: addDays(today, 30) }} />
    </div>
  );
}
