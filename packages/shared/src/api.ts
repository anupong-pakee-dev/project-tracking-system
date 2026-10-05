// Request/response contract between apps/web and apps/api.
import type { Forecast } from "./forecast.ts";
import type { ISODate, ProgressLog, Project, ProjectStatus, Task, TaskCategory, TaskPriority } from "./types.ts";

export interface ProjectView {
  project: Project;
  tasks: Task[];
  /** Newest first. */
  logs: ProgressLog[];
  forecast: Forecast;
}

export interface TaskInput {
  title: string;
  description?: string;
  weight: number;
  categories?: TaskCategory[];
  priority?: TaskPriority;
}

export interface ProjectInput {
  name: string;
  description: string;
  color: string;
  startDate: ISODate;
  targetDate: ISODate;
  skipWeekends: boolean;
}

export interface CreateProjectInput extends ProjectInput {
  /** Only used when no tasks are given. */
  manualProgress?: number;
  tasks?: TaskInput[];
}

export interface StatusInput {
  status: ProjectStatus;
}

export interface ProgressInput {
  date?: ISODate;
  note?: string;
  /** New overall % for projects without tasks. */
  manual?: number;
  /** taskId → new progress (0–100). */
  tasks?: Record<string, number>;
}

export interface MoveTaskInput {
  direction: -1 | 1;
}

/** Every non-2xx response has this shape. `error` is a user-facing (Thai) message. */
export interface ApiErrorBody {
  error: string;
  /** Machine-readable reason, e.g. "EMAIL_NOT_VERIFIED", "INVALID_TOKEN", "UNAUTHENTICATED". */
  code?: string;
}

// ---------- Auth ----------

export interface AuthUser {
  id: string;
  email: string;
}

/** Returned by login, verify-email and reset-password. `token` goes in the session cookie. */
export interface SessionResponse {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

export interface CredentialsInput {
  email: string;
  password: string;
}

export interface EmailInput {
  email: string;
}

export interface TokenInput {
  token: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface MessageBody {
  message: string;
}

/** Which sign-in methods besides email + password are switched on. */
export interface AuthProviders {
  google: boolean;
}

/** apps/web keeps `state` and `codeVerifier` in a short-lived cookie, then redirects to `url`. */
export interface GoogleStartResponse {
  url: string;
  state: string;
  codeVerifier: string;
}

export interface GoogleCallbackInput {
  code: string;
  codeVerifier: string;
}
