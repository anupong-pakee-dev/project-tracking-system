"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { importBackup } from "@/lib/actions";
import { FormMessage } from "./ActionButton";
import { useConfirm } from "./ConfirmDialog";
import { useT } from "./LangProvider";
import type { T } from "@/lib/i18n";
import {
  countBackup,
  describeCounts,
  formatBytes,
  saveBackup,
  IndeterminateBar,
  Spinner,
  SuccessTick,
  type BackupCounts,
} from "./DataTransferUI";
import { useFormAction } from "./useFormAction";

const MAX_BYTES = 3.5 * 1024 * 1024; // same limit as importBackup

interface Picked {
  file: File;
  counts: BackupCounts;
}

/** Reads and sanity-checks the file in the browser, so mistakes show before anything is uploaded. */
async function inspect(file: File, t: T): Promise<Picked | string> {
  if (!/\.json$/i.test(file.name) && file.type !== "application/json") return t("Please choose a .json file", "กรุณาเลือก File .json");
  if (file.size > MAX_BYTES) return t(`The file is larger than 3.5 MB (${formatBytes(file.size)})`, `File ใหญ่เกิน 3.5 MB (${formatBytes(file.size)})`);
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return t("This file isn't valid JSON", "File นี้ไม่ใช่ JSON ที่ถูกต้อง");
  }
  const counts = countBackup(json);
  return counts ? { file, counts } : t("This isn't a Project Tracker backup file", "File นี้ไม่ใช่ File สำรองของ Project Tracker");
}

function Step({ state, children }: { state: "done" | "active" | "todo"; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2.5 text-sm ${state === "todo" ? "text-faint" : "text-text"}`}>
      <span className="grid size-5 shrink-0 place-items-center">
        {state === "done" ? (
          <svg aria-hidden viewBox="0 0 24 24" className="size-4 text-ok" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : state === "active" ? (
          <Spinner className="size-4 text-accent" />
        ) : (
          <span aria-hidden className="size-2 rounded-full bg-line" />
        )}
      </span>
      {children}
    </li>
  );
}

/** `current`: what's in the account now — deleted by a restore (after a backup is downloaded). */
export function ImportForm({ current }: { current: BackupCounts }) {
  const t = useT();
  const { state, submit, pending } = useFormAction(importBackup);
  const [ask, dialog] = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [dragging, setDragging] = useState(false);
  // A server error belongs to the file it was about; hide it once another file is chosen.
  const [hideServerError, setHideServerError] = useState(false);
  // The savedAt of a success the user has already moved on from.
  const [dismissed, setDismissed] = useState<number | undefined>();

  // Leaving mid-restore can't cancel it, but warns the user it's still running.
  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  async function choose(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setPickError(null);
    setHideServerError(true);
    const result = await inspect(file, t);
    setReading(false);
    if (typeof result === "string") {
      setPicked(null);
      setPickError(result);
    } else {
      setPicked(result);
    }
  }

  function reset() {
    setPicked(null);
    setPickError(null);
    setHideServerError(true);
    setDismissed(state.savedAt);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function restore() {
    if (!picked) return;
    const hasData = current.projects > 0;
    const ok = await ask(
      hasData
        ? t(
            `Replace all your data with this file?\n\nDeleted now: ${describeCounts(current, t)}\nRestored from the file: ${describeCounts(picked.counts, t)}\n\nA backup of your current data will be downloaded first.`,
            `แทนที่ข้อมูลทั้งหมดด้วย File นี้?\n\nจะถูกลบ: ${describeCounts(current, t)}\nจะได้จาก File: ${describeCounts(picked.counts, t)}\n\nระบบจะ Download File สำรองของข้อมูลปัจจุบันให้ก่อนอัตโนมัติ`,
          )
        : t(
            `Restore this file? (${describeCounts(picked.counts, t)})`,
            `กู้คืนจาก File นี้? (${describeCounts(picked.counts, t)})`,
          ),
      { danger: hasData },
    );
    if (!ok) return;
    if (hasData) {
      setBackingUp(true);
      try {
        if (!(await saveBackup(t))) return; // session expired — already heading to /login
      } catch (err) {
        setPickError(
          t(
            `Nothing was replaced — couldn't back up your current data: ${(err as Error).message}`,
            `ยังไม่ได้แทนที่อะไร เพราะสำรองข้อมูลปัจจุบันไม่สำเร็จ: ${(err as Error).message}`,
          ),
        );
        return;
      } finally {
        setBackingUp(false);
      }
    }
    const fd = new FormData();
    fd.set("file", picked.file);
    setHideServerError(false);
    submit(fd);
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!pending) void choose(e.dataTransfer.files[0]);
  };

  // ---------- Restoring ----------
  if (pending && picked) {
    return (
      <div className="fade-in soft space-y-4 border border-line bg-surface-2/50 p-4" role="status" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{t("Restoring your data…", "กำลังกู้คืนข้อมูล…")}</p>
          <p className="text-xs text-muted">{t("Don't close this page", "อย่าปิดหน้านี้")}</p>
        </div>
        <IndeterminateBar />
        <ol className="space-y-2">
          <Step state="done">{t("Read", "อ่าน File")} {picked.file.name} — {describeCounts(picked.counts, t)}</Step>
          <Step state="active">{t("Upload, check and save to the database", "Upload ตรวจสอบ และบันทึกลงฐานข้อมูล")}</Step>
          <Step state="todo">{t("Refresh the screen", "Update หน้าจอ")}</Step>
        </ol>
      </div>
    );
  }

  // ---------- Done ----------
  if (state.message && state.savedAt !== dismissed) {
    return (
      <div className="fade-in soft flex flex-col items-center gap-3 bg-ok-soft/60 px-4 py-6 text-center" role="status" aria-live="polite">
        <SuccessTick className="size-12" />
        <div>
          <p className="font-semibold text-ok">{t("Data restored", "กู้คืนข้อมูลเรียบร้อย")}</p>
          <p className="text-sm text-muted">{state.message}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn btn-primary">{t("Go to projects", "ไปที่ Project")}</Link>
          <button type="button" className="btn" onClick={reset}>{t("Import another file", "นำเข้า File อื่น")}</button>
        </div>
      </div>
    );
  }

  // ---------- Pick a file ----------
  return (
    <>
      <div className="space-y-3">
        <input
          ref={inputRef}
          id="backup-file"
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => void choose(e.target.files?.[0])}
        />

        {picked ? (
          <div className="fade-in soft flex items-center gap-3 border border-line bg-surface-2/50 px-3.5 py-3">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">
              <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                <path d="M14 3v5h5M9.5 13.5 8 15l1.5 1.5M14.5 13.5 16 15l-1.5 1.5" />
              </svg>
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium">{picked.file.name}</p>
              <p className="text-muted">{describeCounts(picked.counts, t)} · {formatBytes(picked.file.size)}</p>
            </div>
            <button type="button" className="btn btn-ghost px-2.5 text-muted" onClick={reset}>{t("Change", "เปลี่ยน")}</button>
          </div>
        ) : (
          <label
            htmlFor="backup-file"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`soft flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed px-4 py-7 text-center transition-colors ${
              dragging ? "border-accent bg-accent-soft/60" : "border-line hover:border-accent/60 hover:bg-surface-2/60"
            }`}
          >
            {reading ? (
              <>
                <Spinner className="size-6 text-accent" />
                <span className="text-sm text-muted">{t("Reading file…", "กำลังอ่าน File…")}</span>
              </>
            ) : (
              <>
                <svg aria-hidden viewBox="0 0 24 24" fill="none" className="size-7 text-faint" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
                  <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                </svg>
                <span className="text-sm">
                  <span className="font-semibold text-accent">{t("Choose a backup file", "เลือก File สำรอง")}</span>{" "}
                  {t("or drop it here", "หรือลากมาวางที่นี่")}
                </span>
                <span className="text-xs text-faint">{t(".json file up to 3.5 MB", "File .json ไม่เกิน 3.5 MB")}</span>
              </>
            )}
          </label>
        )}

        <FormMessage error={pickError ?? (hideServerError ? undefined : state.error)} />

        {picked && (
          <button type="button" className="btn btn-danger w-full sm:w-auto" onClick={restore} disabled={backingUp}>
            {backingUp ? (
              <><Spinner /> {t("Backing up your current data…", "กำลังสำรองข้อมูลปัจจุบัน…")}</>
            ) : (
              t("Restore and replace all data", "กู้คืนและแทนที่ข้อมูลทั้งหมด")
            )}
          </button>
        )}
      </div>
      {dialog}
    </>
  );
}
