import "server-only";
import { LANG_COOKIE, toLang, type Lang } from "@tracker/shared/i18n";
import { cookies } from "next/headers";
import { makeT, type T } from "./i18n";

/** The visitor's language from the `lang` cookie; Thai when unset. */
export async function getLang(): Promise<Lang> {
  return toLang((await cookies()).get(LANG_COOKIE)?.value);
}

/** Translator for server components, route handlers and server actions. */
export async function getT(): Promise<T> {
  return makeT(await getLang());
}
