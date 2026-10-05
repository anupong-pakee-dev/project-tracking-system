// Interface language. Thai is the default.

export type Lang = "th" | "en";

export const LANGS: readonly Lang[] = ["th", "en"];
export const DEFAULT_LANG: Lang = "th";

/** Cookie (apps/web) holding the chosen language. */
export const LANG_COOKIE = "lang";
/** Header apps/web sends so apps/api answers in the same language. */
export const LANG_HEADER = "x-lang";

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

export function toLang(value: unknown): Lang {
  return isLang(value) ? value : DEFAULT_LANG;
}

/** The text for `lang`. */
export function pick<V>(lang: Lang, en: V, th: V): V {
  return lang === "en" ? en : th;
}

// apps/api builds messages before it knows who will read them (e.g. zod schemas), so it packs
// both languages into one string and unpacks it when answering.
const SEP = "\u001f";

/** Both languages in one string — unpack with `localize`. */
export const bi = (en: string, th: string): string => `${en}${SEP}${th}`;

/** Unpacks a `bi()` string for `lang`; plain strings pass through. */
export function localize(message: string, lang: Lang): string {
  const i = message.indexOf(SEP);
  return i < 0 ? message : pick(lang, message.slice(0, i), message.slice(i + SEP.length));
}
