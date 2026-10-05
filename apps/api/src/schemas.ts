import { isISODate, workdaysBetween } from "@tracker/shared/dates";
import { bi, localize } from "@tracker/shared/i18n";
import { normalizeCategories } from "@tracker/shared/tasks";
import { DEFAULT_PRIORITY, PROJECT_COLORS } from "@tracker/shared/types";
import { z } from "zod";

const isoDate = z.string().refine(isISODate, bi("Invalid date", "วันที่ไม่ถูกต้อง"));
const pct = z.number().min(0, bi("Progress must be between 0 and 100", "ความคืบหน้าต้องอยู่ระหว่าง 0–100")).max(100, bi("Progress must be between 0 and 100", "ความคืบหน้าต้องอยู่ระหว่าง 0–100"));

export const idParam = z.object({ id: z.uuid() });

// ---------- Auth ----------

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, bi("Email is too long", "Email ยาวเกินไป"))
  .pipe(z.email(bi("Invalid email address", "รูปแบบ Email ไม่ถูกต้อง")));
const password = z
  .string()
  .min(8, bi("Password must be at least 8 characters", "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"))
  .max(128, bi("Password must be at most 128 characters", "รหัสผ่านต้องไม่เกิน 128 ตัวอักษร"));
const token = z.string().min(20, bi("Invalid link", "Link ไม่ถูกต้อง")).max(200, bi("Invalid link", "Link ไม่ถูกต้อง"));

export const registerInput = z.object({ email, password });
/** Login doesn't enforce the length rules — just checks the password. */
export const loginInput = z.object({ email, password: z.string().min(1, bi("Please enter your password", "กรุณากรอกรหัสผ่าน")).max(128) });
export const emailInput = z.object({ email });
export const tokenInput = z.object({ token });
export const resetPasswordInput = z.object({ token, password });
export const googleCallbackInput = z.object({
  code: z.string().min(1, bi("Invalid link", "Link ไม่ถูกต้อง")).max(2048, bi("Invalid link", "Link ไม่ถูกต้อง")),
  codeVerifier: z.string().min(43, bi("Invalid link", "Link ไม่ถูกต้อง")).max(128, bi("Invalid link", "Link ไม่ถูกต้อง")),
});

const tag = z.string().max(200, bi("Task category is too long", "หมวดงานยาวเกินไป"));
/** Preset keys and/or the user's own text, tidied by normalizeCategories (deduped, 1–5, "other" when none). */
const taskCategories = z
  .array(tag)
  .max(20, bi("Too many categories", "หมวดเยอะเกินไป"))
  .default([])
  .transform(normalizeCategories);
const taskPriority = z.enum(["must", "should", "could"], bi("Invalid priority", "ระดับความสำคัญไม่ถูกต้อง"));

export const taskInput = z.object({
  title: z.string().trim().min(1, bi("Please enter a task name", "กรุณากรอกชื่องาน")).max(200, bi("Task name is longer than 200 characters", "ชื่องานยาวเกิน 200 ตัวอักษร")),
  description: z.string().trim().max(5000, bi("Task details are longer than 5000 characters", "รายละเอียดงานยาวเกิน 5000 ตัวอักษร")).default(""),
  weight: z.number().positive(bi("Task size must be more than 0", "ขนาดงานต้องมากกว่า 0")).max(1000, bi("Task size must be at most 1000", "ขนาดงานต้องไม่เกิน 1000")).default(1),
  categories: taskCategories,
  priority: taskPriority.default(DEFAULT_PRIORITY),
});

const projectShape = {
  name: z.string().trim().min(1, bi("Please name the project", "กรุณาตั้งชื่อ Project")).max(120, bi("Project name is longer than 120 characters", "ชื่อ Project ยาวเกิน 120 ตัวอักษร")),
  description: z.string().trim().max(1000, bi("Description is longer than 1000 characters", "รายละเอียดยาวเกิน 1000 ตัวอักษร")).default(""),
  // A preset or any colour from the hue strip.
  color: z.string().regex(/^#[0-9a-f]{6}$/i).transform((c) => c.toLowerCase()).catch(PROJECT_COLORS[0]),
  startDate: isoDate,
  targetDate: isoDate,
  skipWeekends: z.boolean().default(false),
};

function checkDates(v: { startDate: string; targetDate: string; skipWeekends: boolean }, ctx: z.RefinementCtx) {
  if (v.targetDate <= v.startDate) {
    ctx.addIssue({ code: "custom", path: ["targetDate"], message: bi("The target date must be after the start date", "วันเป้าหมายต้องอยู่หลังวันเริ่ม") });
  } else if (v.skipWeekends && workdaysBetween(v.startDate, v.targetDate) < 1) {
    ctx.addIssue({
      code: "custom",
      path: ["targetDate"],
      message: bi("There are no working days (Mon–Fri) between the start and target dates", "ช่วงวันเริ่มถึงวันเป้าหมายไม่มีวันทำงาน (จันทร์–ศุกร์) เลย"),
    });
  }
}

export const projectInput = z.object(projectShape).superRefine(checkDates);

export const createProjectInput = z
  .object({
    ...projectShape,
    manualProgress: pct.default(0),
    tasks: z.array(taskInput).max(200, bi("You can add at most 200 tasks at a time", "เพิ่มได้ครั้งละไม่เกิน 200 งาน")).default([]),
  })
  .superRefine(checkDates);

export const statusInput = z.object({ status: z.enum(["active", "paused", "done"]) });

export const addTasksInput = z.object({
  tasks: z.array(taskInput).min(1, bi("Please enter a task name", "กรุณากรอกชื่องาน")).max(200, bi("You can add at most 200 tasks at a time", "เพิ่มได้ครั้งละไม่เกิน 200 งาน")),
});

export const updateTaskInput = taskInput;

export const moveTaskInput = z.object({ direction: z.union([z.literal(-1), z.literal(1)]) });

export const progressInput = z.object({
  date: isoDate.optional(),
  note: z.string().trim().max(1000, bi("Note is longer than 1000 characters", "บันทึกยาวเกิน 1000 ตัวอักษร")).default(""),
  manual: pct.optional(),
  tasks: z.record(z.uuid(), pct).optional(),
});

// ---------- Backup files ----------

const projectRecord = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(1000),
  color: z.string().max(16),
  startDate: isoDate,
  targetDate: isoDate,
  status: z.enum(["active", "paused", "done"]),
  // Files written before the weekend option existed count every day.
  skipWeekends: z.boolean().default(false),
  manualProgress: pct,
  completedAt: isoDate.nullable(),
  createdAt: z.iso.datetime(),
});

const taskRecord = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  title: z.string().min(1).max(200),
  // Files written before task descriptions existed have none.
  description: z.string().max(5000).default(""),
  weight: z.number().min(0).max(1000),
  progress: pct,
  order: z.number().int(),
  // Older files have one `category` (or none), and may have no priority — that means COULD.
  categories: z.array(tag).max(20).optional(),
  category: tag.optional(),
  priority: taskPriority
    .nullable()
    .default(null)
    .transform((p) => p ?? DEFAULT_PRIORITY),
}).transform(({ category, categories, ...task }) => ({
  ...task,
  categories: normalizeCategories(categories ?? (category ? [category] : [])),
}));

const logRecord = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  date: isoDate,
  progress: pct,
  note: z.string().max(1000),
  kind: z.enum(["update", "scope"]),
  createdAt: z.iso.datetime(),
});

export const backupFile = z
  .object({
    version: z.literal(1, bi("This file version isn't supported", "ไม่รองรับ Version ของ File นี้")),
    projects: z.array(projectRecord),
    tasks: z.array(taskRecord),
    logs: z.array(logRecord),
  })
  .superRefine((db, ctx) => {
    const ids = new Set(db.projects.map((p) => p.id));
    if (db.tasks.some((t) => !ids.has(t.projectId)) || db.logs.some((l) => !ids.has(l.projectId))) {
      ctx.addIssue({ code: "custom", message: bi("Some tasks or history entries refer to a project that doesn't exist", "มีงานหรือประวัติที่อ้างถึง Project ที่ไม่มีอยู่") });
    }
  });

/** First issue as a short user-facing message (a `bi()` string). */
export function describeZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return bi("Invalid data", "ข้อมูลไม่ถูกต้อง");
  // Our own messages are already bi(); built-in ones get the field path for context.
  if (localize(issue.message, "en") !== issue.message) return issue.message;
  const where = `${issue.path.join(".") || "body"} (${issue.message})`;
  return bi(`Invalid data: ${where}`, `ข้อมูลไม่ถูกต้อง: ${where}`);
}
