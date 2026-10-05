import { randomUUID } from "node:crypto";
import type { ProjectView } from "@tracker/shared/api";
import { clampPct, computeProgress, forecastProject, HEALTH_PRIORITY } from "@tracker/shared/forecast";
import { bi, pick, type Lang } from "@tracker/shared/i18n";
import type { Database, ISODate, LogKind, ProjectStatus } from "@tracker/shared/types";
import type { z } from "zod";
import type { Db, Tx } from "./db.ts";
import { badRequest, notFound } from "./errors.ts";
import type { Prisma } from "./generated/prisma/client.ts";
import { toDate, toLog, toProject, toTask } from "./mappers.ts";
import type * as S from "./schemas.ts";

// Every public method takes the signed-in user's id and only ever touches that user's rows.
// Anything owned by someone else is reported as "not found" — never "forbidden" — so ids
// can't be probed.

const round1 = (n: number) => Math.round(n * 10) / 10;

const PROJECT_NOT_FOUND = bi("Project not found", "ไม่พบ Project นี้");

// Notes written into the history are stored in the language the user had chosen at the time.

const viewInclude = {
  tasks: { orderBy: { order: "asc" } },
  logs: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
} satisfies Prisma.ProjectInclude;

type ViewRow = Prisma.ProjectGetPayload<{ include: typeof viewInclude }>;

function toView(row: ViewRow, today: ISODate): ProjectView {
  const project = toProject(row);
  const tasks = row.tasks.map(toTask);
  const logs = row.logs.map(toLog);
  return { project, tasks, logs, forecast: forecastProject(project, tasks, logs, today) };
}

async function assertProject(tx: Tx | Db, userId: string, projectId: string) {
  const row = await tx.project.findFirst({ where: { id: projectId, userId }, select: { id: true } });
  if (!row) throw notFound(PROJECT_NOT_FOUND);
}

async function ownedTask(tx: Tx, userId: string, taskId: string) {
  const task = await tx.task.findFirst({ where: { id: taskId, project: { userId } } });
  if (!task) throw notFound(bi("Task not found", "ไม่พบงานนี้"));
  return task;
}

/** Project row + tasks → overall progress, using the shared formula. Call after an ownership check. */
async function loadProgress(tx: Tx, projectId: string) {
  const row = await tx.project.findUniqueOrThrow({ where: { id: projectId }, include: { tasks: true } });
  const project = toProject(row);
  return { project, progress: computeProgress(project, row.tasks.map(toTask)) };
}

async function addLog(tx: Tx, projectId: string, kind: LogKind, note: string, date: ISODate) {
  const { progress } = await loadProgress(tx, projectId);
  await tx.progressLog.create({
    data: { projectId, kind, note, date: toDate(date), progress: round1(progress) },
  });
  return progress;
}

/** Done at 100%, reopened below it. */
async function syncCompletion(tx: Tx, projectId: string, progress: number, date: ISODate) {
  const row = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
  if (progress >= 100 && row.status !== "done") {
    await tx.project.update({ where: { id: projectId }, data: { status: "done", completedAt: toDate(date) } });
  } else if (progress < 100 && row.status === "done") {
    await tx.project.update({ where: { id: projectId }, data: { status: "active", completedAt: null } });
  }
}

/** Records a "scope change" snapshot when editing tasks moved overall progress. */
async function logScopeChange(tx: Tx, projectId: string, before: number, note: string, today: ISODate) {
  const { progress: after } = await loadProgress(tx, projectId);
  if (Math.abs(after - before) < 0.05) return;
  await addLog(tx, projectId, "scope", note, today);
  await syncCompletion(tx, projectId, after, today);
}

/**
 * Inserts projects, tasks and logs for `userId` with fresh ids, so the same data can be added
 * twice, or next to anyone else's, without primary-key clashes. Call inside a transaction.
 */
async function insertAll(tx: Tx, userId: string, data: Database) {
  const ids = new Map<string, string>(data.projects.map((p) => [p.id, randomUUID()]));
  const projectId = (old: string) => ids.get(old)!;
  await tx.project.createMany({
    data: data.projects.map((p) => ({
      ...p,
      id: projectId(p.id),
      userId,
      startDate: toDate(p.startDate),
      targetDate: toDate(p.targetDate),
      completedAt: p.completedAt ? toDate(p.completedAt) : null,
      createdAt: new Date(p.createdAt),
    })),
  });
  await tx.task.createMany({
    data: data.tasks.map((t) => ({ ...t, id: randomUUID(), projectId: projectId(t.projectId) })),
  });
  await tx.progressLog.createMany({
    data: data.logs.map((l) => ({
      ...l,
      id: randomUUID(),
      projectId: projectId(l.projectId),
      date: toDate(l.date),
      createdAt: new Date(l.createdAt),
    })),
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every method's first argument is the user id. Prisma treats `where: { userId: undefined }`
 * as "no filter", so a missing id would silently act on everyone's rows — refuse instead.
 */
function guardUserId<T extends Record<string, (...args: never[]) => unknown>>(methods: T): T {
  const guarded = {} as Record<string, unknown>;
  for (const [name, fn] of Object.entries(methods)) {
    guarded[name] = (...args: unknown[]) => {
      if (typeof args[0] !== "string" || !UUID_RE.test(args[0])) {
        throw new Error(`service.${name} called without a valid user id`);
      }
      return (fn as (...a: unknown[]) => unknown)(...args);
    };
  }
  return guarded as T;
}

export function createService(db: Db) {
  return guardUserId({
    async listViews(userId: string, today: ISODate): Promise<ProjectView[]> {
      const rows = await db.project.findMany({ where: { userId }, include: viewInclude });
      return rows
        .map((row) => toView(row, today))
        .sort(
          (a, b) =>
            HEALTH_PRIORITY[a.forecast.health] - HEALTH_PRIORITY[b.forecast.health] ||
            a.project.targetDate.localeCompare(b.project.targetDate),
        );
    },

    async getView(userId: string, id: string, today: ISODate): Promise<ProjectView> {
      const row = await db.project.findFirst({ where: { id, userId }, include: viewInclude });
      if (!row) throw notFound(PROJECT_NOT_FOUND);
      return toView(row, today);
    },

    async createProject(userId: string, input: z.output<typeof S.createProjectInput>, today: ISODate, lang: Lang): Promise<string> {
      const { tasks, manualProgress, ...fields } = input;
      return db.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            ...fields,
            userId,
            startDate: toDate(fields.startDate),
            targetDate: toDate(fields.targetDate),
            manualProgress: tasks.length ? 0 : manualProgress,
            tasks: { create: tasks.map((t, order) => ({ ...t, order })) },
          },
        });
        if (!tasks.length && manualProgress > 0) {
          await addLog(tx, project.id, "update", pick(lang, "Starting progress", "ความคืบหน้าเริ่มต้น"), today);
        }
        return project.id;
      });
    },

    async updateProject(userId: string, id: string, input: z.output<typeof S.projectInput>) {
      const { count } = await db.project.updateMany({
        where: { id, userId },
        data: { ...input, startDate: toDate(input.startDate), targetDate: toDate(input.targetDate) },
      });
      if (!count) throw notFound(PROJECT_NOT_FOUND);
    },

    async setStatus(userId: string, id: string, status: ProjectStatus, today: ISODate) {
      const { count } = await db.project.updateMany({
        where: { id, userId },
        data: { status, completedAt: status === "done" ? toDate(today) : null },
      });
      if (!count) throw notFound(PROJECT_NOT_FOUND);
    },

    async deleteProject(userId: string, id: string) {
      // Tasks and logs cascade.
      const { count } = await db.project.deleteMany({ where: { id, userId } });
      if (!count) throw notFound(PROJECT_NOT_FOUND);
    },

    async addTasks(userId: string, projectId: string, tasks: z.output<typeof S.taskInput>[], today: ISODate, lang: Lang) {
      await db.$transaction(async (tx) => {
        await assertProject(tx, userId, projectId);
        const { progress: before } = await loadProgress(tx, projectId);
        const last = await tx.task.aggregate({ where: { projectId }, _max: { order: true } });
        let order = last._max.order ?? -1;
        await tx.task.createMany({ data: tasks.map((t) => ({ ...t, projectId, order: ++order })) });
        const n = tasks.length;
        const label = n === 1 ? tasks[0].title : pick(lang, `${n} tasks`, `${n} งาน`);
        await logScopeChange(tx, projectId, before, pick(lang, `Added task: ${label}`, `เพิ่มงาน: ${label}`), today);
      });
      return bi(`Added ${tasks.length} task${tasks.length === 1 ? "" : "s"}`, `เพิ่ม ${tasks.length} งานแล้ว`);
    },

    async updateTask(userId: string, taskId: string, input: z.output<typeof S.taskInput>, today: ISODate, lang: Lang) {
      await db.$transaction(async (tx) => {
        const task = await ownedTask(tx, userId, taskId);
        const { progress: before } = await loadProgress(tx, task.projectId);
        await tx.task.update({ where: { id: taskId }, data: input });
        await logScopeChange(tx, task.projectId, before, pick(lang, `Resized task: ${input.title}`, `ปรับขนาดงาน: ${input.title}`), today);
      });
    },

    async moveTask(userId: string, taskId: string, direction: -1 | 1) {
      await db.$transaction(async (tx) => {
        const task = await ownedTask(tx, userId, taskId);
        const siblings = await tx.task.findMany({ where: { projectId: task.projectId }, orderBy: { order: "asc" } });
        const i = siblings.findIndex((t) => t.id === taskId);
        const other = siblings[i + direction];
        if (!other) return;
        await tx.task.update({ where: { id: task.id }, data: { order: other.order } });
        await tx.task.update({ where: { id: other.id }, data: { order: task.order } });
      });
    },

    async deleteTask(userId: string, taskId: string, today: ISODate, lang: Lang) {
      await db.$transaction(async (tx) => {
        const task = await ownedTask(tx, userId, taskId);
        const { progress: before } = await loadProgress(tx, task.projectId);
        await tx.task.delete({ where: { id: taskId } });
        await logScopeChange(tx, task.projectId, before, pick(lang, `Removed task: ${task.title}`, `ลบงาน: ${task.title}`), today);
      });
    },

    async submitProgress(
      userId: string,
      projectId: string,
      input: z.output<typeof S.progressInput>,
      today: ISODate,
    ): Promise<string> {
      const date = input.date ?? today;
      if (date > today) throw badRequest(bi("You can't record progress for a future date", "บันทึกล่วงหน้าไม่ได้"));

      return db.$transaction(async (tx) => {
        await assertProject(tx, userId, projectId);
        const { project, progress: before } = await loadProgress(tx, projectId);
        const tasks = await tx.task.findMany({ where: { projectId }, orderBy: { order: "asc" } });
        const moved: string[] = [];

        if (tasks.length) {
          for (const t of tasks) {
            const v = input.tasks?.[t.id];
            if (v === undefined) continue;
            const next = Math.round(clampPct(v));
            if (next === t.progress) continue;
            moved.push(`${t.title} ${t.progress}→${next}%`);
            await tx.task.update({ where: { id: t.id }, data: { progress: next } });
          }
        } else if (input.manual !== undefined) {
          await tx.project.update({ where: { id: projectId }, data: { manualProgress: round1(clampPct(input.manual)) } });
        }

        const { progress: after } = await loadProgress(tx, projectId);
        const changed = Math.abs(after - before) >= 0.05;
        if (!changed && !input.note) {
          throw badRequest(bi("Nothing changed yet — adjust progress or write a note first", "ยังไม่มีอะไรเปลี่ยน — ปรับความคืบหน้าหรือเขียนบันทึกก่อน"));
        }
        if (project.status === "paused") {
          await tx.project.update({ where: { id: projectId }, data: { status: "active" } });
        }
        await addLog(tx, projectId, "update", input.note || moved.join(", "), date);
        await syncCompletion(tx, projectId, after, date);
        return changed ? bi("Progress saved", "บันทึกความคืบหน้าแล้ว") : bi("Note saved", "บันทึก Note แล้ว");
      });
    },

    async deleteLog(userId: string, logId: string) {
      const { count } = await db.progressLog.deleteMany({ where: { id: logId, project: { userId } } });
      if (!count) throw notFound(bi("History entry not found", "ไม่พบประวัตินี้"));
    },

    // ---------- Backup ----------

    async exportAll(userId: string): Promise<Database> {
      const [projects, tasks, logs] = await Promise.all([
        db.project.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
        db.task.findMany({ where: { project: { userId } }, orderBy: [{ projectId: "asc" }, { order: "asc" }] }),
        db.progressLog.findMany({ where: { project: { userId } }, orderBy: [{ projectId: "asc" }, { date: "asc" }] }),
      ]);
      return { version: 1, projects: projects.map(toProject), tasks: tasks.map(toTask), logs: logs.map(toLog) };
    },

    /**
     * Adds `data` next to this user's existing projects (e.g. sample data) in one transaction.
     * Ids are regenerated, so it never clashes with what's already there.
     */
    async addAll(userId: string, data: Database) {
      await db.$transaction((tx) => insertAll(tx, userId, data));
    },

    /** Replaces this user's data in one transaction — all or nothing (restoring a backup). */
    async replaceAll(userId: string, data: Database) {
      await db.$transaction(async (tx) => {
        await tx.project.deleteMany({ where: { userId } }); // tasks + logs cascade
        await insertAll(tx, userId, data);
      });
    },

    async counts(userId: string) {
      const [projects, tasks, logs] = await Promise.all([
        db.project.count({ where: { userId } }),
        db.task.count({ where: { project: { userId } } }),
        db.progressLog.count({ where: { project: { userId } } }),
      ]);
      return { projects, tasks, logs };
    },
  });
}

export type Service = ReturnType<typeof createService>;
