import "server-only";
import type { AuthUser, ProjectView } from "@tracker/shared/api";
import { cache } from "react";
import { api, ApiError } from "./api";

/** The signed-in user (redirects to /login if the session is invalid). Deduped per request. */
export const getCurrentUser = cache(() => api<AuthUser>("GET", "/auth/me"));

/** Sorted with the projects that need attention first. */
export function getProjectViews(): Promise<ProjectView[]> {
  return api<ProjectView[]>("GET", "/projects");
}

export async function getProjectView(id: string): Promise<ProjectView | null> {
  try {
    return await api<ProjectView>("GET", `/projects/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function getStats(): Promise<{ projects: number; tasks: number; logs: number }> {
  return api("GET", "/stats");
}
