"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormState } from "@/lib/actions";
import type { Task } from "@tracker/shared/types";
import { useT } from "./LangProvider";
import { TaskTags } from "./TaskTags";

type Submit = (state: FormState, fd: FormData) => Promise<FormState>;

/**
 * Read-mostly task list grouped by status. The circle marks a task done in one tap (saved as a
 * progress update for that task only). Partial % changes go through the Update panel.
 */
export function TaskChecklist({ tasks, color, action }: { tasks: Task[]; color: string; action: Submit }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [justDone, setJustDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const isDone = (task: Task) => task.progress >= 100 || justDone.has(task.id);
  const groups = [
    { key: "doing", label: t("In progress", "กำลังทำ"), dot: "var(--accent)", items: tasks.filter((x) => !isDone(x) && x.progress > 0), open: true },
    { key: "todo", label: t("Not started", "ยังไม่เริ่ม"), dot: "var(--faint)", items: tasks.filter((x) => !isDone(x) && x.progress === 0), open: true },
    { key: "done", label: t("Done", "เสร็จแล้ว"), dot: "var(--ok)", items: tasks.filter(isDone), open: false },
  ].filter((g) => g.items.length > 0);

  function markDone(task: Task) {
    setError(null);
    setJustDone((s) => new Set(s).add(task.id));
    start(async () => {
      const fd = new FormData();
      fd.set(`task:${task.id}`, "100");
      const res = await action({}, fd);
      if (res.error) {
        setError(res.error);
        setJustDone((s) => {
          const n = new Set(s);
          n.delete(task.id);
          return n;
        });
      }
      router.refresh();
    });
  }

  if (tasks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
        {t("No tasks yet — progress is entered by hand for now", "ยังไม่มีงานย่อย — ตอนนี้ใช้ความคืบหน้าแบบกรอกเอง")}
      </p>
    );
  }

  return (
    <div className="space-y-2.5" aria-busy={pending}>
      {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      {groups.map((g) => (
        <details key={g.key} open={g.open} className="group/g card overflow-hidden">
          <summary className="flex cursor-pointer items-center gap-2 bg-surface-2 px-3.5 py-2.5 text-[13px] font-semibold text-muted select-none sm:px-4">
            <span aria-hidden className="size-2 rounded-full" style={{ background: g.dot }} />
            {g.label} · {g.items.length}
            <span aria-hidden className="ml-auto text-xs group-open/g:rotate-180">▾</span>
          </summary>
          <ul className="divide-y divide-line-soft border-t border-line-soft">
            {g.items.map((task) => {
              const done = isDone(task);
              const p = done ? 100 : task.progress;
              return (
                <li key={task.id} className="flex items-center gap-3 px-3.5 py-3 sm:gap-3.5 sm:px-4 sm:py-2.5">
                  {done ? (
                    <span aria-label={t("Done", "เสร็จแล้ว")} className="grid size-7 shrink-0 place-items-center rounded-full bg-ok text-sm font-bold text-surface sm:size-6 sm:text-xs">✓</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => markDone(task)}
                      disabled={pending}
                      aria-label={t(`Mark "${task.title}" as done`, `ทำเครื่องหมายว่า "${task.title}" เสร็จแล้ว`)}
                      className="size-7 shrink-0 rounded-full border-2 border-line hover:border-ok disabled:opacity-60 sm:size-6"
                    />
                  )}
                  <div className="min-w-0 flex-1 sm:flex sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1">
                    <p className={`text-sm ${done ? "text-faint line-through" : ""}`}>{task.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1 sm:mt-0"><TaskTags task={task} /></div>
                  </div>
                  <div className="hidden h-[5px] w-24 shrink-0 rounded-full bg-surface-2 sm:block">
                    <div className="h-full rounded-full" style={{ width: `${p}%`, background: color }} />
                  </div>
                  <div className="w-12 shrink-0 text-right">
                    <p className={`text-[13px] font-semibold tabular-nums ${done ? "text-ok" : ""}`}>{p}%</p>
                    <p className="text-[11px] text-faint sm:hidden">{t(`size ${task.weight}`, `ขนาด ${task.weight}`)}</p>
                  </div>
                  <span className="hidden w-14 shrink-0 text-right text-xs text-faint sm:block">{t(`size ${task.weight}`, `ขนาด ${task.weight}`)}</span>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </div>
  );
}
