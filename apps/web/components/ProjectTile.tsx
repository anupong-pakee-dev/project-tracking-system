import Link from "next/link";
import type { ProjectView } from "@tracker/shared/api";
import type { ISODate } from "@tracker/shared/types";
import type { T } from "@/lib/i18n";
import { HEALTH_STYLE, HealthBadge, pct, slipText } from "./ui";

/** Donut showing progress in the project's colour. `bg` must match what's behind it. */
export function ProgressRing({
  progress,
  color,
  size,
  thickness,
  bg,
  label,
  children,
}: {
  progress: number;
  color: string;
  size: number;
  thickness: number;
  bg: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(${color} 0 ${progress}%, var(--surface-2) ${progress}% 100%)` }}
    >
      <span
        className="grid place-items-center rounded-full text-center tabular-nums"
        style={{ width: size - thickness * 2, height: size - thickness * 2, background: bg }}
      >
        {children}
      </span>
    </div>
  );
}

/** Dashboard card: tinted header with ring + verdict, dates, and the Update action. */
export function ProjectTile({ view, today, t }: { view: ProjectView; today: ISODate; t: T }) {
  const { project: p, forecast: f } = view;
  const active = f.health !== "done" && f.health !== "paused";
  const tone = HEALTH_STYLE[f.health].color;
  const tint = `color-mix(in srgb, ${p.color} 12%, var(--surface))`;

  return (
    <article className="card flex w-[300px] shrink-0 snap-start flex-col overflow-hidden rounded-[18px]! md:w-auto">
      <Link href={`/projects/${p.id}`} className="block px-[18px] pt-[18px] pb-4 hover:no-underline" style={{ background: tint }}>
        <div className="flex items-center justify-between gap-2">
          <HealthBadge health={f.health} t={t} />
          <span className="truncate text-xs text-muted">
            {f.isStale ? (
              <span className="font-semibold text-warn">
                ⚠ {f.lastUpdate ? t(`No update for ${f.staleDays} days`, `ไม่ได้ Update มา ${f.staleDays} วัน`) : t("Never updated", "ยังไม่เคย Update")}
              </span>
            ) : f.lastUpdate ? (
              t(`Updated ${t.rel(today, f.lastUpdate)}`, `Update ${t.rel(today, f.lastUpdate)}`)
            ) : (
              t("Never updated", "ยังไม่เคย Update")
            )}
          </span>
        </div>
        <div className="mt-3.5 flex items-center gap-3.5">
          <ProgressRing progress={f.progress} color={p.color} size={76} thickness={7} bg={tint} label={t(`Progress of ${p.name}`, `ความคืบหน้า ${p.name}`)}>
            <span className="text-lg font-semibold">{pct(f.progress)}</span>
          </ProgressRing>
          <div className="min-w-0">
            <p className="text-base leading-snug font-semibold text-pretty">{p.name}</p>
            <p className="mt-0.5 text-[13px] leading-snug font-semibold" style={{ color: tone }}>{slipText(f, t)}</p>
            {p.description && <p className="mt-0.5 hidden truncate text-xs text-muted md:block">{p.description}</p>}
          </div>
        </div>
      </Link>
      <dl className="grid grid-cols-2 border-t border-line-soft px-[18px] py-3">
        <div>
          <dt className="text-[11px] text-muted">{f.health === "done" ? t("Finished", "เสร็จเมื่อ") : t("Forecast finish", "คาดว่าเสร็จ")}</dt>
          <dd className="text-sm font-semibold" style={{ color: tone }}>
            {f.health === "done" ? (p.completedAt ? t.date(p.completedAt) : "—") : f.eta && active ? t.date(f.eta) : "—"}
          </dd>
          {active && f.etaOptimistic && f.etaPessimistic && f.etaOptimistic !== f.etaPessimistic && (
            <dd className="hidden text-xs text-muted md:block">
              {t("Range", "ช่วง")} {t.dayMonth(f.etaOptimistic)} – {t.dayMonth(f.etaPessimistic)}
            </dd>
          )}
        </div>
        <div>
          <dt className="text-[11px] text-muted">
            {t("Target", "เป้าหมาย")}
            {active && <> · {t.rel(today, p.targetDate)}</>}
          </dt>
          <dd className="text-sm font-semibold">{t.date(p.targetDate)}</dd>
        </div>
      </dl>
      <div className="mt-auto flex gap-2 px-3.5 pb-3.5">
        {f.health !== "done" && (
          <Link href={`/projects/${p.id}#update`} className="btn btn-primary h-11 flex-1 text-[15px] md:h-10 md:text-sm">
            Update
          </Link>
        )}
        <Link href={`/projects/${p.id}`} className={`btn h-11 md:h-10 ${f.health === "done" ? "flex-1" : ""}`}>
          {t("Details", "รายละเอียด")}
        </Link>
      </div>
    </article>
  );
}
