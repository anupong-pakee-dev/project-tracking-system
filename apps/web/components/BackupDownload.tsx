"use client";

import { useState } from "react";
import { FormMessage } from "./ActionButton";
import { useT } from "./LangProvider";
import { describeCounts, formatBytes, saveBackup, Spinner, SuccessTick } from "./DataTransferUI";

type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; filename: string; detail: string }
  | { kind: "error"; message: string };

/** Fetches /api/export and saves it, showing progress instead of a silent link. */
export function BackupDownload() {
  const t = useT();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function download() {
    setStatus({ kind: "working" });
    try {
      const saved = await saveBackup(t);
      if (!saved) return;
      const detail = [saved.counts && describeCounts(saved.counts, t), formatBytes(saved.size)].filter(Boolean).join(" · ");
      setStatus({ kind: "done", filename: saved.filename, detail });
    } catch (err) {
      setStatus({ kind: "error", message: (err as Error).message });
    }
  }

  const working = status.kind === "working";
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <h2 className="section-title">{t("Back up", "สำรองข้อมูล")}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {t("Download all your data as a JSON file to keep or move to another machine", "Download ข้อมูลทั้งหมดเป็น File JSON เก็บไว้หรือย้ายไปเครื่องอื่น")}
          </p>
        </div>
        <button type="button" onClick={download} disabled={working} aria-busy={working} className="btn btn-primary min-w-[168px] shrink-0">
          {working ? (
            <>
              <Spinner /> {t("Preparing file…", "กำลังเตรียม File…")}
            </>
          ) : status.kind === "done" ? (
            t("Download again", "Download อีกครั้ง")
          ) : (
            t("Download backup", "Download File สำรอง")
          )}
        </button>
      </div>

      <div aria-live="polite">
        {status.kind === "done" && (
          <div className="fade-in soft flex items-center gap-3 bg-ok-soft/60 px-3.5 py-3">
            <SuccessTick className="size-8" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-ok">{t("Backup saved", "สำรองข้อมูลเรียบร้อย")}</p>
              <p className="truncate font-mono text-xs text-muted">{status.filename}</p>
              <p className="text-muted">{status.detail}</p>
            </div>
          </div>
        )}
        {status.kind === "error" && <FormMessage error={status.message} />}
      </div>
    </div>
  );
}
