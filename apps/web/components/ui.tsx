import type { DayUnit } from "@tracker/shared/dates";
import type { Lang } from "@tracker/shared/i18n";
import { HEALTH_LABEL, type Forecast, type Health } from "@tracker/shared/forecast";
import type { T } from "@/lib/i18n";

export const HEALTH_STYLE: Record<Health, { badge: string; color: string }> = {
  done: { badge: "bg-info-soft text-info", color: "var(--info)" },
  paused: { badge: "bg-idle-soft text-idle", color: "var(--idle)" },
  "not-started": { badge: "bg-idle-soft text-idle", color: "var(--idle)" },
  "no-data": { badge: "bg-idle-soft text-idle", color: "var(--idle)" },
  "on-track": { badge: "bg-ok-soft text-ok", color: "var(--ok)" },
  "at-risk": { badge: "bg-warn-soft text-warn", color: "var(--warn)" },
  late: { badge: "bg-bad-soft text-bad", color: "var(--bad)" },
};

export function HealthBadge({ health, t }: { health: Health; t: T }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${HEALTH_STYLE[health].badge}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {t(HEALTH_LABEL[health].en, HEALTH_LABEL[health].th)}
    </span>
  );
}

export function ProgressBar({
  progress,
  planned,
  color,
  size = "md",
  label,
  plannedTitle,
}: {
  progress: number;
  planned?: number;
  color: string;
  size?: "sm" | "md";
  /** Accessible name, e.g. the project's name. */
  label: string;
  /** Tooltip on the planned-progress marker. */
  plannedTitle?: string;
}) {
  return (
    <div
      className={`relative w-full rounded-full bg-surface-2 ${size === "sm" ? "h-1" : "h-1.5"}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${progress}%`, background: color }}
      />
      {planned !== undefined && planned > 0 && planned < 100 && (
        <div
          className="absolute -top-[3px] -bottom-[3px] w-0.5 rounded bg-text/40"
          style={{ left: `calc(${planned}% - 1px)` }}
          title={plannedTitle}
        />
      )}
    </div>
  );
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

/** e.g. "2.4%/day" · "2.4%/วัน" */
export function formatRate(rate: number | null, unit: DayUnit, lang: Lang): string {
  if (rate === null) return "—";
  const per = lang === "th" ? unitTh(unit) : unitEn(unit, 1);
  if (rate === 0) return `0%/${per}`;
  return `${rate < 1 ? rate.toFixed(2) : rate.toFixed(1)}%/${per}`;
}

/** Plain-language verdict about the forecast vs. the target date. */
export function slipText(f: Forecast, t: T): string {
  switch (f.health) {
    case "done":
      return t("Completed", "เสร็จเรียบร้อย");
    case "paused":
      return t("Paused — no finish date is forecast", "พักไว้ — ไม่คำนวณวันเสร็จ");
    case "not-started":
      return t("Hasn't reached its start date yet", "ยังไม่ถึงวันเริ่ม");
    case "no-data":
      return t("Record progress at least once to start forecasting", "Update ความคืบหน้าอย่างน้อย 1 ครั้งเพื่อเริ่มคาดการณ์");
  }
  if (f.rate === null) {
    const n = -f.daysLeft;
    return t(`${n} ${unitEn(f.unit, n)} past the target with no progress yet`, `เลยกำหนดแล้ว ${n} ${unitTh(f.unit)} และยังไม่มีความคืบหน้า`);
  }
  if (f.eta === null) return t("Pace is zero — can't forecast until there's progress", "ความเร็วเป็นศูนย์ — คาดการณ์ไม่ได้จนกว่าจะมีความคืบหน้า");
  const s = f.slipDays ?? 0;
  if (s < 0) return t(`${-s} ${unitEn(f.unit, -s)} ahead of target`, `เร็วกว่าเป้า ${-s} ${unitTh(f.unit)}`);
  if (s === 0) return t("Right on the target date", "ตรงกับวันเป้าหมายพอดี");
  return t(`${s} ${unitEn(f.unit, s)} behind target`, `ช้ากว่าเป้า ${s} ${unitTh(f.unit)}`);
}

const unitEn = (unit: DayUnit, n: number) => (unit === "workday" ? "workday" : "day") + (Math.abs(n) === 1 ? "" : "s");
const unitTh = (unit: DayUnit) => (unit === "workday" ? "วันทำงาน" : "วัน");

export function varianceText(v: number, t: T): string {
  const r = Math.round(v);
  if (r === 0) return t("On plan", "ตรงแผน");
  return r > 0 ? t(`${r}% ahead of plan`, `นำแผน ${r}%`) : t(`${-r}% behind plan`, `ตามหลังแผน ${-r}%`);
}

/** One card split into cells — calmer than a row of separate boxes. */
export function StatGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <section
      aria-label={label}
      className="card grid grid-cols-2 overflow-hidden lg:grid-cols-4 [&>*]:border-line-soft max-lg:[&>*:nth-child(even)]:border-l max-lg:[&>*:nth-child(n+3)]:border-t lg:[&>*+*]:border-l"
    >
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
  dot,
  large,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: string;
  /** Show a coloured dot before the label (dashboard counts). */
  dot?: string;
  large?: boolean;
}) {
  return (
    <div className="min-w-0 px-[22px] py-[18px]">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        {dot && <span aria-hidden className="size-2 rounded-full" style={{ background: dot }} />}
        {label}
      </div>
      <div
        className={`mt-1 font-semibold tabular-nums leading-snug ${large ? "text-[30px]" : "text-[22px]"}`}
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
