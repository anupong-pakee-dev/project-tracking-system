import Link from "next/link";

export function Logo({ withText = true }: { withText?: boolean }) {
  return (
    <Link href="/" aria-label={withText ? undefined : "Project Tracker — Home"} className="flex items-center gap-2.5 font-semibold">
      <span aria-hidden className="grid size-[30px] place-items-center rounded-[9px] bg-accent text-accent-fg">
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {withText && <span>Project Tracker</span>}
    </Link>
  );
}
