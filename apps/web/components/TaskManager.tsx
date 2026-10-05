"use client";

import { useState } from "react";
import { addTasks, deleteTask, moveTask, updateTask } from "@/lib/actions";
import { categoriesIn, EMPTY_TASK_FILTER, matchesTaskFilter, tagsOf } from "@tracker/shared/tasks";
import type { Task } from "@tracker/shared/types";
import { ActionButton, FormMessage } from "./ActionButton";
import { useT } from "./LangProvider";
import { NoMatches, TaskFilterBar, useTaskFilter } from "./TaskFilterBar";
import { CategoryPicker, PrioritySelect, TaskTags } from "./TaskTags";
import { useFormAction } from "./useFormAction";

export function TaskManager({
  projectId,
  tasks,
  color,
  hasManualProgress,
}: {
  projectId: string;
  tasks: Task[];
  color: string;
  hasManualProgress: boolean;
}) {
  const t = useT();
  const totalWeight = tasks.reduce((s, task) => s + task.weight, 0);
  const [filter, setFilter] = useTaskFilter();
  const shown = tasks.filter((task) => matchesTaskFilter(task, filter));
  return (
    <div className="space-y-4">
      {tasks.length > 0 && (
        <TaskFilterBar
          id="manage"
          filter={filter}
          onChange={setFilter}
          shown={shown.length}
          total={tasks.length}
          categories={categoriesIn(tasks)}
        />
      )}
      {tasks.length > 0 && shown.length === 0 ? (
        <NoMatches onClear={() => setFilter(EMPTY_TASK_FILTER)} />
      ) : tasks.length > 0 ? (
        <ul className="divide-y divide-line-soft rounded-xl border border-line-soft">
          {shown.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              color={color}
              share={totalWeight ? (task.weight / totalWeight) * 100 : 0}
              first={task.id === tasks[0].id}
              last={task.id === tasks[tasks.length - 1].id}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          {t("No tasks yet — progress is entered by hand for now", "ยังไม่มีงานย่อย — ตอนนี้ใช้ความคืบหน้าแบบกรอกเอง")}
        </p>
      )}
      <AddTasks projectId={projectId} warnSwitch={tasks.length === 0 && hasManualProgress} />
    </div>
  );
}

function TaskRow({ task, color, share, first, last }: {
  task: Task; color: string; share: number; first: boolean; last: boolean;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  // An API deployed before task descriptions existed omits the field.
  const description = task.description ?? "";
  const hasDetails = description.trim() !== "";
  const { state, onSubmit, pending } = useFormAction(updateTask.bind(null, task.id));

  const [seen, setSeen] = useState(state.savedAt);
  if (state.savedAt !== seen) {
    setSeen(state.savedAt);
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="px-3.5 py-2.5">
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label className="text-xs text-muted" htmlFor={`title-${task.id}`}>{t("Task name", "ชื่องาน")}</label>
            <input id={`title-${task.id}`} name="title" defaultValue={task.title} required maxLength={200} className="input" autoFocus />
          </div>
          <div className="w-24">
            <label className="text-xs text-muted" htmlFor={`weight-${task.id}`}>{t("Size", "ขนาด")}</label>
            <input id={`weight-${task.id}`} name="weight" type="number" min={0.1} step={0.1} defaultValue={task.weight} required className="input" />
          </div>
          <div className="min-w-56 flex-1">
            <label className="text-xs text-muted" htmlFor={`category-${task.id}`}>{t("Tag", "หมวด")}</label>
            <CategoryPicker id={`category-${task.id}`} defaultValue={tagsOf(task)} />
          </div>
          <div className="min-w-48 flex-1">
            <label className="text-xs text-muted" htmlFor={`priority-${task.id}`}>{t("Priority (MoSCoW)", "ความสำคัญ (MoSCoW)")}</label>
            <PrioritySelect id={`priority-${task.id}`} defaultValue={task.priority} />
          </div>
          <div className="basis-full">
            <label className="text-xs text-muted" htmlFor={`description-${task.id}`}>
              {t("Details", "รายละเอียด")} <span className="text-faint">({t("optional", "ไม่บังคับ")})</span>
            </label>
            <textarea
              id={`description-${task.id}`}
              name="description"
              defaultValue={description}
              rows={Math.min(12, Math.max(3, description.split("\n").length + 1))}
              maxLength={5000}
              className="input"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending}>{t("Save", "บันทึก")}</button>
          <button type="button" className="btn" onClick={() => setEditing(false)}>{t("Cancel", "ยกเลิก")}</button>
          <div className="basis-full"><FormMessage error={state.error} /></div>
        </form>
      </li>
    );
  }

  return (
    <li className="group px-3.5 py-2.5">
      {/* Phones: the buttons go under the task so the title and tags get the full width. */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <div className="min-w-0 flex-1">
          {/* Wraps: when the title and tags don't fit on one line, the tags move below it. */}
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
            {hasDetails ? (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-controls={`details-${task.id}`}
                className="flex max-w-full min-w-0 items-center gap-1.5 text-left"
              >
                <span className={`truncate text-sm ${task.progress >= 100 ? "text-faint line-through" : ""}`}>{task.title}</span>
                <span className="shrink-0 text-xs text-muted">
                  {open ? `▴ ${t("Hide", "ซ่อน")}` : `▾ ${t("Details", "รายละเอียด")}`}
                </span>
              </button>
            ) : (
              <div className={`max-w-full truncate text-sm ${task.progress >= 100 ? "text-faint line-through" : ""}`}>{task.title}</div>
            )}
            <span className="flex flex-wrap items-center gap-1">
              <TaskTags task={task} />
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <div className="h-[5px] w-24 rounded-full bg-surface-2">
              <div className="h-full rounded-full" style={{ width: `${task.progress}%`, background: color }} />
            </div>
            <span className="text-xs whitespace-nowrap tabular-nums text-muted">
              {task.progress}% ·{" "}
              {t(
                `size ${task.weight} (${Math.round(share)}% of project)`,
                `ขนาด ${task.weight} (${Math.round(share)}% ของ Project)`,
              )}
            </span>
          </div>
        </div>
        <div className="task-actions -mr-2 flex shrink-0 items-center justify-end gap-0.5 sm:mr-0">
          <ActionButton action={moveTask.bind(null, task.id, -1)} className="btn btn-ghost px-2" title={t("Move up", "เลื่อนขึ้น")}>
            {first ? <span className="opacity-30">↑</span> : "↑"}
          </ActionButton>
          <ActionButton action={moveTask.bind(null, task.id, 1)} className="btn btn-ghost px-2" title={t("Move down", "เลื่อนลง")}>
            {last ? <span className="opacity-30">↓</span> : "↓"}
          </ActionButton>
          <button type="button" className="btn btn-ghost px-2 text-xs" onClick={() => setEditing(true)}>
            {t("Edit", "แก้ไข")}
          </button>
          <ActionButton
            action={deleteTask.bind(null, task.id)}
            confirm={t(`Delete task "${task.title}"?`, `ลบงาน "${task.title}"?`)}
            className="btn btn-ghost btn-danger px-2 text-xs"
          >
            {t("Delete", "ลบ")}
          </ActionButton>
        </div>
      </div>
      {hasDetails && open && (
        <div
          id={`details-${task.id}`}
          className="mt-2 whitespace-pre-wrap break-words rounded-r-lg border-l-[3px] px-3 py-2 text-[13px] leading-relaxed text-muted"
          style={{ borderColor: color, background: `color-mix(in srgb, ${color} 8%, var(--surface-2))` }}
        >
          {description}
        </div>
      )}
    </li>
  );
}

function AddTasks({ projectId, warnSwitch }: { projectId: string; warnSwitch: boolean }) {
  const t = useT();
  const [text, setText] = useState("");
  const { state, onSubmit, pending } = useFormAction(addTasks.bind(null, projectId));

  const [seen, setSeen] = useState(state.savedAt);
  if (state.savedAt !== seen) {
    setSeen(state.savedAt);
    setText("");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <label htmlFor={`add-${projectId}`} className="label">{t("Add tasks", "เพิ่มงาน")}</label>
      <textarea
        id={`add-${projectId}`}
        name="tasks"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="input font-mono text-[13px]"
        placeholder={
          t.lang === "th"
            ? "ชื่องาน | ขนาด | หมวด | must/should/could\n(เพิ่มหลายงานได้ บรรทัดละงาน)"
            : "Task name | size | tag | must/should/could\n(one task per line)"
        }
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted" htmlFor={`add-category-${projectId}`}>{t("Tag", "หมวด")}</label>
          <CategoryPicker id={`add-category-${projectId}`} />
        </div>
        <div>
          <label className="text-xs text-muted" htmlFor={`add-priority-${projectId}`}>{t("Priority (MoSCoW)", "ความสำคัญ (MoSCoW)")}</label>
          <PrioritySelect id={`add-priority-${projectId}`} />
        </div>
      </div>
      <p className="hint">
        {t(
          <>Used for every line that doesn&apos;t say otherwise, e.g. <code>Login page | 2 | ux | must</code></>,
          <>ใช้กับทุกบรรทัดที่ไม่ได้ระบุเอง เช่น <code>หน้า Login | 2 | ux | must</code></>,
        )}
      </p>
      {warnSwitch && (
        <p className="text-xs text-warn">
          {t(
            "Once you add the first task, % is calculated from tasks instead of the number you entered — if some work is already done, add those tasks too.",
            "เมื่อเพิ่มงานแรก ระบบจะคำนวณ % จากงานย่อยแทนค่าที่กรอกเอง — ถ้าทำไปแล้วบางส่วน ให้เพิ่มงานที่ทำเสร็จแล้วด้วย",
          )}
        </p>
      )}
      <p className="hint">
        {t(
          <>Adding or removing tasks, or changing their size, is recorded as a &ldquo;scope change&rdquo; in the history and affects the forecast.</>,
          <>การเพิ่ม/ลบงานหรือเปลี่ยนขนาดงานถูกบันทึกเป็น &ldquo;ขอบเขตเปลี่ยน&rdquo; ในประวัติ และมีผลต่อการคาดการณ์</>,
        )}
      </p>
      <div className="flex items-center justify-between gap-2">
        <FormMessage error={state.error} message={state.message} />
        <button type="submit" className="btn ml-auto" disabled={pending || !text.trim()}>+ {t("Add", "เพิ่ม")}</button>
      </div>
    </form>
  );
}
