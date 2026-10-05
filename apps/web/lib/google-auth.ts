import "server-only";
import type { T } from "./i18n";
import type { AuthProviders } from "@tracker/shared/api";
import { api } from "./api";

/** Holds `state`, the PKCE verifier and `next` between /auth/google and its callback. */
export const GOOGLE_COOKIE = "tracker_google";
export const GOOGLE_COOKIE_PATH = "/auth/google";

export interface GoogleCookie {
  state: string;
  codeVerifier: string;
  next: string;
}

/**
 * Why Google sign-in ended back on /login (`?error=<code>`). Only these fixed messages are
 * shown, so a crafted link can't put arbitrary text on the page.
 */
const GOOGLE_ERRORS: Record<string, [en: string, th: string]> = {
  GOOGLE_CANCELLED: ["Google sign-in was cancelled", "ยกเลิกการเข้าสู่ระบบด้วย Google แล้ว"],
  GOOGLE_STATE: ["Google sign-in timed out or was invalid — please try again", "การเข้าสู่ระบบด้วย Google หมดเวลาหรือไม่ถูกต้อง ลองใหม่อีกครั้ง"],
  GOOGLE_DISABLED: ["Google sign-in isn't enabled on this system", "ระบบนี้ยังไม่ได้เปิดการเข้าสู่ระบบด้วย Google"],
  GOOGLE_EMAIL_UNVERIFIED: [
    "This Google account's email isn't verified — use another account, or sign up with email and password",
    "บัญชี Google นี้ยังไม่ได้ยืนยัน Email — ใช้บัญชีอื่น หรือสมัครด้วย Email และรหัสผ่าน",
  ],
  GOOGLE_ACCOUNT_MISMATCH: [
    "This email is already linked to a different Google account — sign in with your password instead",
    "Email นี้ผูกกับบัญชี Google อื่นอยู่แล้ว — เข้าสู่ระบบด้วยรหัสผ่านแทน",
  ],
  RATE_LIMITED: ["Too many attempts — please wait a moment and try again", "ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่"],
  GOOGLE_FAILED: ["Google sign-in failed — please try again", "เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองใหม่อีกครั้ง"],
};

export function googleErrorMessage(code: unknown, t: T): string | undefined {
  if (typeof code !== "string") return undefined;
  const [en, th] = GOOGLE_ERRORS[code] ?? GOOGLE_ERRORS.GOOGLE_FAILED;
  return t(en, th);
}

/** Sign-in methods the API has switched on. If the API can't be reached, show only email + password. */
export async function getAuthProviders(): Promise<AuthProviders> {
  try {
    return await api<AuthProviders>("GET", "/auth/providers");
  } catch {
    return { google: false };
  }
}
