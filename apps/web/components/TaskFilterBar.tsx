"use client";

import { useState } from "react";
import { EMPTY_TASK_FILTER, isFilterActive, type TaskFilter } from "@tracker/shared/tasks";
import { TASK_PRIORITIES, type TaskCategory } from "@tracker/shared/types";
import { useT } from "./LangProvider";
import { categoryLabel } from "./TaskTags";

export function useTaskFilter() {
  return useState<TaskFilter>(EMPTY_TASK_FILTER);
}

/** Search + tag / priority / status filters above a task list. */
export function TaskFilterBar({
  id,
  filter,
  onChange,
  shown,
  total,
  categories,
}: {
  /** Prefix for element ids — each list on the page has its own filter. */
  id: string;
  filter: TaskFilter;
  onChange: (f: TaskFilter) => void;
  shown: number;
  total: number;
  /** Tags used in this list (presets and custom). */
  categories: TaskCategory[];
}) {
  const set = <K extends keyof TaskFilter>(key: K, value: TaskFilter[K]) => onChange({ ...filter, [key]: value });
  const active = isFilterActive(filter);
  const t = useT();
  const select = "input min-w-0 px-2 py-1.5 text-[13px]";

  return (
    <div className="space-y-2">
      <input
        id={`${id}-q`}
        type="search"
        value={filter.query}
        onChange={(e) => set("query", e.target.value)}
        placeholder={t("Search tasks…", "ค้นหางานย่อย…")}
        aria-label={t("Search tasks", "ค้นหางานย่อย")}
        className="input py-1.5 text-[13px]"
      />
      <div className="grid grid-cols-3 gap-2">
        <select
          aria-label={t("Filter by tag", "กรองตามหมวด")}
          value={filter.category}
          onChange={(e) => set("category", e.target.value as TaskFilter["category"])}
          className={select}
        >
          <option value="all">{t("All tags", "ทุกหมวด")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>{categoryLabel(c, t)}</option>
          ))}
        </select>
        <select
          aria-label={t("Filter by priority", "กรองตามความสำคัญ")}
          value={filter.priority}
          onChange={(e) => set("priority", e.target.value as TaskFilter["priority"])}
          className={select}
        >
          <option value="all">{t("All priorities", "ทุกความสำคัญ")}</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <select
          aria-label={t("Filter by status", "กรองตามสถานะ")}
          value={filter.status}
          onChange={(e) => set("status", e.target.value as TaskFilter["status"])}
          className={select}
        >
          <option value="all">{t("All statuses", "ทุกสถานะ")}</option>
          <option value="open">{t("Not done", "ยังไม่เสร็จ")}</option>
          <option value="done">{t("Done", "เสร็จแล้ว")}</option>
        </select>
      </div>
      {active && (
        <p className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
          {t(`Showing ${shown} of ${total} tasks`, `แสดง ${shown} จาก ${total} งาน`)}
          <button type="button" className="text-accent hover:underline" onClick={() => onChange(EMPTY_TASK_FILTER)}>
            {t("Clear filters", "ล้างตัวกรอง")}
          </button>
        </p>
      )}
    </div>
  );
}

export function NoMatches({ onClear }: { onClear: () => void }) {
  const t = useT();
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
      {t("No tasks match the filters", "ไม่พบงานที่ตรงกับตัวกรอง")} ·{" "}
      <button type="button" className="text-accent hover:underline" onClick={onClear}>{t("Clear filters", "ล้างตัวกรอง")}</button>
    </p>
  );
}
