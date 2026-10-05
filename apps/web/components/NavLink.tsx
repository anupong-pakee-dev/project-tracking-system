"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`btn btn-ghost ${active ? "bg-surface-2 font-semibold text-text" : "text-muted hover:text-text"}`}
    >
      {children}
    </Link>
  );
}
