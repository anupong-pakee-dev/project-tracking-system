import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ActionButton } from "@/components/ActionButton";
import { BurnupChart } from "@/components/BurnupChart";
import { ProgressUpdateForm } from "@/components/ProgressUpdateForm";
import { ProgressRing } from "@/components/ProjectTile";
import { TaskChecklist } from "@/components/TaskChecklist";
import { TaskManager } from "@/components/TaskManager";
import { UpdatePanel } from "@/components/UpdatePanel";
import { formatRate, HEALTH_STYLE, HealthBadge, pct, slipText, varianceText } from "@/components/ui";
import { deleteLog, deleteProject, setProjectStatus, submitProgress } from "@/lib/actions";
import type { T } from "@/lib/i18n";
import { getT } from "@/lib/i18n-server";
import { daysBetween, todayISO, workdaysBetween } from "@tracker/shared/dates";
import type { Forecast } from "@tracker/shared/forecast";
import type { Project } from "@tracker/shared/types";
import { getProjectView } from "@/lib/queries";

export async function generateMetadata({ params }: PageProps<"/projects/[id]">): Promise<Metadata> {
  await connection();
  const [view, t] = await Promise.all([getProjectView((await params).id), getT()]);
  return { title: view?.project.name ?? t("Project not found", "ไม่พบ Project") };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  await connection();
  const { id } = await params;
  const today = todayISO();
  const [view, t] = await Promise.all([getProjectView(id), getT()]);
  if (!view) notFound();

  const { project: p, tasks, logs, forecast: f } = view;
  const active = f.health !== "done" && f.health !== "paused" && f.health !== "not-started";
  const duration = daysBetween(p.startDate, p.targetDate);
  const workdays = workdaysBetween(p.startDate, p.targetDate);
  const tone = HEALTH_STYLE[f.health].color;
  const tint = `color-mix(in srgb, ${p.color} 12%, var(--surface))`;
  const unitTh = f.unit === "workday" ? "วันทำงาน" : "วัน";
  const unitEn = (n: number) => (f.unit === "workday" ? "workday" : "day") + (Math.abs(n) === 1 ? "" : "s");
  const left =
    f.health === "done"
      ? "—"
      : f.daysLeft >= 0
        ? t(`${f.daysLeft} ${unitEn(f.daysLeft)}`, `${f.daysLeft} ${unitTh}`)
        : t(`${-f.daysLeft} ${unitEn(f.daysLeft)} over`, `เลยมา ${-f.daysLeft} ${unitTh}`);

  const stats: { label: string; value: string; tone?: string; wide?: boolean }[] = [
    {
      label: f.health === "done" ? t("Finished", "เสร็จเมื่อ") : t("Forecast finish", "คาดว่าเสร็จ"),
      value: f.health === "done" ? (p.completedAt ? t.date(p.completedAt) : "—") : active && f.eta ? t.date(f.eta) : "—",
      tone,
    },
    { label: t("Target", "เป้าหมาย"), value: t.date(p.targetDate) },
    { label: t("Left", "เหลือ"), value: left },
    { label: t("Pace", "ความเร็ว"), value: formatRate(f.rate, f.unit, t.lang), wide: true },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="-mx-4 -mt-5 border-b border-line-soft px-4 pt-1 pb-5 sm:mx-0 sm:mt-0 sm:rounded-[18px] sm:border sm:border-line sm:p-7" style={{ background: tint }}>
        <div className="flex items-center justify-between gap-2 sm:mb-3">
          <Link href="/" className="-ml-1 inline-flex h-10 items-center px-1 text-sm text-muted hover:underline">← {t("Overview", "ภาพรวม")}</Link>
          {/* Phones: management actions live in a menu so they never crowd the title. */}
          <details className="relative sm:hidden">
            <summary className="grid size-10 cursor-pointer place-items-center rounded-full bg-surface/70 text-lg font-bold" aria-label={t("Project actions", "จัดการ Project")}>⋯</summary>
            <div className="card absolute right-0 z-30 mt-2 flex w-56 flex-col p-1.5 shadow-[0_8px_24px_rgb(20_24_32/0.18)] [&_.btn]:h-11 [&_.btn]:w-full [&_.btn]:justify-start [&_.btn]:border-transparent">
              <ProjectActions project={p} t={t} />
            </div>
          </details>
        </div>

        <div className="flex flex-col items-center text-center sm:grid sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-7 sm:text-left">
          <ProgressRing progress={f.progress} color={p.color} size={140} thickness={10} bg={tint} label={t(`Progress of ${p.name}`, `ความคืบหน้า ${p.name}`)}>
            <span>
              <span className="block text-[36px] leading-none font-semibold tracking-tight">{pct(f.progress)}</span>
              {active && <span className="mt-1 block text-[11px] text-muted">{t("Plan", "แผน")} {pct(f.plannedProgress)}</span>}
            </span>
          </ProgressRing>

          <div className="mt-3.5 min-w-0 sm:mt-0">
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <h1 className="page-title text-[21px] break-words sm:text-[28px]">{p.name}</h1>
              <span className="hidden sm:inline-flex"><HealthBadge health={f.health} t={t} /></span>
            </div>
            {p.description && <p className="mt-0.5 text-[13px] text-muted sm:text-sm">{p.description}</p>}
            <p className="mt-0.5 hidden text-[13px] text-faint sm:block">
              {t.date(p.startDate)} – {t.date(p.targetDate)} ·{" "}
              {t(
                `${duration} days${p.skipWeekends ? ` (${workdays} workdays · weekends not counted)` : ""}`,
                `${duration} วัน${p.skipWeekends ? ` (${workdays} วันทำงาน · ไม่นับเสาร์–อาทิตย์)` : ""}`,
              )}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 sm:justify-start">
              <span className="sm:hidden"><HealthBadge health={f.health} t={t} /></span>
              <span className="text-sm font-semibold sm:text-lg" style={{ color: tone }}>{slipText(f, t)}</span>
              {active && <span className="hidden text-xs text-muted sm:inline">· {varianceText(f.scheduleVariance, t)}</span>}
            </div>

            <dl className="mt-4 grid w-full grid-cols-3 gap-2 text-left sm:max-w-[640px] sm:grid-cols-4 sm:gap-2.5">
              {stats.map((s) => (
                <div key={s.label} className={`min-w-0 rounded-xl bg-surface/75 px-3 py-2.5 sm:px-3.5 ${s.wide ? "col-span-3 flex items-baseline justify-between sm:col-span-1 sm:block" : ""}`}>
                  <dt className="text-[11px] text-muted sm:text-xs">{s.label}</dt>
                  <dd className="truncate text-[15px] font-semibold sm:text-base" style={s.tone ? { color: s.tone } : undefined}>{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="hidden flex-col gap-2 self-start sm:flex">
            {f.health !== "done" && <Link href="#update" className="btn btn-primary h-11 px-5 text-[15px]">{t("Update progress", "Update ความคืบหน้า")}</Link>}
            <div className="flex flex-wrap gap-1.5 [&_.btn]:h-9 [&_.btn]:px-3 [&_.btn]:text-[13px]">
              <ProjectActions project={p} t={t} />
            </div>
          </div>
        </div>
      </section>

      <Verdict forecast={f} t={t} />

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="min-w-0 space-y-4 sm:space-y-5">
          <section className="card min-w-0 p-4 sm:p-[22px]">
            <h2 className="section-title mb-4">{t("Progress vs. plan", "ความคืบหน้าเทียบแผน")}</h2>
            <BurnupChart project={p} forecast={f} today={today} t={t} />
          </section>

          <section className="space-y-2.5">
            <h2 className="section-title">
              {t("Tasks", "งานย่อย")} <span className="font-medium text-muted">({tasks.length})</span>
            </h2>
            <TaskChecklist tasks={tasks} color={p.color} action={submitProgress.bind(null, p.id)} />
            <details className="card group/m">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium select-none">
                {t("Manage tasks — add, edit, reorder, delete", "จัดการงานย่อย — เพิ่ม แก้ไข เรียงลำดับ ลบ")}
                <span aria-hidden className="ml-auto text-xs text-muted group-open/m:rotate-180">▾</span>
              </summary>
              <div className="border-t border-line-soft p-4 sm:p-[22px]">
                <TaskManager projectId={p.id} tasks={tasks} color={p.color} hasManualProgress={p.manualProgress > 0} />
              </div>
            </details>
          </section>
        </div>

        <section className="card flex min-w-0 flex-col p-4 sm:p-[22px]">
          <h2 className="section-title mb-2 shrink-0">{t("Update history", "ประวัติการ Update")}</h2>
          {logs.length === 0 ? (
            <p className="text-sm text-muted">{t("No history yet", "ยังไม่มีประวัติ")}</p>
          ) : (
            <ol className="max-h-[420px] divide-y divide-line-soft overflow-y-auto lg:max-h-[720px]">
              {logs.map((l, i) => {
                const prev = logs[i + 1];
                const delta = prev ? l.progress - prev.progress : l.progress;
                return (
                  <li key={l.id} className="group flex items-start gap-3 py-2.5 text-sm">
                    <div className="w-14 shrink-0 text-muted tabular-nums">{t.dayMonth(l.date)}</div>
                    <div className="min-w-0 flex-1">
                      {l.kind === "scope" && (
                        <span className="mr-2 rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-semibold text-warn">
                          {t("Scope change", "ขอบเขตเปลี่ยน")}
                        </span>
                      )}
                      <span className={l.note ? "" : "text-muted"}>{l.note || "—"}</span>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <span className="font-semibold">{pct(l.progress)}</span>
                      {Math.abs(delta) >= 0.5 && (
                        <span className={`ml-1.5 text-xs ${delta > 0 ? "text-ok" : "text-bad"}`}>
                          {delta > 0 ? "+" : ""}
                          {Math.round(delta)}
                        </span>
                      )}
                    </div>
                    <ActionButton
                      action={deleteLog.bind(null, l.id)}
                      confirm={t(
                        "Delete this history entry? (Current progress stays the same, but the forecast changes.)",
                        "ลบประวัติรายการนี้? (ไม่กระทบความคืบหน้าปัจจุบัน แต่มีผลต่อการคาดการณ์)",
                      )}
                      className="btn btn-ghost btn-danger -my-0.5 px-2 py-0.5 text-xs sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                      title={t("Delete entry", "ลบประวัติ")}
                    >
                      {t("Delete", "ลบ")}
                    </ActionButton>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {f.health !== "done" && (
        <UpdatePanel title={t("Update progress", "Update ความคืบหน้า")} subtitle={p.name} color={p.color}>
          <ProgressUpdateForm
            action={submitProgress.bind(null, p.id)}
            tasks={tasks}
            manualProgress={p.manualProgress}
            today={today}
            color={p.color}
          />
        </UpdatePanel>
      )}

      {/* Phones: the main action stays under the thumb. */}
      {f.health !== "done" && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line-soft bg-nav/90 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden">
          <Link href="#update" className="btn btn-primary h-[50px] w-full rounded-xl! text-base">{t("Update progress", "Update ความคืบหน้า")}</Link>
        </div>
      )}
    </div>
  );
}

function ProjectActions({ project: p, t }: { project: Project; t: T }) {
  return (
    <>
      <Link href={`/projects/${p.id}/edit`} className="btn">{t("Edit", "แก้ไข")}</Link>
      {p.status === "active" && (
        <ActionButton action={setProjectStatus.bind(null, p.id, "paused")}>{t("Pause", "พักไว้")}</ActionButton>
      )}
      {p.status !== "active" && (
        <ActionButton action={setProjectStatus.bind(null, p.id, "active")}>
          {p.status === "done" ? t("Reopen", "เปิดใหม่") : t("Resume", "ทำต่อ")}
        </ActionButton>
      )}
      {p.status !== "done" && (
        <ActionButton
          action={setProjectStatus.bind(null, p.id, "done")}
          confirm={t("Mark this project as done?", "ทำเครื่องหมายว่า Project นี้เสร็จแล้ว?")}
        >
          ✓ {t("Done", "เสร็จแล้ว")}
        </ActionButton>
      )}
      <ActionButton
        action={deleteProject.bind(null, p.id)}
        confirm={t(
          `Delete "${p.name}" with all its tasks and history? This can't be undone.`,
          `ลบ Project "${p.name}" พร้อมงานและประวัติทั้งหมด? ย้อนกลับไม่ได้`,
        )}
        className="btn btn-ghost btn-danger"
      >
        {t("Delete", "ลบ")}
      </ActionButton>
    </>
  );
}

function Verdict({ forecast: f, t }: { forecast: Forecast; t: T }) {
  const style = HEALTH_STYLE[f.health];
  let advice: string | null = null;
  if (f.health === "at-risk" || f.health === "late") {
    if (f.requiredRate !== null && f.rate !== null) {
      const factor = f.rate > 0 ? f.requiredRate / f.rate : Infinity;
      const need = formatRate(f.requiredRate, f.unit, t.lang);
      advice = Number.isFinite(factor)
        ? t(
            `You need ${need} (${factor.toFixed(1)}× faster) to hit the target — or consider cutting scope / moving the target date`,
            `ต้องเร่งเป็น ${need} (เร็วขึ้น ${factor.toFixed(1)} เท่า) จึงจะทันเป้า — หรือพิจารณาลดขอบเขต/เลื่อนวันเป้าหมาย`,
          )
        : t(`You need ${need} to hit the target`, `ต้องทำได้ ${need} จึงจะทันเป้า`);
    } else if (f.daysLeft < 0) {
      advice = t(
        "Past the target date — consider a realistic new target based on the forecast",
        "เลยวันเป้าหมายแล้ว — พิจารณาตั้งวันเป้าหมายใหม่ให้สมจริงจากวันคาดว่าเสร็จ",
      );
    }
  } else if (f.health === "on-track" && f.rate !== null) {
    const rate = formatRate(f.rate, f.unit, t.lang);
    advice = t(`Keep a pace of ${rate} and you'll finish on time`, `ถ้ารักษาความเร็วที่ ${rate} ไว้ได้ จะเสร็จทันเป้า`);
  }
  const stale = f.isStale && f.health !== "no-data";
  if (!advice && !stale) return null;
  return (
    <div
      className="flex gap-3 px-4 py-3.5 sm:px-5"
      style={{ borderRadius: "var(--radius)", background: `color-mix(in srgb, ${style.color} 9%, var(--surface))` }}
    >
      <span aria-hidden className="mt-[9px] size-2 shrink-0 rounded-full" style={{ background: style.color }} />
      <div>
        {advice && <p className="text-sm text-pretty text-text/80">{advice}</p>}
        {stale && (
          <p className="mt-0.5 text-sm text-warn">
            {f.lastUpdate
              ? t(
                  `No update for ${f.staleDays} days — the forecast may be off. Try recording your latest progress.`,
                  `ไม่ได้ Update มา ${f.staleDays} วัน — การคาดการณ์อาจไม่ตรงความจริง ลอง Update ความคืบหน้าล่าสุด`,
                )
              : t(
                  "The forecast may be off. Try recording your latest progress.",
                  "การคาดการณ์อาจไม่ตรงความจริง ลอง Update ความคืบหน้าล่าสุด",
                )}
          </p>
        )}
      </div>
    </div>
  );
}
