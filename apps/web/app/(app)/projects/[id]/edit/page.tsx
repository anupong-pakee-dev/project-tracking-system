import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ProjectForm } from "@/components/ProjectForm";
import { updateProject } from "@/lib/actions";
import { getT } from "@/lib/i18n-server";
import { getProjectView } from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Edit project", "แก้ไข Project") };
}

export default async function EditProjectPage({ params }: PageProps<"/projects/[id]/edit">) {
  await connection();
  const { id } = await params;
  const [view, t] = await Promise.all([getProjectView(id), getT()]);
  if (!view) notFound();
  const { project } = view;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/projects/${id}`} className="text-sm text-muted hover:underline">← {project.name}</Link>
      <h1 className="text-2xl font-semibold">{t("Edit project", "แก้ไข Project")}</h1>
      <ProjectForm
        action={updateProject.bind(null, id)}
        project={project}
        defaults={{ startDate: project.startDate, targetDate: project.targetDate }}
      />
      <p className="text-xs text-muted">
        {t(
          "Moving the target date changes the plan line and status right away, but doesn't touch the progress history.",
          "การเลื่อนวันเป้าหมายจะเปลี่ยนเส้นแผนและสถานะทันที แต่ไม่กระทบประวัติความคืบหน้า",
        )}
      </p>
    </div>
  );
}
