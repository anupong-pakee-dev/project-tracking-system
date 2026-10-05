// Convert between Prisma rows and the shared API types. Calendar dates travel as
// `YYYY-MM-DD` strings and are stored in Postgres DATE columns (UTC midnight in JS).
import type { ISODate, ProgressLog, Project, Task } from "@tracker/shared/types";
import type * as Row from "./generated/prisma/client.ts";

export const toDate = (iso: ISODate): Date => new Date(`${iso}T00:00:00Z`);
export const toISO = (d: Date): ISODate => d.toISOString().slice(0, 10);

export function toProject(r: Row.Project): Project {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    startDate: toISO(r.startDate),
    targetDate: toISO(r.targetDate),
    status: r.status,
    skipWeekends: r.skipWeekends,
    manualProgress: r.manualProgress,
    completedAt: r.completedAt ? toISO(r.completedAt) : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toTask(r: Row.Task): Task {
  return {
    id: r.id,
    projectId: r.projectId,
    title: r.title,
    description: r.description,
    weight: r.weight,
    progress: r.progress,
    order: r.order,
    categories: r.categories,
    priority: r.priority,
  };
}

export function toLog(r: Row.ProgressLog): ProgressLog {
  return {
    id: r.id,
    projectId: r.projectId,
    date: toISO(r.date),
    progress: r.progress,
    note: r.note,
    kind: r.kind,
    createdAt: r.createdAt.toISOString(),
  };
}
