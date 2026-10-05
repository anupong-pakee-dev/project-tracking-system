"use client";

import { useActionState, useEffect, useState } from "react";
import type { FormState } from "@/lib/actions";
import type { Task } from "@tracker/shared/types";
import { FormMessage, SubmitButton } from "./ActionButton";
import { useT } from "./LangProvider";
import { TaskTags } from "./TaskTags";
import { closeUpdatePanel } from "./UpdatePanel";

type Submit = (state: FormState, fd: FormData) => Promise<FormState>;

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/** Search and filter chips appear once there are this many unfinished tasks. */
const FILTER_MIN = 6;
type Filter = "all" | "started" | "todo";

/** Two steps: 1) set % per task (tap a 10-cell bar) · 2) review the changes, add a note and save. */
export function ProgressUpdateForm(props: {
  action: Submit;
  tasks: Task[];
  manualProgress: number;
  today: string;
  color: string;
}) {
  const [state, formAction] = useActionState(props.action, {});
  useEffect(() => {
    if (state.savedAt && !state.error) closeUpdatePanel();
  }, [state.savedAt, state.error]);
  return (
    <form action={formAction} className="flex min-h-full flex-col">
      {/* Re-mount fields after each save so they pick up the fresh server values. */}
      <Fields key={state.savedAt ?? 0} {...props} />
      {state.error && (
        <div className="px-4 pb-4 sm:px-5">
          <FormMessage error={state.error} />
        </div>
      )}
    </form>
  );
}

function Cells({ value, saved, color, onPick, label, tall }: {
  value: number;
  saved: number;
  color: string;
  onPick: (n: number) => void;
  label: string;
  tall?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-10 gap-[3px]">
      {Array.from({ length: 10 }, (_, i) => {
        const hi = (i + 1) * 10;
        const bg = hi <= saved && hi <= value ? color : hi <= value ? `color-mix(in srgb, ${color} 55%, var(--surface))` : "var(--surface-2)";
        return (
          <button
            key={hi}
            type="button"
            aria-label={`${hi}%`}
            aria-pressed={hi <= value}
            onClick={() => onPick(hi === value ? hi - 10 : hi)}
            className={`${tall ? "h-10" : "h-[30px] sm:h-6"} rounded-[3px] first:rounded-l-lg last:rounded-r-lg`}
            style={{ background: bg }}
          />
        );
      })}
    </div>
  );
}

/** One compact row: title + % on a line, the bar under it (beside it on wide screens). */
function TaskRow({ task, value: v, color, onPick }: {
  task: Task;
  value: number;
  color: string;
  onPick: (id: string, n: number) => void;
}) {
  const t = useT();
  const changed = v !== task.progress;
  return (
    <div className="px-3.5 py-2.5 sm:grid sm:grid-cols-[minmax(0,1fr)_240px_52px] sm:items-center sm:gap-3.5">
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[15px] font-medium sm:text-sm ${v >= 100 ? "text-faint line-through" : ""}`}>{task.title}</p>
          <div className="mt-1 hidden flex-wrap items-center gap-1 sm:flex"><TaskTags task={task} /></div>
        </div>
        {changed ? (
          <button type="button" className="shrink-0 text-[11px] text-accent hover:underline" onClick={() => onPick(task.id, task.progress)}>
            {t(`was ${task.progress}% · reset`, `เดิม ${task.progress}% · คืนค่า`)}
          </button>
        ) : (
          <span className="shrink-0 text-[11px] text-faint">{t(`size ${task.weight}`, `ขนาด ${task.weight}`)}</span>
        )}
        <span className={`w-11 shrink-0 text-right text-base font-semibold tabular-nums sm:hidden ${changed ? "text-accent" : ""}`}>{v}%</span>
      </div>
      <div className="mt-2 sm:mt-0">
        <Cells value={v} saved={task.progress} color={color} label={task.title} onPick={(n) => onPick(task.id, n)} />
      </div>
      <span className={`hidden text-right text-base font-semibold tabular-nums sm:block ${changed ? "text-accent" : ""}`}>{v}%</span>
    </div>
  );
}

function Fields({ tasks, manualProgress, today, color }: Omit<Parameters<typeof ProgressUpdateForm>[0], "action">) {
  const t = useT();
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(tasks.map((task) => [task.id, task.progress])),
  );
  const [manual, setManual] = useState(manualProgress);
  // Controlled so a failed submit (React resets uncontrolled fields) keeps what was typed.
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const totalWeight = tasks.reduce((s, task) => s + task.weight, 0);
  const before = tasks.length
    ? tasks.reduce((s, task) => s + task.weight * task.progress, 0) / (totalWeight || 1)
    : manualProgress;
  const after = tasks.length
    ? tasks.reduce((s, task) => s + task.weight * (values[task.id] ?? 0), 0) / (totalWeight || 1)
    : manual;
  const delta = after - before;
  const setTask = (id: string, n: number) => setValues((s) => ({ ...s, [id]: clamp(n) }));

  const open = tasks.filter((task) => task.progress < 100);
  const done = tasks.length - open.length;
  // Filters are judged on saved progress so a row doesn't vanish while you're tapping it.
  const showFilters = open.length >= FILTER_MIN;
  const q = query.trim().toLowerCase();
  const shown = open.filter(
    (task) =>
      (filter === "all" || (filter === "started" ? task.progress > 0 : task.progress === 0)) &&
      (!q || task.title.toLowerCase().includes(q)),
  );
  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: t("All", "ทั้งหมด"), count: open.length },
    { value: "started", label: t("In progress", "กำลังทำ"), count: open.filter((task) => task.progress > 0).length },
    { value: "todo", label: t("Not started", "ยังไม่เริ่ม"), count: open.filter((task) => task.progress === 0).length },
  ];
  const changes = tasks.length
    ? tasks.filter((task) => values[task.id] !== task.progress).map((task) => ({ id: task.id, title: task.title, from: task.progress, to: values[task.id] }))
    : manual !== manualProgress
      ? [{ id: "manual", title: t("Overall progress", "ความคืบหน้ารวม"), from: manualProgress, to: manual }]
      : [];

  return (
    <>
      {/* Every value is always submitted, whichever step is showing. */}
      {tasks.map((task) => (
        <input key={task.id} type="hidden" name={`task:${task.id}`} value={values[task.id] ?? 0} />
      ))}
      {tasks.length === 0 && <input type="hidden" name="manual" value={manual} />}

      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line-soft bg-bg/95 px-4 py-3 backdrop-blur-md sm:px-5">
        <span className="text-[13px] text-muted">{t(`Step ${step}/2`, `ขั้นที่ ${step}/2`)}</span>
        <span className="ml-auto flex items-baseline gap-1.5 tabular-nums">
          <span className="text-sm text-muted">{Math.round(before)}% →</span>
          <span className="text-[26px] leading-none font-semibold">{Math.round(after)}%</span>
          {Math.abs(delta) >= 0.5 && (
            <span className={`text-xs font-semibold ${delta > 0 ? "text-ok" : "text-bad"}`}>
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}
            </span>
          )}
        </span>
      </div>

      <div className="flex-1 space-y-3 px-4 py-4 sm:px-5">
        <div hidden={step !== 1} className="space-y-3">
          {tasks.length > 0 ? (
            <>
              <p className="text-[13px] text-muted">{t("Tap the bar to set each task's % (10% steps)", "แตะแถบเพื่อตั้ง % ของแต่ละงาน (ทีละ 10%)")}</p>
              {showFilters && (
                <div className="space-y-2">
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                    placeholder={t("Search tasks…", "ค้นหางาน…")}
                    aria-label={t("Search tasks", "ค้นหางาน")}
                    className="input py-2 text-base sm:text-sm"
                  />
                  <div className="flex gap-1.5" role="group" aria-label={t("Filter tasks", "กรองงาน")}>
                    {filters.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        aria-pressed={filter === f.value}
                        onClick={() => setFilter(f.value)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          filter === f.value ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-muted hover:text-text"
                        }`}
                      >
                        {f.label} <span className="tabular-nums opacity-70">{f.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {showFilters && shown.length === 0 && (
                <p className="rounded-xl border border-dashed border-line px-3.5 py-4 text-center text-sm text-muted">
                  {t("No tasks match", "ไม่พบงานที่ตรงกัน")}
                </p>
              )}
              {shown.length > 0 && (
                <div className="card divide-y divide-line-soft overflow-hidden rounded-xl!">
                  {shown.map((task) => (
                    <TaskRow key={task.id} task={task} value={values[task.id] ?? 0} color={color} onPick={setTask} />
                  ))}
                </div>
              )}
              {done > 0 && (
                <details className="group/d">
                  <summary className="cursor-pointer text-[13px] text-muted select-none">
                    <span className="text-ok">✓</span> {t(`${done} task${done === 1 ? "" : "s"} done`, `เสร็จแล้ว ${done} งาน`)} · {t("tap to change", "แตะเพื่อแก้")}
                  </summary>
                  <div className="card mt-2 divide-y divide-line-soft overflow-hidden rounded-xl!">
                    {tasks.filter((task) => task.progress >= 100).map((task) => (
                      <TaskRow key={task.id} task={task} value={values[task.id] ?? 0} color={color} onPick={setTask} />
                    ))}
                  </div>
                </details>
              )}
            </>
          ) : (
            <div className="card rounded-xl! p-4">
              <p className="label mb-0">{t("Overall progress", "ความคืบหน้ารวม")}</p>
              <div className="mt-3">
                <Cells tall value={Math.floor(manual / 10) * 10} saved={manualProgress} color={color} label={t("Overall progress", "ความคืบหน้ารวม")} onPick={(n) => setManual(clamp(n))} />
              </div>
              <div className="mt-3.5 flex items-center justify-center gap-4">
                <button type="button" className="btn size-12 rounded-full! px-0 font-semibold" onClick={() => setManual((m) => clamp(m - 1))} aria-label="−1%">−1</button>
                <span className="min-w-[90px] text-center text-4xl font-semibold tabular-nums">{manual}%</span>
                <button type="button" className="btn size-12 rounded-full! px-0 font-semibold" onClick={() => setManual((m) => clamp(m + 1))} aria-label="+1%">+1</button>
              </div>
            </div>
          )}
        </div>

        <div hidden={step !== 2} className="space-y-3">
          <div className="card overflow-hidden rounded-xl!">
            <p className="bg-surface-2 px-3.5 py-2.5 text-[13px] font-semibold text-muted">{t("What changed", "สิ่งที่เปลี่ยน")}</p>
            {changes.length === 0 ? (
              <p className="border-t border-line-soft px-3.5 py-3 text-sm text-muted">
                {t("No % changed — you can still save a note.", "ยังไม่มีการเปลี่ยน % — บันทึกเฉพาะโน้ตได้")}
              </p>
            ) : (
              changes.map((c) => (
                <div key={c.id} className="flex items-center gap-2.5 border-t border-line-soft px-3.5 py-3 text-sm">
                  <span className="min-w-0 flex-1">{c.title}</span>
                  <span className="text-muted tabular-nums">{c.from}% →</span>
                  <span className="font-semibold tabular-nums">{c.to}%</span>
                </div>
              ))
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
            <div>
              <label htmlFor="note" className="label">
                {t("Short note", "บันทึกสั้นๆ")} <span className="font-normal text-muted">({t("optional", "ไม่บังคับ")})</span>
              </label>
              <textarea
                id="note"
                name="note"
                rows={3}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input resize-none text-base sm:text-[15px]"
                placeholder={t("What did you do today? Anything blocking?", "วันนี้ทำอะไรไป ติดปัญหาอะไร")}
              />
            </div>
            <div>
              <label htmlFor="date" className="label">{t("Date", "วันที่")}</label>
              <input id="date" name="date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t border-line-soft bg-nav/95 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-md sm:justify-end sm:bg-surface sm:px-5 sm:pb-3.5">
        {step === 1 ? (
          <>
            <button type="button" className="btn hidden h-[42px] sm:inline-flex" onClick={closeUpdatePanel}>{t("Cancel", "ยกเลิก")}</button>
            <button type="button" className="btn btn-primary h-[50px] flex-1 text-base sm:h-[42px] sm:flex-none sm:px-6 sm:text-sm" onClick={() => setStep(2)}>
              {t("Next", "ต่อไป")}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn h-[50px] px-5 text-[15px] sm:h-[42px] sm:text-sm" onClick={() => setStep(1)}>{t("Back", "ย้อนกลับ")}</button>
            <SubmitButton className="btn btn-primary h-[50px] flex-1 text-base sm:h-[42px] sm:flex-none sm:px-6 sm:text-sm">
              {t("Save progress", "บันทึกความคืบหน้า")}
            </SubmitButton>
          </>
        )}
      </div>
    </>
  );
}
