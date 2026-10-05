"use server";

import type { MessageBody, SessionResponse } from "@tracker/shared/api";
import { redirect } from "next/navigation";
import type { FormState } from "./actions";
import { api, ApiError } from "./api";
import { clearSession, safeNext, setSession } from "./session";
import { getT } from "./i18n-server";

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

/** API errors become form errors (with the API's code, e.g. EMAIL_NOT_VERIFIED). */
async function attempt(fn: () => Promise<FormState>): Promise<FormState> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, code: err.code };
    throw err;
  }
}

async function checkConfirm(fd: FormData): Promise<FormState | null> {
  return str(fd, "password") !== str(fd, "confirm") ? { error: (await getT())("The two passwords don't match", "รหัสผ่านทั้งสองช่องไม่ตรงกัน") } : null;
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const result = await attempt(async () => {
    await setSession(
      await api<SessionResponse>("POST", "/auth/login", { email: str(fd, "email"), password: str(fd, "password") }),
    );
    return {};
  });
  if (result.error) return result;
  redirect(safeNext(fd.get("next")));
}

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const mismatch = await checkConfirm(fd);
  if (mismatch) return mismatch;
  const email = str(fd, "email").trim();
  const result = await attempt(async () => {
    await api<MessageBody>("POST", "/auth/register", { email, password: str(fd, "password") });
    return {};
  });
  if (result.error) return result;
  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

export async function resendVerification(_: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { message } = await api<MessageBody>("POST", "/auth/resend-verification", { email: str(fd, "email") });
    return { message, savedAt: Date.now() };
  });
}

export async function verifyEmail(_: FormState, fd: FormData): Promise<FormState> {
  const result = await attempt(async () => {
    await setSession(await api<SessionResponse>("POST", "/auth/verify-email", { token: str(fd, "token") }));
    return {};
  });
  if (result.error) return result;
  redirect("/?welcome=1");
}

export async function forgotPassword(_: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const { message } = await api<MessageBody>("POST", "/auth/forgot-password", { email: str(fd, "email") });
    return { message, savedAt: Date.now() };
  });
}

export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  const mismatch = await checkConfirm(fd);
  if (mismatch) return mismatch;
  const result = await attempt(async () => {
    await setSession(
      await api<SessionResponse>("POST", "/auth/reset-password", {
        token: str(fd, "token"),
        password: str(fd, "password"),
      }),
    );
    return {};
  });
  if (result.error) return result;
  redirect("/?reset=1");
}

export async function logout(): Promise<void> {
  try {
    await api("POST", "/auth/logout");
  } catch {
    // Already invalid on the API side — just drop the cookie.
  }
  await clearSession();
  redirect("/login");
}
