"use client";

import { useState, useTransition } from "react";
import { FormMessage } from "./ActionButton";
import { useConfirm } from "./ConfirmDialog";
import { describeCounts, saveBackup, Spinner, type BackupCounts } from "./DataTransferUI";
import { useT } from "./LangProvider";

/**
 * Deletes all of the user's data — after a confirmation that says exactly what goes, and after
 * downloading a backup file. If the backup can't be saved, nothing is deleted.
 */
export function DeleteAllButton({ action, counts }: { action: () => Promise<void>; counts: BackupCounts }) {
  const t = useT();
  const [ask, dialog] = useConfirm();
  const [step, setStep] = useState<"idle" | "backup" | "delete">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const what = describeCounts(counts, t);

  async function run() {
    setError(null);
    const ok = await ask(
      t(
        `Permanently delete all your data?\n\nThis removes ${what}. A backup file will be downloaded first, so you can restore it later.`,
        `ลบข้อมูลทั้งหมดถาวร?\n\nจะลบ ${what} ระบบจะ Download File สำรองให้ก่อนอัตโนมัติ เพื่อกู้คืนทีหลังได้`,
      ),
      { danger: true },
    );
    if (!ok) return;
    setStep("backup");
    try {
      if (!(await saveBackup(t))) return; // session expired — already heading to /login
    } catch (err) {
      setStep("idle");
      setError(
        t(
          `Nothing was deleted — the backup couldn't be saved: ${(err as Error).message}`,
          `ยังไม่ได้ลบอะไร เพราะสำรองข้อมูลไม่สำเร็จ: ${(err as Error).message}`,
        ),
      );
      return;
    }
    setStep("delete");
    start(() => action());
  }

  return (
    <>
      <button type="button" className="btn btn-danger" disabled={step !== "idle" || counts.projects === 0} onClick={run}>
        {step === "backup" ? (
          <><Spinner /> {t("Saving a backup…", "กำลังสำรองข้อมูล…")}</>
        ) : step === "delete" ? (
          <><Spinner /> {t("Deleting…", "กำลังลบ…")}</>
        ) : (
          t("Delete all data", "ลบข้อมูลทั้งหมด")
        )}
      </button>
      {error && <div className="basis-full"><FormMessage error={error} /></div>}
      {dialog}
    </>
  );
}
