"use client";

import { useState } from "react";
import {
  DEFAULT_CATEGORY,
  DEFAULT_PRIORITY,
  MAX_CATEGORIES,
  MAX_CATEGORY_LENGTH,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  type Task,
  type TaskCategory,
  type TaskPriority,
} from "@tracker/shared/types";
import { normalizeCategory, tagsOf } from "@tracker/shared/tasks";
import type { T } from "@/lib/i18n";
import { useT } from "./LangProvider";

const PRESET_HUE: Record<string, number> = {
  uxui: 190,
  frontend: 250,
  backend: 155,
  system: 280,
  database: 60,
  api: 220,
  devops: 30,
  testing: 120,
  security: 15,
  bug: 0,
  docs: 90,
  research: 320,
};

/** A steady colour per tag: fixed for presets, derived from the text for custom ones. */
function categoryColor(category: TaskCategory): string {
  if (category === DEFAULT_CATEGORY) return "var(--idle)";
  let hue = PRESET_HUE[category];
  if (hue === undefined) {
    hue = 0;
    for (const ch of category) hue = (hue * 31 + ch.codePointAt(0)!) % 360;
  }
  return `oklch(0.66 0.11 ${hue})`;
}

/** Preset → its label in the current language; custom tags as written. */
export function categoryLabel(category: TaskCategory, t: T): string {
  const preset = TASK_CATEGORIES.find((c) => c.value === category);
  return preset ? t(preset.label.en, preset.label.th) : category;
}

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  must: "bg-bad-soft text-bad",
  should: "bg-warn-soft text-warn",
  could: "bg-ok-soft text-ok",
};

const priorityInfo = (p: TaskPriority) => TASK_PRIORITIES.find((x) => x.value === p);

/** Outlined chip: what the task is about. */
export function CategoryTag({ category }: { category: TaskCategory }) {
  const t = useT();
  return (
    <span className="inline-flex max-w-40 shrink-0 items-center gap-1 rounded-md border border-line px-1.5 text-[11px] leading-[18px] font-medium text-muted">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: categoryColor(category) }} />
      <span className="truncate">{categoryLabel(category, t)}</span>
    </span>
  );
}

/** Filled chip: MoSCoW priority. */
export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const t = useT();
  const info = priorityInfo(priority);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-1.5 text-[10.5px] leading-[18px] font-bold tracking-wide ${PRIORITY_STYLE[priority]}`}
      title={info && t(info.hint.en, info.hint.th)}
    >
      {info?.label ?? priority}
    </span>
  );
}

/** Tags on a task row. Tasks from an API without these fields show Other / COULD. */
export function TaskTags({ task }: { task: Task }) {
  return (
    <>
      <PriorityBadge priority={task.priority ?? DEFAULT_PRIORITY} />
      {tagsOf(task).map((c) => (
        <CategoryTag key={c} category={c} />
      ))}
    </>
  );
}

const CUSTOM = "__custom";

/**
 * Pick up to 5 tags: chosen ones show as removable chips; "+ Add" offers the presets left and
 * "Custom…" for your own text. Submits each tag as a `categories` field (none → the API uses Other).
 */
export function CategoryPicker({ id, defaultValue = [] }: { id: string; defaultValue?: TaskCategory[] }) {
  const t = useT();
  const [tags, setTags] = useState(() => defaultValue.filter((c) => c !== DEFAULT_CATEGORY));
  const [typing, setTyping] = useState(false);
  const [custom, setCustom] = useState("");
  const full = tags.length >= MAX_CATEGORIES;

  const add = (raw: string) => {
    const tag = normalizeCategory(raw);
    if (tag !== DEFAULT_CATEGORY && !tags.includes(tag) && !full) setTags([...tags, tag]);
  };
  const addCustom = () => {
    if (custom.trim()) add(custom);
    setCustom("");
    setTyping(false);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-[var(--radius-input)] border border-line bg-surface px-2 py-1.5">
        {tags.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded-md bg-surface-2 py-0.5 pr-1 pl-2 text-xs font-medium">
            <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: categoryColor(c) }} />
            <span className="max-w-32 truncate">{categoryLabel(c, t)}</span>
            <button
              type="button"
              onClick={() => setTags(tags.filter((x) => x !== c))}
              className="grid size-4 place-items-center rounded text-muted hover:bg-line hover:text-text"
              aria-label={t(`Remove ${categoryLabel(c, t)}`, `เอา ${categoryLabel(c, t)} ออก`)}
            >
              ×
            </button>
            <input type="hidden" name="categories" value={c} />
          </span>
        ))}
        {tags.length === 0 && <span className="px-1 text-xs text-faint">{t("Other (none chosen)", "อื่นๆ (ยังไม่เลือก)")}</span>}
        {!full && !typing && (
          <select
            id={id}
            value=""
            onChange={(e) => (e.target.value === CUSTOM ? setTyping(true) : add(e.target.value))}
            aria-label={t("Add a tag", "เพิ่มหมวด")}
            className="ml-auto rounded-md bg-transparent px-1 py-0.5 text-xs font-medium text-accent hover:bg-surface-2"
          >
            <option value="" disabled>+ {t("Add", "เพิ่ม")}</option>
            {TASK_CATEGORIES.filter((c) => c.value !== DEFAULT_CATEGORY && !tags.includes(c.value)).map((c) => (
              <option key={c.value} value={c.value}>{t(c.label.en, c.label.th)}</option>
            ))}
            <option value={CUSTOM}>{t("Custom…", "กรอกเอง…")}</option>
          </select>
        )}
      </div>
      {typing && (
        <div className="flex gap-1.5">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              // Enter adds the tag instead of submitting the form; Escape cancels.
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              } else if (e.key === "Escape") {
                setCustom("");
                setTyping(false);
              }
            }}
            maxLength={MAX_CATEGORY_LENGTH}
            placeholder={t("e.g. Marketing", "เช่น Marketing")}
            aria-label={t("Custom tag", "หมวดที่กรอกเอง")}
            className="input py-1.5 text-sm"
            autoFocus
          />
          <button type="button" className="btn px-3 py-1.5 text-sm" onClick={addCustom}>
            {t("Add", "เพิ่ม")}
          </button>
        </div>
      )}
      {full && <p className="text-xs text-faint">{t(`Up to ${MAX_CATEGORIES} tags`, `ได้สูงสุด ${MAX_CATEGORIES} หมวด`)}</p>}
    </div>
  );
}

export function PrioritySelect({ id, defaultValue = DEFAULT_PRIORITY }: { id: string; defaultValue?: TaskPriority }) {
  const t = useT();
  return (
    <select id={id} name="priority" defaultValue={defaultValue} className="input py-2 text-sm">
      {TASK_PRIORITIES.map((p) => (
        <option key={p.value} value={p.value}>{p.label} — {t(p.hint.en, p.hint.th)}</option>
      ))}
    </select>
  );
}
