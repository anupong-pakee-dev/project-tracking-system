"use client";

import { useTransition } from "react";
import { LANGS, type Lang } from "@tracker/shared/i18n";
import { setLanguage } from "@/lib/lang-actions";
import { useT } from "./LangProvider";

const LABEL: Record<Lang, string> = { th: "TH", en: "EN" };

/** Segmented control: Thai · English. */
export function LangSwitcher({ className = "" }: { className?: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <div
      role="radiogroup"
      aria-label={t("Language", "ภาษา")}
      className={`inline-flex rounded-[9px] border border-line bg-surface-2 p-0.5 text-xs font-semibold ${pending ? "opacity-60" : ""} ${className}`}
    >
      {LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          role="radio"
          aria-checked={t.lang === lang}
          disabled={pending}
          onClick={() => start(() => setLanguage(lang))}
          className={`rounded-[7px] px-2.5 py-1 whitespace-nowrap transition-colors ${
            t.lang === lang ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
          }`}
        >
          {LABEL[lang]}
        </button>
      ))}
    </div>
  );
}
