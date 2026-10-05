// Translation helper shared by server and client components. Strings live at the call site as
// t("English", "ไทย") — no key catalog to fall out of sync.
import { formatDate, formatDayMonth, relativeDays, unitLabel, type DayUnit } from "@tracker/shared/dates";
import { pick, type Lang } from "@tracker/shared/i18n";

export interface T {
  /** The English or Thai version of a string or JSX fragment. */
  <V>(en: V, th: V): V;
  lang: Lang;
  date(iso: string): string;
  dayMonth(iso: string): string;
  /** "in 3 days" / "อีก 3 วัน" … */
  rel(from: string, to: string): string;
  /** "days" / "วัน", "workdays" / "วันทำงาน". */
  unit(unit: DayUnit, count?: number): string;
}

export function makeT(lang: Lang): T {
  const t = (<V,>(en: V, th: V) => pick(lang, en, th)) as T;
  t.lang = lang;
  t.date = (iso) => formatDate(iso, lang);
  t.dayMonth = (iso) => formatDayMonth(iso, lang);
  t.rel = (from, to) => relativeDays(from, to, lang);
  t.unit = (unit, count) => unitLabel(unit, lang, count);
  return t;
}
