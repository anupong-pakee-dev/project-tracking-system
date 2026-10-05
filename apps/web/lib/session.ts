import "server-only";
import type { SessionResponse } from "@tracker/shared/api";
import { cookies } from "next/headers";

/** httpOnly cookie holding the API session token. Also read by proxy.ts (keep the name in sync). */
export const SESSION_COOKIE = "tracker_session";

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Only callable from Server Actions / Route Handlers. */
export async function setSession(session: SessionResponse): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Only allow same-site relative paths as post-login destinations. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
