"use client";

import type { T } from "@/lib/i18n";

// Shared pieces for the backup / restore cards on /data.

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" className={`animate-spin motion-reduce:animate-none ${className}`}>
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function SuccessTick({ className = "size-10" }: { className?: string }) {
  return (
    <span aria-hidden className={`tick-pop grid shrink-0 place-items-center rounded-full bg-ok-soft text-ok ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" className="size-1/2">
        <path className="tick-draw" d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function IndeterminateBar() {
  return <div aria-hidden className="bar-indeterminate h-1.5 w-full rounded-full bg-surface-2" />;
}

export interface BackupCounts {
  projects: number;
  tasks: number;
  logs: number;
}

/** Counts in a backup file, or null when it isn't shaped like one. */
export function countBackup(json: unknown): BackupCounts | null {
  const b = json as Partial<Record<keyof BackupCounts, unknown>> | null;
  if (!b || !Array.isArray(b.projects) || !Array.isArray(b.tasks) || !Array.isArray(b.logs)) return null;
  return { projects: b.projects.length, tasks: b.tasks.length, logs: b.logs.length };
}

export const describeCounts = (c: BackupCounts, t: T) =>
  t(
    `${c.projects} projects · ${c.tasks} tasks · ${c.logs} history entries`,
    `${c.projects} Project · ${c.tasks} งาน · ${c.logs} ประวัติ`,
  );

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** Keeps a spinner up long enough to be read instead of flashing. */
export const atLeast = <T,>(ms: number, work: Promise<T>) =>
  Promise.all([work, new Promise((r) => setTimeout(r, ms))]).then(([v]) => v);

function filenameFrom(res: Response): string {
  const match = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/);
  return match?.[1] ?? "project-tracker-backup.json";
}

export interface SavedBackup {
  filename: string;
  counts: BackupCounts | null;
  size: number;
}

/**
 * Downloads the signed-in user's data from /api/export as a file. Returns null when the session
 * has expired (the page is already heading to /login); throws an Error with a user-facing message.
 */
export async function saveBackup(t: T): Promise<SavedBackup | null> {
  let res: Response;
  try {
    res = await atLeast(600, fetch("/api/export", { cache: "no-store" }));
  } catch {
    throw new Error(t("Couldn't connect — check your internet and try again", "เชื่อมต่อไม่ได้ ตรวจ Internet แล้วลองใหม่"));
  }
  // An expired session makes the route redirect to /login — follow it instead of saving that page.
  if (res.redirected) {
    window.location.assign(res.url);
    return null;
  }
  if (!res.ok) throw new Error((await res.text()) || t("Download failed", "Download ไม่สำเร็จ"));

  const blob = await res.blob();
  const filename = filenameFrom(res);
  let counts: BackupCounts | null = null;
  try {
    counts = countBackup(JSON.parse(await blob.text()));
  } catch {
    // Still a download — just without the summary.
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { filename, counts, size: blob.size };
}
