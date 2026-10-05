"use client";

import { useEffect, useState } from "react";
import { useT } from "./LangProvider";

/** Close the panel from anywhere (e.g. after a successful save). */
export function closeUpdatePanel() {
  if (window.location.hash === "#update") {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/**
 * The "Update progress" flow. Opens whenever the URL hash is #update, so every existing
 * `href="#update"` / `/projects/:id#update` link keeps working.
 * Phones: full screen. sm and up: a centred dialog.
 */
export function UpdatePanel({ title, subtitle, color, children }: {
  title: string;
  subtitle: string;
  color: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setOpen(window.location.hash === "#update");
    // Next's <Link href="#update"> updates the URL later, with history.pushState, which fires no
    // "hashchange" — so open as soon as such a link on this page is clicked, and re-check on
    // back/forward (popstate).
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a");
      if (link && link.hash === "#update" && link.pathname === window.location.pathname) setOpen(true);
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
      document.removeEventListener("click", onClick);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeUpdatePanel();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label={t("Close", "ปิด")}
        onClick={closeUpdatePanel}
        className="absolute inset-0 hidden cursor-default bg-black/35 sm:block"
      />
      <div className="fade-in absolute inset-0 flex flex-col overflow-hidden bg-bg sm:inset-auto sm:top-12 sm:left-1/2 sm:max-h-[calc(100dvh-96px)] sm:w-[600px] sm:-translate-x-1/2 sm:rounded-[18px] sm:shadow-[0_24px_64px_rgb(0_0_0/0.25)]">
        <div className="flex shrink-0 items-center gap-2 border-b border-line-soft bg-nav px-2 pt-[env(safe-area-inset-top)] sm:bg-surface sm:px-5 sm:pt-0">
          <span aria-hidden className="ml-2 size-2.5 shrink-0 rounded-full sm:ml-0" style={{ background: color }} />
          <div className="min-w-0 flex-1 py-2.5">
            <p className="text-[15px] leading-tight font-semibold sm:text-[17px]">{title}</p>
            <p className="truncate text-xs text-muted">{subtitle}</p>
          </div>
          <button type="button" onClick={closeUpdatePanel} className="btn btn-ghost size-11 px-0 text-lg text-muted" aria-label={t("Close", "ปิด")}>
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
