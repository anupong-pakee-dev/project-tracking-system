import Link from "next/link";
import type { ProjectView } from "@tracker/shared/api";
import { HEALTH_LABEL } from "@tracker/shared/forecast";
import type { ISODate } from "@tracker/shared/types";
import type { T } from "@/lib/i18n";
import { HEALTH_STYLE, HealthBadge, ProgressBar, pct, slipText } from "./ui";

export function ProjectCard({ view, today, t }: { view: ProjectView; today: ISODate; t: T }) {
  const { project: p, forecast: f, tasks } = view;
  const active = f.health !== "done" && f.health !== "paused";
  const openTasks = tasks.filter((task) => task.progress < 100).length;
  const updated = f.lastUpdate ? t.rel(today, f.lastUpdate) : "";

  return (
    <article className="card flex flex-col px-[22px] pt-[22px] pb-[18px]">
      <div className="flex items-start gap-2.5">
        <span className="mt-2 size-[9px] shrink-0 rounded-full" style={{ background: p.color }} />
        <div className="min-w-0 flex-1">
          <Link href={`/projects/${p.id}`} className="block truncate text-base font-semibold hover:underline">
            {p.name}
          </Link>
          {p.description && <p className="truncate text-[13px] text-muted">{p.description}</p>}
          {p.skipWeekends && (
            <p className="text-xs text-faint" title={t("Weekends aren't counted", "ไม่นับวันเสาร์–อาทิตย์")}>
              {t("Mon–Fri only", "นับเฉพาะวันจันทร์–ศุกร์")}
            </p>
          )}
        </div>
        <HealthBadge health={f.health} t={t} />
      </div>

      <div className="mt-[22px]">
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          <span className="text-[30px] leading-none font-semibold tabular-nums">{pct(f.progress)}</span>
          {active && f.health !== "not-started" && (
            <span className="text-right text-xs text-muted">
              {t(`Plan: ${pct(f.plannedProgress)}`, `ตามแผนควรถึง ${pct(f.plannedProgress)}`)}
            </span>
          )}
        </div>
        <ProgressBar
          progress={f.progress}
          planned={active ? f.plannedProgress : undefined}
          color={p.color}
          label={t(`Progress of ${p.name}`, `ความคืบหน้า ${p.name}`)}
          plannedTitle={t(`Plan says ${pct(f.plannedProgress)} by now`, `ตามแผนควรถึง ${pct(f.plannedProgress)}`)}
        />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-muted">{f.health === "done" ? t("Finished", "เสร็จเมื่อ") : t("Forecast finish", "คาดว่าเสร็จ")}</dt>
          <dd className="text-sm font-semibold" style={{ color: HEALTH_STYLE[f.health].color }}>
            {f.health === "done"
              ? p.completedAt ? t.date(p.completedAt) : "—"
              : f.eta && active ? t.date(f.eta) : "—"}
          </dd>
          {active && f.etaOptimistic && f.etaPessimistic && f.etaOptimistic !== f.etaPessimistic && (
            <dd className="text-xs text-muted">
              {t("Range", "ช่วง")} {t.dayMonth(f.etaOptimistic)} – {t.dayMonth(f.etaPessimistic)}
            </dd>
          )}
        </div>
        <div>
          <dt className="text-xs text-muted">{t("Target", "เป้าหมาย")}</dt>
          <dd className="text-sm font-semibold">{t.date(p.targetDate)}</dd>
          {active && <dd className="text-xs text-muted">{t.rel(today, p.targetDate)}</dd>}
        </div>
      </dl>

      <p className="mt-3.5 text-sm font-medium" style={{ color: HEALTH_STYLE[f.health].color }}>{slipText(f, t)}</p>

      <div className="mt-auto pt-4">
        <div className="flex items-center gap-2 border-t border-line-soft pt-3.5 text-xs text-muted">
          <span className="min-w-0 flex-1 truncate">
            {f.isStale ? (
              <span className="font-semibold text-warn">
                ⚠ {f.lastUpdate
                  ? t(`No update for ${f.staleDays} days`, `ไม่ได้ Update มา ${f.staleDays} วัน`)
                  : t("Never updated", "ยังไม่เคย Update")}
              </span>
            ) : f.lastUpdate ? (
              t(`Updated ${updated}`, `Update ล่าสุด ${updated}`)
            ) : (
              t("Never updated", "ยังไม่เคย Update")
            )}
            {tasks.length > 0 && ` · ${t(`${openTasks}/${tasks.length} tasks left`, `เหลือ ${openTasks}/${tasks.length} งาน`)}`}
          </span>
          {f.health !== "done" && (
            <Link href={`/projects/${p.id}#update`} className="btn shrink-0 px-3 py-1 text-[13px] font-semibold">
              {t("Update", "Update")}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/** The project that most needs attention, shown big at the top of the dashboard. */
export function FocusCard({ view, t }: { view: ProjectView; t: T }) {
  const { project: p, forecast: f } = view;
  const tone = HEALTH_STYLE[f.health].color;
  const tint = `color-mix(in srgb, ${tone} 10%, var(--surface))`;
  const active = f.health !== "done" && f.health !== "paused";

  return (
    <article
      className="flex h-full flex-col gap-3.5 p-5"
      style={{ borderRadius: "var(--radius)", background: tint, border: `1px solid color-mix(in srgb, ${tone} 25%, var(--line))` }}
    >
      <p className="text-[11px] font-semibold tracking-wide" style={{ color: tone }}>
        {t("Needs attention first", "ต้องใส่ใจก่อน")}
      </p>
      <div className="flex items-center gap-4">
        <div
          role="progressbar"
          aria-label={t(`Progress of ${p.name}`, `ความคืบหน้า ${p.name}`)}
          aria-valuenow={Math.round(f.progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="grid size-[68px] shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(${p.color} 0 ${f.progress}%, var(--surface-2) ${f.progress}% 100%)` }}
        >
          <span className="grid size-[54px] place-items-center rounded-full text-base font-semibold tabular-nums" style={{ background: tint }}>
            {pct(f.progress)}
          </span>
        </div>
        <div className="min-w-0">
          <Link href={`/projects/${p.id}`} className="block text-[17px] leading-snug font-semibold hover:underline">
            {p.name}
          </Link>
          <p className="text-[15px] font-semibold" style={{ color: tone }}>{slipText(f, t)}</p>
          {active && (
            <p className="text-xs text-muted">
              {t(`Plan: ${pct(f.plannedProgress)}`, `แผนควรถึง ${pct(f.plannedProgress)}`)}
              {f.eta && ` · ${t("Forecast", "คาดเสร็จ")} ${t.date(f.eta)}`}
            </p>
          )}
        </div>
      </div>
      {f.isStale && (
        <p className="text-sm font-medium text-warn">
          ⚠ {f.lastUpdate
            ? t(`No update for ${f.staleDays} days`, `ไม่ได้ Update มา ${f.staleDays} วัน`)
            : t("Never updated", "ยังไม่เคย Update")}
        </p>
      )}
      <div className="mt-auto flex flex-wrap gap-2">
        {f.health !== "done" && (
          <Link href={`/projects/${p.id}#update`} className="btn btn-primary h-11 flex-1 text-[15px]">
            {t("Update progress", "Update ความคืบหน้า")}
          </Link>
        )}
        <Link href={`/projects/${p.id}`} className="btn h-11">{t("Open project", "ดู Project")}</Link>
      </div>
    </article>
  );
}

/** Compact one-line project summary — the phone-friendly replacement for ProjectCard on the dashboard. */
export function ProjectRow({ view, today, t }: { view: ProjectView; today: ISODate; t: T }) {
  const { project: p, forecast: f, tasks } = view;
  const tone = HEALTH_STYLE[f.health].color;
  const active = f.health !== "done" && f.health !== "paused";
  const openTasks = tasks.filter((task) => task.progress < 100).length;
  const label = t(HEALTH_LABEL[f.health].en, HEALTH_LABEL[f.health].th);

  return (
    <article className="card flex items-center gap-3 px-4 py-3.5">
      <span aria-hidden className="w-1 shrink-0 self-stretch rounded-full" style={{ background: p.color }} />
      <div className="min-w-0 flex-1">
        <Link href={`/projects/${p.id}`} className="block truncate text-[15px] font-semibold hover:underline">
          {p.name}
        </Link>
        <p className="truncate text-xs font-medium" style={{ color: tone }}>{label} · {slipText(f, t)}</p>
        <p className="truncate text-xs text-muted">
          {f.isStale ? (
            <span className="font-semibold text-warn">
              ⚠ {f.lastUpdate
                ? t(`No update for ${f.staleDays} days`, `ไม่ได้ Update มา ${f.staleDays} วัน`)
                : t("Never updated", "ยังไม่เคย Update")}
            </span>
          ) : active && f.eta ? (
            `${t("Forecast", "คาดเสร็จ")} ${t.date(f.eta)} · ${t("Target", "เป้าหมาย")} ${t.date(p.targetDate)}`
          ) : (
            `${t("Target", "เป้าหมาย")} ${t.date(p.targetDate)}`
          )}
          {!f.isStale && tasks.length > 0 && ` · ${t(`${openTasks}/${tasks.length} left`, `เหลือ ${openTasks}/${tasks.length} งาน`)}`}
          {!f.isStale && f.lastUpdate && <span className="hidden sm:inline"> · {t(`Updated ${t.rel(today, f.lastUpdate)}`, `Update ${t.rel(today, f.lastUpdate)}`)}</span>}
        </p>
      </div>
      <div className="w-16 shrink-0 text-right">
        <div className="text-lg leading-tight font-semibold tabular-nums">{pct(f.progress)}</div>
        <div className="mt-1">
          <ProgressBar size="sm" progress={f.progress} color={p.color} label={t(`Progress of ${p.name}`, `ความคืบหน้า ${p.name}`)} />
        </div>
      </div>
      {f.health !== "done" && (
        <Link href={`/projects/${p.id}#update`} className="btn h-10 shrink-0 px-3 text-[13px] font-semibold">
          {t("Update", "Update")}
        </Link>
      )}
    </article>
  );
}
