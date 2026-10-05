"use client";

import { useEffect, useRef, useState } from "react";
import { logout } from "@/lib/auth-actions";
import { useT } from "./LangProvider";
import { LangSwitcher } from "./LangSwitcher";

export function UserMenu({ email }: { email: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="grid size-9 place-items-center rounded-full border border-line bg-surface-2 text-sm font-semibold uppercase hover:bg-line"
        title={email}
      >
        {email[0]}
        <span className="sr-only">{t("Account menu", "Menu บัญชี")}</span>
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 z-30 mt-2 w-60 p-1.5 shadow-[0_8px_24px_rgb(20_24_32/0.1)]">
          <div className="truncate px-2.5 py-2 text-xs text-muted">{email}</div>
          <div className="px-2.5 pt-1 pb-2">
            <div className="mb-1.5 text-xs text-muted">{t("Language", "ภาษา")}</div>
            <LangSwitcher className="w-full [&>button]:flex-1" />
          </div>
          <div className="my-1 h-px bg-line-soft" />
          <form action={logout}>
            <button type="submit" role="menuitem" className="h-11 w-full rounded-lg px-2.5 text-left text-sm hover:bg-surface-2 sm:h-auto sm:py-2">
              {t("Sign out", "ออกจากระบบ")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
