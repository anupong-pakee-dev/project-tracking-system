"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LANG, type Lang } from "@tracker/shared/i18n";
import { makeT, type T } from "@/lib/i18n";

const LangContext = createContext<Lang>(DEFAULT_LANG);

/** Set once in the root layout from the `lang` cookie. */
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext value={lang}>{children}</LangContext>;
}

/** Translator for client components (server components use getT()). */
export function useT(): T {
  const lang = useContext(LangContext);
  return useMemo(() => makeT(lang), [lang]);
}
