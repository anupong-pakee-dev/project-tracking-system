import { addDays, daysBetween, maxDate } from "@tracker/shared/dates";
import { plannedProgressAt, type Forecast } from "@tracker/shared/forecast";
import type { ISODate, Project } from "@tracker/shared/types";
import type { T } from "@/lib/i18n";

const W = 600;
const H = 300;
const PAD = { top: 28, right: 20, bottom: 34, left: 40 };

export function BurnupChart({
  project,
  forecast: f,
  today,
  t,
}: {
  project: Project;
  forecast: Forecast;
  today: ISODate;
  t: T;
}) {
  const start = f.series[0].date < project.startDate ? f.series[0].date : project.startDate;
  const duration = Math.max(1, daysBetween(start, project.targetDate));
  const wanted = maxDate(project.targetDate, today, f.etaPessimistic ?? f.eta ?? project.targetDate);
  // Keep runaway forecasts from squashing the chart.
  const cap = addDays(start, duration * 3);
  const rawEnd = wanted > cap ? cap : wanted;
  const end = addDays(rawEnd, Math.max(2, Math.round(daysBetween(start, rawEnd) * 0.04)));
  const span = Math.max(1, daysBetween(start, end));

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (d: ISODate) => PAD.left + (daysBetween(start, d) / span) * innerW;
  const y = (p: number) => PAD.top + (1 - p / 100) * innerH;

  const active = f.health !== "done" && f.health !== "paused" && f.health !== "not-started";
  const ticks = buildTicks(start, end, 5);
  const actual = f.series.map((p) => `${x(p.date)},${y(p.progress)}`).join(" ");
  const todayX = x(today);
  const curY = y(f.progress);

  // Uncertainty band: from today's point to the fast and slow finish dates.
  let band: string | null = null;
  if (active && f.etaOptimistic) {
    const slowX = f.etaPessimistic ? x(f.etaPessimistic) : W - PAD.right;
    const slowY = f.etaPessimistic ? y(100) : curY;
    band = `${todayX},${curY} ${x(f.etaOptimistic)},${y(100)} ${slowX},${y(100)} ${slowX},${slowY}`;
  }

  const summary =
    t(
      `Progress chart for ${project.name}: now ${Math.round(f.progress)}%` +
        (f.eta ? `, forecast finish ${t.dayMonth(f.eta)}` : "") +
        `, target ${t.dayMonth(project.targetDate)}`,
      `Graph ความคืบหน้าของ ${project.name}: ตอนนี้ ${Math.round(f.progress)}%` +
        (f.eta ? `, คาดว่าเสร็จ ${t.dayMonth(f.eta)}` : "") +
        `, เป้าหมาย ${t.dayMonth(project.targetDate)}`,
    );

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={summary}>
        <defs>
          <clipPath id="plot">
            <rect x={PAD.left} y={PAD.top - 6} width={innerW} height={innerH + 12} />
          </clipPath>
        </defs>

        {[0, 25, 50, 75, 100].map((p) => (
          <g key={p}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(p)} y2={y(p)} stroke="var(--line-soft)" />
            <text x={PAD.left - 8} y={y(p) + 4} textAnchor="end" fontSize="12" fill="var(--faint)">
              {p}%
            </text>
          </g>
        ))}
        {ticks.map((d) => (
          <text key={d} x={x(d)} y={H - 12} textAnchor="middle" fontSize="12" fill="var(--faint)">
            {t.dayMonth(d)}
          </text>
        ))}

        <g clipPath="url(#plot)">
          {band && <polygon points={band} fill={project.color} opacity="0.1" />}

          {/* Weekends shaded when they don't count */}
          {project.skipWeekends && span <= 180 &&
            weekendSundays(start, end).map((d) => (
              <rect key={d} x={x(d) - innerW / span} y={PAD.top} width={(2 * innerW) / span} height={innerH} fill="var(--text)" opacity="0.04" />
            ))}

          {/* Plan: straight line from start to target (flat over weekends when they don't count) */}
          <polyline
            points={planPoints(project).map((pt) => `${x(pt.date)},${y(pt.progress)}`).join(" ")}
            fill="none"
            stroke="var(--faint)"
            strokeWidth="1.5"
            strokeDasharray="2 4"
          />

          {/* Forecast */}
          {active && f.eta && (
            <line
              x1={todayX}
              y1={curY}
              x2={x(f.eta)}
              y2={y(100)}
              stroke={project.color}
              strokeWidth="2"
              strokeDasharray="6 5"
            />
          )}

          <polyline points={actual} fill="none" stroke={project.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {f.series.slice(1).map((p) => (
            <circle key={p.date} cx={x(p.date)} cy={y(p.progress)} r="3" fill="var(--surface)" stroke={project.color} strokeWidth="2">
              <title>{`${t.dayMonth(p.date)}: ${Math.round(p.progress)}%`}</title>
            </circle>
          ))}
        </g>

        <Marker x={x(project.targetDate)} label={t("Target", "เป้าหมาย")} color="var(--text)" top={PAD.top} bottom={H - PAD.bottom} />
        {today < end && today > start && (
          <Marker x={todayX} label={t("Today", "วันนี้")} color="var(--muted)" top={PAD.top} bottom={H - PAD.bottom} dashed />
        )}
        {active && f.eta && f.eta <= end && (
          <g>
            <circle cx={x(f.eta)} cy={y(100)} r="5" fill={project.color} />
            <text x={x(f.eta)} y={y(100) + 18} textAnchor="middle" fontSize="12" fontWeight="600" fill={project.color}>
              {t("Forecast", "คาดเสร็จ")}
            </text>
          </g>
        )}
      </svg>
      <figcaption className="mt-2.5 flex flex-wrap gap-x-[18px] gap-y-1 text-xs text-muted">
        <Legend swatch={<span className="h-0.5 w-5 rounded" style={{ background: project.color }} />}>{t("Actual progress", "ความคืบหน้าจริง")}</Legend>
        <Legend swatch={<span className="w-5 border-t-2 border-dotted border-faint" />}>{t("Plan (straight line from start to target)", "แผน (เส้นตรงจากวันเริ่มถึงเป้าหมาย)")}</Legend>
        {active && (
          <>
            <Legend swatch={<span className="w-5 border-t-2 border-dashed" style={{ borderColor: project.color }} />}>{t("Forecast", "คาดการณ์")}</Legend>
            <Legend swatch={<span className="h-2.5 w-5 rounded-sm opacity-25" style={{ background: project.color }} />}>{t("Likely finish window", "ช่วงที่น่าจะเสร็จ")}</Legend>
          </>
        )}
      </figcaption>
    </figure>
  );
}

function Marker({ x, label, color, top, bottom, dashed }: {
  x: number; label: string; color: string; top: number; bottom: number; dashed?: boolean;
}) {
  return (
    <g>
      <line x1={x} x2={x} y1={top - 4} y2={bottom} stroke={color} strokeWidth="1" strokeDasharray={dashed ? "3 3" : undefined} opacity="0.7" />
      <text x={x} y={top - 10} textAnchor="middle" fontSize="12" fill={color}>{label}</text>
    </g>
  );
}

function Legend({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {swatch}
      {children}
    </span>
  );
}

function planPoints(project: Project): { date: ISODate; progress: number }[] {
  const days = daysBetween(project.startDate, project.targetDate);
  if (!project.skipWeekends || days > 400) {
    return [
      { date: project.startDate, progress: 0 },
      { date: project.targetDate, progress: 100 },
    ];
  }
  const out = [];
  for (let i = 0; i <= days; i++) {
    const date = addDays(project.startDate, i);
    out.push({ date, progress: plannedProgressAt(project, date) });
  }
  return out;
}

/** Each Sunday in range; the shaded band spans the Saturday before it through Sunday. */
function weekendSundays(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (new Date(`${d}T00:00:00Z`).getUTCDay() === 0) out.push(d);
  }
  return out;
}

function buildTicks(start: ISODate, end: ISODate, count: number): ISODate[] {
  const span = daysBetween(start, end);
  const step = Math.max(1, Math.round(span / count));
  const out: ISODate[] = [];
  for (let i = 0; i <= span - step / 2; i += step) out.push(addDays(start, i));
  return out;
}
