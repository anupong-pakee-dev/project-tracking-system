// Task helpers shared by the forms (parsing typed lines) and the task lists (filtering).
import type { TaskInput } from "./api.ts";
import {
  DEFAULT_CATEGORY,
  DEFAULT_PRIORITY,
  MAX_CATEGORIES,
  MAX_CATEGORY_LENGTH,
  TASK_CATEGORIES,
  type Task,
  type TaskCategory,
  type TaskPriority,
} from "./types.ts";

/** Extra words (besides each preset's key and labels) that mean a preset. */
const CATEGORY_ALIASES: Record<string, TaskCategory> = {
  ux: "uxui",
  ui: "uxui",
  design: "uxui",
  fe: "frontend",
  be: "backend",
  sys: "system",
  ระบบ: "system",
  db: "database",
  ops: "devops",
  test: "testing",
  qa: "testing",
  bugfix: "bug",
  doc: "docs",
  อื่น: "other",
};
/**
 * A typed tag → the preset it names (by key, label or alias, ignoring case), else the text
 * itself trimmed to 40 characters. Empty → "other".
 */
export function normalizeCategory(raw: string): TaskCategory {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return DEFAULT_CATEGORY;
  const word = text.toLowerCase();
  const preset = TASK_CATEGORIES.find(
    (c) => c.value === word || c.label.en.toLowerCase() === word || c.label.th.toLowerCase() === word,
  );
  return preset?.value ?? CATEGORY_ALIASES[word] ?? text.slice(0, MAX_CATEGORY_LENGTH);
}

/**
 * A task's tags, tidied: each normalized, duplicates and blanks dropped, at most 5. "Other" only
 * stands alone — it's dropped when there's a real tag, and used when there's none.
 */
export function normalizeCategories(raw: readonly string[]): TaskCategory[] {
  const tags = [...new Set(raw.filter((c) => c.trim()).map(normalizeCategory))];
  const real = tags.filter((c) => c !== DEFAULT_CATEGORY);
  return real.length ? real.slice(0, MAX_CATEGORIES) : [DEFAULT_CATEGORY];
}

/** A task's tags. An API deployed before multiple tags existed sends a single `category`. */
export function tagsOf(task: Task): TaskCategory[] {
  const legacy = (task as { category?: string }).category;
  return task.categories?.length ? task.categories : [legacy ?? DEFAULT_CATEGORY];
}

const PRIORITY_WORDS: Record<string, TaskPriority> = {
  must: "must",
  should: "should",
  could: "could",
};

/**
 * One task per line: `ชื่องาน | ขนาด | หมวด | ความสำคัญ`. Everything after the title is optional
 * and may come in any order — a number is the size, `must`/`should`/`could` the priority, and
 * any other text a tag (a preset like `ux` or your own). Several tags: `ux, backend` or more `|`
 * parts. Lines without a tag or priority get `defaults`.
 */
export function parseTaskLines(
  text: string,
  defaults: { categories?: TaskCategory[]; priority?: TaskPriority } = {},
): TaskInput[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, ...rest] = line.split("|").map((s) => s.trim());
      const task: TaskInput = { title, weight: 1, priority: defaults.priority ?? DEFAULT_PRIORITY };
      const tags: string[] = [];
      for (const part of rest) {
        if (part === "") continue;
        const n = Number(part);
        if (Number.isFinite(n)) {
          if (n > 0) task.weight = n;
        } else if (part.toLowerCase() in PRIORITY_WORDS) {
          task.priority = PRIORITY_WORDS[part.toLowerCase()];
        } else {
          tags.push(...part.split(","));
        }
      }
      task.categories = normalizeCategories(tags.length ? tags : (defaults.categories ?? []));
      return task;
    })
    .filter((t) => t.title);
}

export interface TaskFilter {
  /** Matches title or description, case-insensitive. */
  query: string;
  /** Tasks that have this tag (among others). */
  category: TaskCategory | "all";
  priority: TaskPriority | "all";
  status: "all" | "open" | "done";
}

export const EMPTY_TASK_FILTER: TaskFilter = { query: "", category: "all", priority: "all", status: "all" };

export function isFilterActive(f: TaskFilter): boolean {
  return f.query.trim() !== "" || f.category !== "all" || f.priority !== "all" || f.status !== "all";
}

/** `progress` overrides the saved value, e.g. while a slider is being moved. */
export function matchesTaskFilter(task: Task, f: TaskFilter, progress = task.progress): boolean {
  // An API deployed before priorities existed omits them.
  const priority = task.priority ?? DEFAULT_PRIORITY;
  if (f.category !== "all" && !tagsOf(task).includes(f.category)) return false;
  if (f.priority !== "all" && priority !== f.priority) return false;
  if (f.status === "open" && progress >= 100) return false;
  if (f.status === "done" && progress < 100) return false;
  const q = f.query.trim().toLowerCase();
  if (q && !task.title.toLowerCase().includes(q) && !(task.description ?? "").toLowerCase().includes(q)) return false;
  return true;
}

/** Tags in use, presets first (in preset order), then custom ones A–Z — for the filter menu. */
export function categoriesIn(tasks: Task[]): TaskCategory[] {
  const used = new Set(tasks.flatMap(tagsOf));
  const presets = TASK_CATEGORIES.map((c) => c.value).filter((c) => used.has(c));
  const custom = [...used].filter((c) => !presets.includes(c)).sort((a, b) => a.localeCompare(b));
  return [...presets, ...custom];
}
