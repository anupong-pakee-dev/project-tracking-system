"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Phones only: Overview · (+ new project) · Data. Project pages use their own sticky action bar instead. */
export function MobileTabBar({ labels }: { labels: { overview: string; data: string; newProject: string } }) {
  const path = usePathname();
  if (path.startsWith("/projects")) return null;

  const tab = (href: string, label: string, active: boolean, icon: React.ReactNode) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-[58px] flex-col items-center justify-center gap-[3px] text-[11px] hover:no-underline ${
        active ? "font-semibold text-accent" : "text-muted"
      }`}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line-soft bg-nav/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
    >
      <div className="grid grid-cols-[1fr_76px_1fr]">
        {tab("/", labels.overview, path === "/", <GridIcon />)}
        <div className="flex justify-center">
          <Link
            href="/projects/new"
            aria-label={labels.newProject}
            title={labels.newProject}
            className="-mt-[22px] grid size-[58px] place-items-center rounded-full border-4 border-bg bg-accent text-[26px] leading-none text-accent-fg shadow-[0_6px_16px_rgb(0_0_0/0.18)] hover:no-underline"
          >
            +
          </Link>
        </div>
        {tab("/data", labels.data, path.startsWith("/data"), <ListIcon />)}
      </div>
    </nav>
  );
}

function GridIcon() {
  return (
    <span aria-hidden className="grid grid-cols-2 gap-[3px] p-[3px]">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="size-2 rounded-[2px] bg-current" />
      ))}
    </span>
  );
}

function ListIcon() {
  return (
    <span aria-hidden className="flex w-[18px] flex-col gap-[3px] py-[3px]">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1 rounded-[2px] bg-current" />
      ))}
    </span>
  );
}
