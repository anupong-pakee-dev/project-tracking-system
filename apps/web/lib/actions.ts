"use server";

// Form handlers: turn FormData into JSON requests for apps/api, which validates
// everything and owns the business rules.
import type {
  CreateProjectInput,
  MessageBody,
  ProgressInput,
  ProjectInput,
  TaskInput,
} from "@tracker/shared/api";
import { parseTaskLines } from "@tracker/shared/tasks";
import type { ProjectStatus, TaskCategory, TaskPriority } from "@tracker/shared/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, ApiError } from "./api";
import { getT } from "./i18n-server";

export interface FormState {
  error?: string;
  message?: string;
  /** Changes on every success so forms can reset themselves. */
  savedAt?: number;
  /** API error code, e.g. EMAIL_NOT_VERIFIED. */
  code?: string;
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Empty → undefined; otherwise a number (NaN is left for the API to reject). */
function num(fd: FormData, key: string): number | undefined {
  const raw = str(fd, key);
  return raw === "" ? undefined : Number(raw);
}

function ok(message?: string): FormState {
  revalidatePath("/", "layout");
  return { message, savedAt: Date.now() };
}

/** API errors become form errors; anything else is a bug and bubbles up. */
async function guard(fn: () => Promise<FormState>): Promise<FormState> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, code: err.code };
    throw err;
  }
}

function projectFields(fd: FormData): ProjectInput {
  return {
    name: str(fd, "name"),
    description: str(fd, "description"),
    color: str(fd, "color"),
    startDate: str(fd, "startDate"),
    targetDate: str(fd, "targetDate"),
    skipWeekends: fd.get("skipWeekends") === "on",
  };
}

/** Each `categories` field: preset keys or the user's own text; the API tidies them up. */
function categories(fd: FormData): TaskCategory[] {
  return fd.getAll("categories").filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

/** Unknown values pass through for the API to reject; empty → the API's default (COULD). */
function priority(fd: FormData): TaskPriority | undefined {
  return (str(fd, "priority") || undefined) as TaskPriority | undefined;
}

// ---------- Projects ----------

export async function createProject(_: FormState, fd: FormData): Promise<FormState> {
  let id = "";
  const result = await guard(async () => {
    const body: CreateProjectInput = {
      ...projectFields(fd),
      manualProgress: num(fd, "manualProgress") ?? 0,
      tasks: parseTaskLines(str(fd, "tasks")),
    };
    ({ id } = await api<{ id: string }>("POST", "/projects", body));
    return ok();
  });
  if (result.error) return result;
  redirect(`/projects/${id}`);
}

export async function updateProject(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const result = await guard(async () => {
    await api("PATCH", `/projects/${id}`, projectFields(fd));
    return ok();
  });
  if (result.error) return result;
  redirect(`/projects/${id}`);
}

export async function setProjectStatus(id: string, status: ProjectStatus): Promise<void> {
  await api("PUT", `/projects/${id}/status`, { status });
  revalidatePath("/", "layout");
}

export async function deleteProject(id: string): Promise<void> {
  await api("DELETE", `/projects/${id}`);
  revalidatePath("/", "layout");
  redirect("/");
}

// ---------- Tasks ----------

export async function addTasks(projectId: string, _: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const { message } = await api<MessageBody>("POST", `/projects/${projectId}/tasks`, {
      tasks: parseTaskLines(str(fd, "tasks"), { categories: categories(fd), priority: priority(fd) }),
    });
    return ok(message);
  });
}

export async function updateTask(taskId: string, _: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const body: TaskInput = {
      title: str(fd, "title"),
      description: str(fd, "description"),
      weight: num(fd, "weight") ?? 1,
      categories: categories(fd),
      priority: priority(fd),
    };
    await api("PATCH", `/tasks/${taskId}`, body);
    return ok();
  });
}

export async function moveTask(taskId: string, direction: -1 | 1): Promise<void> {
  await api("POST", `/tasks/${taskId}/move`, { direction });
  revalidatePath("/", "layout");
}

export async function deleteTask(taskId: string): Promise<void> {
  await api("DELETE", `/tasks/${taskId}`);
  revalidatePath("/", "layout");
}

// ---------- Progress updates ----------

export async function submitProgress(projectId: string, _: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const tasks: Record<string, number> = {};
    for (const [key, value] of fd.entries()) {
      if (key.startsWith("task:") && typeof value === "string" && value !== "") {
        tasks[key.slice(5)] = Number(value);
      }
    }
    const body: ProgressInput = {
      date: str(fd, "date") || undefined,
      note: str(fd, "note"),
      manual: num(fd, "manual"),
      tasks: Object.keys(tasks).length ? tasks : undefined,
    };
    const { message } = await api<MessageBody>("POST", `/projects/${projectId}/progress`, body);
    return ok(message);
  });
}

export async function deleteLog(logId: string): Promise<void> {
  await api("DELETE", `/logs/${logId}`);
  revalidatePath("/", "layout");
}

// ---------- Data management ----------

export async function importBackup(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT();
  return guard(async () => {
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: t("Please choose a .json file", "กรุณาเลือก File .json") };
    // Leaves headroom under the 4 MB Server Action / API body limits.
    if (file.size > 3.5 * 1024 * 1024) return { error: t("The file is larger than 3.5 MB", "File ใหญ่เกิน 3.5 MB") };
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      return { error: t("This file isn't valid JSON", "File นี้ไม่ใช่ JSON ที่ถูกต้อง") };
    }
    const { message } = await api<MessageBody>("PUT", "/backup", json);
    return ok(message);
  });
}

export async function loadSampleData(): Promise<void> {
  await api("POST", "/sample");
  revalidatePath("/", "layout");
  redirect("/");
}

export async function resetAllData(): Promise<void> {
  await api("DELETE", "/data");
  revalidatePath("/", "layout");
  redirect("/");
}
