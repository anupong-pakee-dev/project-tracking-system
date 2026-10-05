import type { AuthUser, SessionResponse } from "@tracker/shared/api";
import { bi, type Lang } from "@tracker/shared/i18n";
import type { Db } from "../db.ts";
import { badRequest, HttpError, unauthorized } from "../errors.ts";
import type { Email, Mailer } from "../mailer.ts";
import { DUMMY_HASH, hashPassword, hashToken, newToken, verifyPassword } from "./crypto.ts";
import * as emails from "./emails.ts";
import { newPkce, type GoogleOAuth } from "./google.ts";

const DAY = 86_400_000;
export const SESSION_TTL_MS = 30 * DAY;
const VERIFY_TTL_MS = DAY;
const RESET_TTL_MS = 60 * 60_000;
/** Don't send the same kind of email to one user more often than this. */
const EMAIL_COOLDOWN_MS = 60_000;
/** Only touch `last_used_at` this often. */
const TOUCH_EVERY_MS = 60 * 60_000;

export interface AuthOptions {
  db: Db;
  mailer: Mailer;
  /** Public URL of apps/web, used in email links. */
  appUrl: string;
  /** Explains, server-side only, why an email was not sent (the client always gets the same answer). */
  log?: { info(obj: object, msg: string): void };
  /** Google sign-in; null when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET aren't set. */
  google?: GoogleOAuth | null;
}

const googleDisabled = () => new HttpError(404, bi("Google sign-in isn't enabled on this system", "ระบบนี้ยังไม่ได้เปิดการเข้าสู่ระบบด้วย Google"), "GOOGLE_DISABLED");

const toUser = (u: { id: string; email: string }): AuthUser => ({ id: u.id, email: u.email });

/** "anuphong4407@gmail.com" → "an***@gmail.com" for logs. */
export const maskEmail = (email: string) => email.replace(/^(.{0,2})[^@]*/, "$1***");

export function createAuthService({ db, mailer, appUrl, log, google = null }: AuthOptions) {
  const skipped = (action: string, email: string, reason: string) =>
    log?.info({ action, email: maskEmail(email), reason }, `${action}: email not sent (${reason})`);

  const link = (path: string, token?: string) =>
    `${appUrl}${path}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

  async function sendMail(email: Email) {
    try {
      await mailer.send(email);
    } catch (err) {
      throw Object.assign(new HttpError(502, bi("Couldn't send the email — please try again later", "ส่ง Email ไม่สำเร็จ ลองใหม่อีกครั้งในภายหลัง")), { cause: err });
    }
  }

  /** Creates a single-use email token unless one of the same type was sent very recently. */
  async function issueToken(userId: string, type: "verify_email" | "reset_password"): Promise<string | null> {
    const recent = await db.authToken.findFirst({
      where: { userId, type, createdAt: { gt: new Date(Date.now() - EMAIL_COOLDOWN_MS) } },
    });
    if (recent) return null;
    // Housekeeping: drop this user's spent or expired tokens older than a day.
    await db.authToken.deleteMany({
      where: {
        userId,
        createdAt: { lt: new Date(Date.now() - DAY) },
        OR: [{ usedAt: { not: null } }, { expiresAt: { lt: new Date() } }],
      },
    });
    const { token, hash } = newToken();
    const ttl = type === "verify_email" ? VERIFY_TTL_MS : RESET_TTL_MS;
    await db.authToken.create({ data: { userId, type, tokenHash: hash, expiresAt: new Date(Date.now() + ttl) } });
    return token;
  }

  /** Validates and consumes a token; also invalidates other unused tokens of that type. */
  async function consumeToken(token: string, type: "verify_email" | "reset_password") {
    const row = await db.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) {
      throw badRequest(
        type === "verify_email"
          ? bi("This verification link is invalid or has expired — request a new one from the sign-in page", "Link ยืนยันไม่ถูกต้องหรือหมดอายุแล้ว — ขอ Link ใหม่จากหน้าเข้าสู่ระบบ")
          : bi("This password link is invalid or has expired — request a new one", "Link ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว — ขอ Link ใหม่อีกครั้ง"),
        "INVALID_TOKEN",
      );
    }
    await db.authToken.updateMany({ where: { userId: row.userId, type, usedAt: null }, data: { usedAt: new Date() } });
    return row.userId;
  }

  /** Sets email_verified_at once. The first verified account adopts projects made before accounts existed. */
  async function markVerified(userId: string) {
    await db.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.emailVerifiedAt) return;
      await tx.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
      const otherVerified = await tx.user.count({ where: { emailVerifiedAt: { not: null }, id: { not: userId } } });
      if (otherVerified === 0) {
        await tx.project.updateMany({ where: { userId: null }, data: { userId } });
      }
    });
  }

  async function createSession(userId: string, userAgent?: string): Promise<SessionResponse> {
    const { token, hash } = newToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    // Housekeeping: drop this user's expired sessions.
    await db.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
    await db.session.create({
      data: { userId, tokenHash: hash, expiresAt, userAgent: userAgent?.slice(0, 300) },
    });
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    return { token, expiresAt: expiresAt.toISOString(), user: toUser(user) };
  }

  return {
    async register(email: string, password: string, lang: Lang): Promise<void> {
      const existing = await db.user.findUnique({ where: { email } });

      if (!existing) {
        const user = await db.user.create({ data: { email, passwordHash: await hashPassword(password) } });
        const token = await issueToken(user.id, "verify_email");
        if (token) await sendMail(emails.verifyEmail(email, link("/verify-email", token), lang));
        return;
      }
      // Same response either way, so the form doesn't reveal which emails have accounts.
      // An unverified account keeps its original password (the new one may be from someone else).
      if (!existing.emailVerifiedAt) {
        const token = await issueToken(existing.id, "verify_email");
        if (token) await sendMail(emails.verifyEmail(email, link("/verify-email", token), lang));
      } else {
        await sendMail(emails.alreadyRegistered(email, link("/login"), link("/forgot-password"), lang));
      }
    },

    async login(email: string, password: string, userAgent?: string): Promise<SessionResponse> {
      const user = await db.user.findUnique({ where: { email } });
      // Accounts made with Google have no password until they set one via "forgot password".
      const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !ok) throw new HttpError(401, bi("Incorrect email or password", "Email หรือรหัสผ่านไม่ถูกต้อง"), "INVALID_CREDENTIALS");
      if (!user.emailVerifiedAt) {
        throw new HttpError(403, bi("Please verify your email before signing in — check your inbox", "กรุณายืนยัน Email ก่อนเข้าสู่ระบบ — ตรวจกล่องจดหมายของคุณ"), "EMAIL_NOT_VERIFIED");
      }
      return createSession(user.id, userAgent);
    },

    /** Where to send the browser for Google sign-in. apps/web keeps `state` and `codeVerifier` in a cookie. */
    googleStart(): { url: string; state: string; codeVerifier: string } {
      if (!google) throw googleDisabled();
      const state = newToken().token;
      const { codeVerifier, codeChallenge } = newPkce();
      return { url: google.authUrl({ state, codeChallenge }), state, codeVerifier };
    },

    /**
     * Signs in (or up) with the code Google redirected back with. Matches the Google account
     * first, then the email: an existing account with the same address is linked to it.
     */
    async googleSignIn(code: string, codeVerifier: string, userAgent?: string): Promise<SessionResponse> {
      if (!google) throw googleDisabled();
      const profile = await google.exchange(code, codeVerifier);
      if (!profile.emailVerified) {
        throw badRequest(bi("This Google account's email isn't verified — use another account, or sign up with email and password", "บัญชี Google นี้ยังไม่ได้ยืนยัน Email — ใช้บัญชีอื่น หรือสมัครด้วย Email และรหัสผ่าน"), "GOOGLE_EMAIL_UNVERIFIED");
      }

      const linked = await db.user.findUnique({ where: { googleId: profile.sub } });
      if (linked) return createSession(linked.id, userAgent);

      const existing = await db.user.findUnique({ where: { email: profile.email } });
      if (!existing) {
        const user = await db.user.create({ data: { email: profile.email, googleId: profile.sub } });
        await markVerified(user.id);
        return createSession(user.id, userAgent);
      }
      if (existing.googleId) {
        // The email belongs to an account already linked to a different Google account.
        throw new HttpError(409, bi("This email is already linked to a different Google account — sign in with your password instead", "Email นี้ผูกกับบัญชี Google อื่นอยู่แล้ว — เข้าสู่ระบบด้วยรหัสผ่านแทน"), "GOOGLE_ACCOUNT_MISMATCH");
      }
      // An unverified account's password may have been set by someone else who typed this
      // email (the real owner never confirmed it), so drop it — Google just proved ownership.
      await db.user.update({
        where: { id: existing.id },
        data: { googleId: profile.sub, ...(existing.emailVerifiedAt ? {} : { passwordHash: null }) },
      });
      await markVerified(existing.id);
      return createSession(existing.id, userAgent);
    },

    async logout(sessionToken: string): Promise<void> {
      await db.session.deleteMany({ where: { tokenHash: hashToken(sessionToken) } });
    },

    /** Resolves a session cookie to its user, or throws 401. */
    async authenticate(sessionToken: string | undefined): Promise<AuthUser> {
      if (!sessionToken) throw unauthorized();
      const session = await db.session.findUnique({
        where: { tokenHash: hashToken(sessionToken) },
        include: { user: true },
      });
      if (!session) throw unauthorized();
      if (session.expiresAt < new Date()) {
        await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
        throw unauthorized(bi("Your session has expired — please sign in again", "Session หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง"));
      }
      if (Date.now() - session.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
        await db.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
      }
      return toUser(session.user);
    },

    /** Marks the email verified and logs the user in. The first verified account adopts pre-account projects. */
    async verifyEmail(token: string, userAgent?: string): Promise<SessionResponse> {
      const userId = await consumeToken(token, "verify_email");
      await markVerified(userId);
      return createSession(userId, userAgent);
    },

    async resendVerification(email: string, lang: Lang): Promise<void> {
      const user = await db.user.findUnique({ where: { email } });
      if (!user) return skipped("resend-verification", email, "no account with this email");
      if (user.emailVerifiedAt) return skipped("resend-verification", email, "already verified");
      const token = await issueToken(user.id, "verify_email");
      if (!token) return skipped("resend-verification", email, "cooldown — one email per 60s");
      await sendMail(emails.verifyEmail(email, link("/verify-email", token), lang));
    },

    async forgotPassword(email: string, lang: Lang): Promise<void> {
      const user = await db.user.findUnique({ where: { email } });
      if (!user) return skipped("forgot-password", email, "no account with this email");
      const token = await issueToken(user.id, "reset_password");
      if (!token) return skipped("forgot-password", email, "cooldown — one email per 60s");
      await sendMail(emails.resetPassword(email, link("/reset-password", token), lang));
    },

    /** Sets a new password, signs out every other session, and logs in. */
    async resetPassword(token: string, password: string, userAgent?: string): Promise<SessionResponse> {
      const userId = await consumeToken(token, "reset_password");
      await db.$transaction([
        db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } }),
        db.session.deleteMany({ where: { userId } }),
      ]);
      // Receiving the reset email also proves the address is theirs.
      await markVerified(userId);
      return createSession(userId, userAgent);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
