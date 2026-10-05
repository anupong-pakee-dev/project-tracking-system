import "server-only";
import { todayISO } from "@tracker/shared/dates";
import { LANG_HEADER, pick } from "@tracker/shared/i18n";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLang } from "./i18n-server";
import { getSessionToken } from "./session";

const API_URL = (process.env.API_URL ?? (isProduction() ? "" : "http://127.0.0.1:4000")).replace(/\/$/, "");
const API_TOKEN = process.env.API_TOKEN;

function isProduction() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

/** Misconfiguration in production should be loud, not a mysterious "can't connect". */
function assertConfigured() {
  if (!API_URL) throw new Error("API_URL is not set — point it at the deployed apps/api (e.g. https://tracker-api.vercel.app).");
  if (isProduction() && !API_TOKEN) throw new Error("API_TOKEN is not set — use the same value as in apps/api.");
}

/** A failed API call. `message` is user-facing; `code` is the API's machine-readable reason. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** Endpoints that work without a session — a 401 from these is shown, not redirected. */
const PUBLIC_AUTH_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/verify-email",
  "/auth/resend-verification",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/providers",
  "/auth/google/start",
  "/auth/google",
]);

/**
 * Server-side call to apps/api. The browser never talks to the API directly.
 * Forwards the user's session, IP (for rate limits) and user agent. An expired session on a
 * non-auth call redirects to /login.
 */
export async function api<T = void>(method: Method, path: string, body?: unknown): Promise<T> {
  assertConfigured();
  const h: Record<string, string> = { "x-client-date": todayISO() };
  if (API_TOKEN) h.authorization = `Bearer ${API_TOKEN}`;
  if (body !== undefined) h["content-type"] = "application/json";

  const session = await getSessionToken();
  if (session) h["x-session-token"] = session;
  const lang = await getLang();
  h[LANG_HEADER] = lang;
  const incoming = await headers();
  const ip = incoming.get("x-forwarded-for")?.split(",")[0]?.trim() || incoming.get("x-real-ip");
  if (ip) h["x-client-ip"] = ip;
  const ua = incoming.get("user-agent");
  if (ua) h["x-client-user-agent"] = ua.slice(0, 300);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      503,
      pick(lang, `Can't reach the API (${API_URL}) — check that apps/api is running`, `เชื่อมต่อ API ไม่ได้ (${API_URL}) — ตรวจว่า apps/api กำลัง Run อยู่`),
    );
  }

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const { error, code } = (data ?? {}) as { error?: unknown; code?: unknown };
    if (res.status === 401 && code === "UNAUTHENTICATED" && !PUBLIC_AUTH_PATHS.has(path)) {
      redirect("/login?expired=1");
    }
    throw new ApiError(
      res.status,
      typeof error === "string" ? error : pick(lang, `The API returned an error (${res.status})`, `API ตอบกลับผิดพลาด (${res.status})`),
      typeof code === "string" ? code : undefined,
    );
  }
  return data as T;
}
