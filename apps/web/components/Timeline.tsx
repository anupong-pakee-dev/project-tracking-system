import Link from "next/link";
import { addDays, daysBetween, maxDate, minDate } from "@tracker/shared/dates";
import type { ProjectView } from "@tracker/shared/api";
import type { ISODate } from "@tracker/shared/types";
import type { T } from "@/lib/i18n";
import { HEALTH_STYLE, slipText } from "./ui";

/**
 * Gantt-style overview: planned window per project, the target marked with a tick and the forecast finish with a diamond
 * (dashed tail when it lands past the target). Phones: name + verdict above each bar. sm and up: name column on the left.
 */
export function Timeline({ views, today, t }: { views: ProjectView[]; today: ISODate; t: T }) {
  if (views.length === 0) return null;

  const start = addDays(minDate(...views.map((v) => v.project.startDate), today), -2);
  const ends = views.map((v) => {
    const f = v.forecast;
    const eta = f.health === "done" ? v.project.completedAt ?? v.project.targetDate : f.eta;
    return maxDate(v.project.targetDate, eta ?? v.project.targetDate);
  });
  const rawEnd = maxDate(...ends, today);
  const cap = addDays(today, 365);
  const end = addDays(rawEnd > cap ? cap : rawEnd, 4);
  const span = Math.max(1, daysBetween(start, end));
  const pos = (d: ISODate) => Math.min(100, Math.max(0, (daysBetween(start, d) / span) * 100));

  const months = monthStarts(start, end);
  const todayPos = pos(today);

  return (
    <div className="card h-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line-soft px-4 py-3 sm:px-5 sm:py-3.5">
        <h2 className="text-[15px] font-semibold">{t("Timeline", "Timeline")}</h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted sm:gap-4 sm:text-xs">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className="h-2 w-5 rounded-full border border-line bg-surface-2" />{t("Plan", "แผน")}</span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className="h-3 w-0.5 rounded bg-text/60" />{t("Target", "เป้าหมาย")}</span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className="size-2.5 rotate-45 rounded-[2px] bg-muted" />{t("Forecast finish", "คาดเสร็จ")}</span>
        </div>
      </div>
      <div className="px-4 pt-8 pb-4 sm:px-5 sm:pb-[18px]">
        <div className="relative ml-0 sm:ml-44 lg:mr-40">
          <div className="relative h-[22px] text-[11px] text-faint">
            {months.map((m) => (
              <span key={m} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pos(m)}%` }}>
                {t.dayMonth(m)}
              </span>
            ))}
          </div>
        </div>

        <ul className="relative space-y-3 sm:space-y-2.5">
          {views.map((v) => {
            const { project: p, forecast: f } = v;
            const style = HEALTH_STYLE[f.health];
            const finish = f.health === "done" ? p.completedAt : f.eta;
            const left = pos(p.startDate);
            const width = Math.max(0.5, pos(p.targetDate) - left);
            const lateTail = finish && finish > p.targetDate;
            const active = f.health !== "done" && f.health !== "paused";
            return (
              <li key={p.id} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-0">
                <div className="flex w-full min-w-0 items-center gap-2 pr-3 sm:w-44 sm:shrink-0">
                  <Link href={`/projects/${p.id}`} className="flex min-w-0 items-center gap-2 text-sm hover:underline">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </Link>
                  {active && (
                    <span className="ml-auto shrink-0 text-xs font-semibold whitespace-nowrap sm:hidden" style={{ color: style.color }}>
                      {slipText(f, t)}
                    </span>
                  )}
                </div>
                <div className="relative h-7 flex-1">
                  {months.map((m) => (
                    <span key={m} className="absolute inset-y-0 w-px bg-line-soft" style={{ left: `${pos(m)}%` }} />
                  ))}
                  <div
                    className="absolute top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full"
                    style={{ left: `${left}%`, width: `${width}%`, background: `color-mix(in srgb, ${p.color} 20%, transparent)` }}
                    title={`${t("Plan", "แผน")}: ${t.date(p.startDate)} – ${t.date(p.targetDate)}`}
                  >
                    <div className="h-full rounded-full" style={{ width: `${f.progress}%`, background: p.color }} />
                  </div>
                  {lateTail && (
                    <div
                      className="absolute top-1/2 h-0 -translate-y-1/2 border-t-2 border-dashed opacity-80"
                      style={{ left: `${pos(p.targetDate)}%`, width: `${pos(finish) - pos(p.targetDate)}%`, borderColor: style.color }}
                    />
                  )}
                  <span
                    className="absolute inset-y-1 w-0.5 -translate-x-1/2 rounded bg-text/60"
                    style={{ left: `${pos(p.targetDate)}%` }}
                    title={`${t("Target", "เป้าหมาย")} ${t.date(p.targetDate)}`}
                  />
                  {finish && (
                    <span
                      className="absolute top-1/2 size-[11px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] ring-2 ring-surface"
                      style={{ left: `${pos(finish)}%`, background: style.color }}
                      title={`${f.health === "done" ? t("Finished", "เสร็จเมื่อ") : t("Forecast", "คาดเสร็จ")} ${t.date(finish)}`}
                    />
                  )}
                </div>
                <span className="hidden w-40 shrink-0 pl-3 text-right text-xs font-semibold whitespace-nowrap lg:block" style={{ color: style.color }}>
                  {active ? slipText(f, t) : ""}
                </span>
              </li>
            );
          })}
          {todayPos > 0 && todayPos < 100 && (
            <li aria-hidden className="pointer-events-none absolute inset-y-0 left-0 right-0 mt-0! sm:left-44 lg:right-40">
              <span className="absolute -top-6 bottom-0 w-px bg-accent/70" style={{ left: `${todayPos}%` }} />
              <span className="absolute -top-[46px] -translate-x-1/2 rounded-md bg-accent px-1.5 text-[10px] leading-[18px] font-semibold text-accent-fg" style={{ left: `${todayPos}%` }}>
                {t("Today", "วันนี้")}
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function monthStarts(start: ISODate, end: ISODate): ISODate[] {
  const span = daysBetween(start, end);
  // Weekly gridlines for short ranges, monthly otherwise.
  if (span <= 70) {
    const out: ISODate[] = [];
    for (let i = 7; i < span; i += 7) out.push(addDays(start, i));
    return out;
  }
  const out: ISODate[] = [];
  let [y, m] = start.split("-").map(Number);
  for (;;) {
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    const d = `${y}-${String(m).padStart(2, "0")}-01`;
    if (d >= end) break;
    out.push(d);
  }
  return out;
}
