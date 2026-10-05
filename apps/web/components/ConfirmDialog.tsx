"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "./LangProvider";

interface ConfirmRequest {
  id: number;
  message: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

/**
 * In-page replacement for window.confirm(). Embedded browsers (like the Claude desktop
 * preview pane) can silently return false from window.confirm(), cancelling the action.
 */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const ask = useCallback(
    (message: string, opts: { danger?: boolean } = {}) =>
      new Promise<boolean>((resolve) =>
        setRequest({ id: Date.now() + Math.random(), message, danger: !!opts.danger, resolve }),
      ),
    [],
  );

  const dialog = request ? (
    <ConfirmDialog
      key={request.id}
      message={request.message}
      danger={request.danger}
      onClose={(ok) => {
        request.resolve(ok);
        setRequest(null);
      }}
    />
  ) : null;

  return [ask, dialog] as const;
}

function ConfirmDialog({ message, danger, onClose }: {
  message: string;
  danger: boolean;
  onClose: (ok: boolean) => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const settled = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  // Resolve from the click/key handlers directly: some embedded browsers never fire
  // the dialog's "close" event, so it can't be relied on.
  const finish = (ok: boolean) => {
    if (settled.current) return;
    settled.current = true;
    ref.current?.close();
    onClose(ok);
  };

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault(); // Esc
        finish(false);
      }}
      onClick={(e) => {
        // Click on the backdrop cancels.
        if (e.target === e.currentTarget) finish(false);
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-xl border border-line bg-surface p-0 text-text shadow-xl backdrop:bg-black/40"
    >
      <div className="p-5">
        <p className="text-sm leading-relaxed whitespace-pre-line">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => finish(false)}>{t("Cancel", "ยกเลิก")}</button>
          <button
            type="button"
            onClick={() => finish(true)}
            autoFocus
            className={danger ? "btn border-transparent bg-bad text-white hover:bg-bad hover:opacity-90" : "btn btn-primary"}
          >
            {t("Confirm", "ยืนยัน")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
