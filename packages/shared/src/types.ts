export type ProjectStatus = "active" | "paused" | "done";

/** Dates are stored as local calendar dates in `YYYY-MM-DD` form. */
export type ISODate = string;

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  startDate: ISODate;
  targetDate: ISODate;
  status: ProjectStatus;
  /** Count only Mon–Fri when planning and forecasting. */
  skipWeekends: boolean;
  /** Used only when the project has no tasks. 0–100. */
  manualProgress: number;
  completedAt: ISODate | null;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  /** Longer notes shown under the title on demand. Plain text, line breaks kept. */
  description: string;
  /** Relative effort (e.g. days or points). Progress is weighted by this. */
  weight: number;
  /** 0–100 */
  progress: number;
  order: number;
  /** 1–5 tags: preset keys from TASK_CATEGORIES and/or text the user typed. */
  categories: TaskCategory[];
  /** MoSCoW. */
  priority: TaskPriority;
}

/** What a task is about — shown as a small tag. A preset key, or any text up to 40 characters. */
export type TaskCategory = string;
/** MoSCoW: must = needed for the MVP · should = important · could = nice to have if time allows. */
export type TaskPriority = "must" | "should" | "could";

export const DEFAULT_CATEGORY = "other";
export const DEFAULT_PRIORITY: TaskPriority = "could";
export const MAX_CATEGORY_LENGTH = 40;
export const MAX_CATEGORIES = 5;

/** Preset tags. Anything else a user types is shown as written. */
export const TASK_CATEGORIES: readonly { value: string; label: { en: string; th: string } }[] = [
  { value: "uxui", label: { en: "UX/UI", th: "UX/UI" } },
  { value: "frontend", label: { en: "Frontend", th: "Frontend" } },
  { value: "backend", label: { en: "Backend", th: "Backend" } },
  { value: "system", label: { en: "System", th: "System" } },
  { value: "database", label: { en: "Database", th: "Database" } },
  { value: "api", label: { en: "API", th: "API" } },
  { value: "devops", label: { en: "DevOps", th: "DevOps" } },
  { value: "testing", label: { en: "Testing", th: "ทดสอบ" } },
  { value: "security", label: { en: "Security", th: "ความปลอดภัย" } },
  { value: "bug", label: { en: "Bug fix", th: "แก้ Bug" } },
  { value: "docs", label: { en: "Docs", th: "เอกสาร" } },
  { value: "research", label: { en: "Research", th: "ค้นคว้า" } },
  { value: "other", label: { en: "Other", th: "อื่นๆ" } },
];

export const isPresetCategory = (c: string) => TASK_CATEGORIES.some((x) => x.value === c);

export const TASK_PRIORITIES: readonly { value: TaskPriority; label: string; hint: { en: string; th: string } }[] = [
  { value: "must", label: "MUST", hint: { en: "Required for the MVP", th: "ต้องมีใน MVP" } },
  { value: "should", label: "SHOULD", hint: { en: "Important", th: "ควรมี" } },
  { value: "could", label: "COULD", hint: { en: "Nice to have if time allows", th: "มีได้ถ้ามีเวลา" } },
];

export type LogKind = "update" | "scope";

/** A snapshot of overall project progress at a point in time. */
export interface ProgressLog {
  id: string;
  projectId: string;
  date: ISODate;
  progress: number;
  note: string;
  kind: LogKind;
  createdAt: string;
}

export interface Database {
  version: 1;
  projects: Project[];
  tasks: Task[];
  logs: ProgressLog[];
}

export const PROJECT_COLORS = [
  "#6366d1",
  "#3f93ad",
  "#3f9e7c",
  "#d0953a",
  "#cc5f8c",
  "#8b62c9",
  "#c9614f",
  "#6b7789",
] as const;
