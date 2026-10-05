"use server";

import { LANG_COOKIE, isLang } from "@tracker/shared/i18n";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function setLanguage(lang: string): Promise<void> {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
