import { pick, type Lang } from "./i18n.ts";
import type { ISODate } from "./types.ts";

const DAY_MS = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string" || !ISO_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const DEFAULT_TIME_ZONE = "Asia/Bangkok";

/**
 * The time zone that decides what "today" is. Servers (e.g. Vercel) run on UTC, so this must not
 * come from the server clock. Override with the APP_TIMEZONE environment variable.
 */
export function appTimeZone(): string {
  return (typeof process !== "undefined" && process.env?.APP_TIMEZONE) || DEFAULT_TIME_ZONE;
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** Today's date (`YYYY-MM-DD`) in the app's time zone. */
export function todayISO(now: Date = new Date(), timeZone: string = appTimeZone()): ISODate {
  let fmt = dayFormatters.get(timeZone);
  if (!fmt) {
    // en-CA formats as YYYY-MM-DD.
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormatters.set(timeZone, fmt);
  }
  return fmt.format(now);
}

function toUTC(date: ISODate): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/** Whole days from `a` to `b` (negative if `b` is before `a`). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

export function addDays(date: ISODate, days: number): ISODate {
  return new Date(toUTC(date) + Math.round(days) * DAY_MS).toISOString().slice(0, 10);
}

/** Saturday or Sunday. */
export function isWeekend(date: ISODate): boolean {
  const dow = new Date(toUTC(date)).getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * Counts working days (Mon–Fri) in the half-open range (a, b] — the same convention as
 * daysBetween, so a → next Monday is 1. Negative if `b` is before `a`.
 */
export function workdaysBetween(a: ISODate, b: ISODate): number {
  if (b < a) return -workdaysBetween(b, a);
  const total = daysBetween(a, b);
  const fullWeeks = Math.floor(total / 7);
  let count = fullWeeks * 5;
  let d = addDays(a, fullWeeks * 7);
  for (let i = fullWeeks * 7; i < total; i++) {
    d = addDays(d, 1);
    if (!isWeekend(d)) count++;
  }
  return count;
}

/** Moves forward `n` working days (n ≥ 0). Landing on a weekend start rolls to Monday. */
export function addWorkdays(date: ISODate, n: number): ISODate {
  let d = date;
  let left = Math.round(n);
  if (left <= 0) {
    while (isWeekend(d)) d = addDays(d, 1);
    return d;
  }
  const weeks = Math.floor((left - 1) / 5);
  d = addDays(d, weeks * 7);
  left -= weeks * 5;
  while (left > 0) {
    d = addDays(d, 1);
    if (!isWeekend(d)) left--;
  }
  return d;
}

export type DayUnit = "day" | "workday";

export interface Calendar {
  skipWeekends: boolean;
  between(a: ISODate, b: ISODate): number;
  add(date: ISODate, n: number): ISODate;
  /** Calendar days or Mon–Fri working days. */
  unit: DayUnit;
}

export function calendarFor(skipWeekends: boolean): Calendar {
  return skipWeekends
    ? { skipWeekends, between: workdaysBetween, add: addWorkdays, unit: "workday" }
    : { skipWeekends, between: daysBetween, add: addDays, unit: "day" };
}

export function maxDate(...dates: ISODate[]): ISODate {
  return dates.reduce((a, b) => (a > b ? a : b));
}

export function minDate(...dates: ISODate[]): ISODate {
  return dates.reduce((a, b) => (a < b ? a : b));
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function fmt(lang: Lang, withYear: boolean): Intl.DateTimeFormat {
  const locale = lang === "th" ? "th-TH" : "en-GB";
  const key = `${locale}:${withYear}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "2-digit" } : {}),
      timeZone: "UTC",
    });
    formatters.set(key, f);
  }
  return f;
}

/** e.g. "2 ต.ค. 69" (th) · "2 Oct 26" (en) */
export function formatDate(date: ISODate, lang: Lang = "th"): string {
  return fmt(lang, true).format(new Date(toUTC(date)));
}

/** e.g. "2 ต.ค." (th) · "2 Oct" (en) */
export function formatDayMonth(date: ISODate, lang: Lang = "th"): string {
  return fmt(lang, false).format(new Date(toUTC(date)));
}

/** Human-friendly relative wording: "today" / "วันนี้", "in 3 days" / "อีก 3 วัน", "5 days ago" / "5 วันที่แล้ว". */
export function relativeDays(from: ISODate, to: ISODate, lang: Lang = "th"): string {
  const diff = daysBetween(from, to);
  if (diff === 0) return pick(lang, "today", "วันนี้");
  if (diff === 1) return pick(lang, "tomorrow", "พรุ่งนี้");
  if (diff === -1) return pick(lang, "yesterday", "เมื่อวาน");
  return diff > 0 ? pick(lang, `in ${diff} days`, `อีก ${diff} วัน`) : pick(lang, `${-diff} days ago`, `${-diff} วันที่แล้ว`);
}

/** "day" / "วัน" or "workday" / "วันทำงาน", pluralised for English. */
export function unitLabel(unit: DayUnit, lang: Lang, count = 2): string {
  const en = unit === "workday" ? "workday" : "day";
  return pick(lang, Math.abs(count) === 1 ? en : `${en}s`, unit === "workday" ? "วันทำงาน" : "วัน");
}
