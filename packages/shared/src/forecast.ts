import { addDays, calendarFor, daysBetween, type Calendar, type DayUnit } from "./dates.ts";
import type { ISODate, Project, ProgressLog, Task } from "./types.ts";

/** How far back "recent pace" looks. */
export const RECENT_WINDOW_DAYS = 14;
/** No update for this many days marks the project as stale. */
export const STALE_AFTER_DAYS = 7;
/** Beyond this the forecast is considered meaningless. */
const MAX_FORECAST_DAYS = 3650;

export type Health =
  | "done"
  | "paused"
  | "not-started"
  | "no-data"
  | "on-track"
  | "at-risk"
  | "late";

export interface SeriesPoint {
  date: ISODate;
  progress: number;
}

export interface Forecast {
  progress: number;
  /** Where progress "should" be today on a straight line from start to target. */
  plannedProgress: number;
  /** progress − plannedProgress, in percentage points. */
  scheduleVariance: number;
  /** Blended pace in percentage points per day; null if not enough data. */
  rate: number | null;
  overallRate: number | null;
  recentRate: number | null;
  /** Pace needed from today to finish exactly on the target date. */
  requiredRate: number | null;
  eta: ISODate | null;
  etaOptimistic: ISODate | null;
  /** null when the slow end of the range never finishes (pace ≈ 0). */
  etaPessimistic: ISODate | null;
  /** eta − targetDate in days. Positive = late. */
  slipDays: number | null;
  /** Slip tolerated before a project is "late" instead of "at risk". */
  toleranceDays: number;
  /** Days left until the target, in `unit`. */
  daysLeft: number;
  /** The unit of rates, slip, tolerance and daysLeft. */
  unit: DayUnit;
  health: Health;
  lastUpdate: ISODate | null;
  staleDays: number | null;
  isStale: boolean;
  series: SeriesPoint[];
}

export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** Overall progress: effort-weighted task progress, or the manual value if there are no tasks. */
export function computeProgress(project: Project, tasks: Task[]): number {
  if (tasks.length === 0) return clampPct(project.manualProgress);
  const totalWeight = tasks.reduce((s, t) => s + Math.max(0, t.weight), 0);
  if (totalWeight <= 0) {
    return clampPct(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length);
  }
  const done = tasks.reduce((s, t) => s + Math.max(0, t.weight) * clampPct(t.progress), 0);
  return clampPct(done / totalWeight);
}

/**
 * Turns logs into a time series of progress, anchored at 0% on the start date and
 * ending at today's actual progress. When several logs share a date the latest wins.
 */
export function buildSeries(
  project: Project,
  logs: ProgressLog[],
  currentProgress: number,
  today: ISODate,
): SeriesPoint[] {
  const byDate = new Map<ISODate, ProgressLog>();
  for (const log of [...logs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (log.date > today) continue;
    byDate.set(log.date, log);
  }
  const points: SeriesPoint[] = [...byDate.values()]
    .map((l) => ({ date: l.date, progress: clampPct(l.progress) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (points.length === 0 || points[0].date > project.startDate) {
    points.unshift({ date: project.startDate, progress: 0 });
  }
  const last = points[points.length - 1];
  if (today >= points[0].date) {
    if (last.date === today) last.progress = currentProgress;
    else points.push({ date: today, progress: currentProgress });
  }
  return points;
}

/** Linear interpolation of progress at `date`. */
export function progressAt(series: SeriesPoint[], date: ISODate): number {
  if (series.length === 0) return 0;
  if (date <= series[0].date) return series[0].progress;
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1];
    const b = series[i];
    if (date <= b.date) {
      const span = daysBetween(a.date, b.date);
      if (span <= 0) return b.progress;
      return a.progress + ((b.progress - a.progress) * daysBetween(a.date, date)) / span;
    }
  }
  return series[series.length - 1].progress;
}

function etaFromRate(cal: Calendar, today: ISODate, remaining: number, rate: number | null): ISODate | null {
  if (remaining <= 0) return today;
  if (rate === null || rate <= 0) return null;
  const days = Math.ceil(remaining / rate);
  return days > MAX_FORECAST_DAYS ? null : cal.add(today, days);
}

/** Where progress should be on `date`, on a straight line from start to target (in the project's day units). */
export function plannedProgressAt(project: Project, date: ISODate): number {
  const cal = calendarFor(project.skipWeekends);
  const duration = Math.max(1, cal.between(project.startDate, project.targetDate));
  return clampPct((cal.between(project.startDate, date) / duration) * 100);
}

export function forecastProject(
  project: Project,
  tasks: Task[],
  logs: ProgressLog[],
  today: ISODate,
): Forecast {
  // All durations and rates below are in the project's unit: calendar days or working days.
  const cal = calendarFor(project.skipWeekends);
  const progress = computeProgress(project, tasks);
  const series = buildSeries(project, logs, progress, today);
  const remaining = 100 - progress;

  const plannedDuration = Math.max(1, cal.between(project.startDate, project.targetDate));
  const elapsed = cal.between(project.startDate, today);
  const plannedProgress = clampPct((elapsed / plannedDuration) * 100);
  const daysLeft = cal.between(today, project.targetDate);
  const toleranceDays = Math.max(3, Math.ceil(plannedDuration * 0.1));

  const realLogs = logs.filter((l) => l.date <= today);
  const lastUpdate = realLogs.length
    ? realLogs.reduce((a, b) => (a.date > b.date ? a : b)).date
    : null;
  const staleDays = lastUpdate ? daysBetween(lastUpdate, today) : null;

  // Pace since the first data point, and over the recent window.
  const origin = series[0].date;
  const span = cal.between(origin, today);
  let overallRate: number | null = null;
  let recentRate: number | null = null;
  if (span >= 1 && progress > 0) {
    overallRate = (progress - series[0].progress) / span;
    if (daysBetween(origin, today) > RECENT_WINDOW_DAYS) {
      const from = addDays(today, -RECENT_WINDOW_DAYS);
      const windowDays = Math.max(1, cal.between(from, today));
      recentRate = (progress - progressAt(series, from)) / windowDays;
    }
  }

  // Blend: recent pace reacts to speed-ups and slow-downs, overall pace keeps it stable.
  let rate: number | null = null;
  if (overallRate !== null) {
    rate = recentRate !== null ? 0.5 * recentRate + 0.5 * overallRate : overallRate;
    if (rate <= 0) rate = 0;
  }

  let eta: ISODate | null = null;
  let etaOptimistic: ISODate | null = null;
  let etaPessimistic: ISODate | null = null;
  if (remaining <= 0) {
    eta = etaOptimistic = etaPessimistic = project.completedAt ?? lastUpdate ?? today;
  } else if (rate !== null) {
    const candidates = [rate, overallRate ?? rate, recentRate ?? rate];
    const fast = Math.max(...candidates, rate * 1.2);
    const slow = Math.min(...candidates, rate * 0.8);
    eta = etaFromRate(cal, today, remaining, rate);
    etaOptimistic = etaFromRate(cal, today, remaining, fast);
    etaPessimistic = etaFromRate(cal, today, remaining, slow);
  }

  const slipDays = eta ? cal.between(project.targetDate, eta) : null;
  const requiredRate = remaining > 0 && daysLeft > 0 ? remaining / daysLeft : null;

  let health: Health;
  if (project.status === "done" || progress >= 100) health = "done";
  else if (project.status === "paused") health = "paused";
  else if (today < project.startDate) health = "not-started";
  else if (daysLeft < 0) health = "late";
  else if (rate === null) health = "no-data";
  else if (eta === null) health = "late"; // pace has stalled
  else if (slipDays! <= 0) health = "on-track";
  else if (slipDays! <= toleranceDays) health = "at-risk";
  else health = "late";

  const active = health !== "done" && health !== "paused" && health !== "not-started";

  return {
    progress,
    plannedProgress,
    scheduleVariance: progress - plannedProgress,
    rate,
    overallRate,
    recentRate,
    requiredRate,
    eta,
    etaOptimistic,
    etaPessimistic,
    slipDays,
    toleranceDays,
    daysLeft,
    health,
    lastUpdate,
    staleDays,
    isStale:
      active &&
      (staleDays === null
        ? daysBetween(project.startDate, today) >= STALE_AFTER_DAYS
        : staleDays >= STALE_AFTER_DAYS),
    unit: cal.unit,
    series,
  };
}

export const HEALTH_LABEL: Record<Health, { en: string; th: string }> = {
  done: { en: "Done", th: "เสร็จแล้ว" },
  paused: { en: "Paused", th: "พักไว้" },
  "not-started": { en: "Not started", th: "ยังไม่เริ่ม" },
  "no-data": { en: "Not enough data", th: "ข้อมูลยังไม่พอ" },
  "on-track": { en: "On track", th: "ตามแผน" },
  "at-risk": { en: "At risk", th: "เสี่ยงล่าช้า" },
  late: { en: "Late", th: "ล่าช้า" },
};

/** Order used to surface the projects that need attention first. */
export const HEALTH_PRIORITY: Record<Health, number> = {
  late: 0,
  "at-risk": 1,
  "no-data": 2,
  "on-track": 3,
  "not-started": 4,
  paused: 5,
  done: 6,
};
