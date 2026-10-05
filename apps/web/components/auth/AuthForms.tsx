"use client";

import Link from "next/link";
import { useState } from "react";
import {
  forgotPassword,
  login,
  register,
  resendVerification,
  resetPassword,
  verifyEmail,
} from "@/lib/auth-actions";
import { FormMessage } from "../ActionButton";
import { useT } from "../LangProvider";
import { useFormAction } from "../useFormAction";

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  defaultValue,
  hint,
  minLength,
  onValue,
  aside,
}: {
  aside?: React.ReactNode;
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  hint?: string;
  minLength?: number;
  onValue?: (value: string) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={name} className="label">{label}</label>
        {aside}
      </div>
      <input
        id={name}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        minLength={minLength}
        onChange={onValue ? (e) => onValue(e.target.value) : undefined}
        maxLength={type === "password" ? 128 : 254}
        className="input"
      />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  const t = useT();
  return (
    <button type="submit" className="btn btn-primary mt-1 w-full py-2.5 text-[15px]" disabled={pending}>
      {pending ? t("Working…", "กำลังดำเนินการ…") : children}
    </button>
  );
}

/** "Continue with Google" — a plain link: /auth/google is a Route Handler that redirects to Google. */
function GoogleSignIn({ next }: { next?: string }) {
  const t = useT();
  const href = next && next !== "/" ? `/auth/google?next=${encodeURIComponent(next)}` : "/auth/google";
  return (
    <>
      <a href={href} className="btn w-full gap-2.5 py-2.5 text-[15px]">
        <svg aria-hidden viewBox="0 0 48 48" className="size-[18px] shrink-0">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        {t("Continue with Google", "ดำเนินการต่อด้วย Google")}
      </a>
      <div className="flex items-center gap-3 text-xs text-faint" role="separator">
        <span className="h-px flex-1 bg-line" />
        {t("or use email", "หรือใช้ Email")}
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

/** Small inline form: "send the verification link again". */
export function ResendVerification({ email, label }: { email: string; label?: string }) {
  const t = useT();
  const { state, onSubmit, pending } = useFormAction(resendVerification);
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="email" value={email} />
      <button type="submit" className="btn w-full" disabled={pending || !email}>{label ?? t("Send the verification link again", "ส่ง Link ยืนยันอีกครั้ง")}</button>
      <FormMessage error={state.error} message={state.message} />
    </form>
  );
}

export function LoginForm({
  next,
  notice,
  error,
  google,
}: {
  next: string;
  notice?: string;
  /** From a failed Google sign-in (shown until the form is submitted). */
  error?: string;
  google?: boolean;
}) {
  const t = useT();
  const { state, onSubmit, pending } = useFormAction(login);
  const [email, setEmail] = useState("");

  return (
    <div className="space-y-5">
      {error && !state.error && <FormMessage error={error} />}
      {google && <GoogleSignIn next={next} />}
      <form onSubmit={onSubmit} className="space-y-[18px]">
        <input type="hidden" name="next" value={next} />
        {notice && !state.error && <FormMessage message={notice} />}
        <Field label={t("Email", "Email")} name="email" type="email" autoComplete="email" onValue={setEmail} />
        <Field
          label={t("Password", "รหัสผ่าน")}
          name="password"
          type="password"
          autoComplete="current-password"
          aside={<Link href="/forgot-password" className="text-[13px] font-medium text-accent hover:underline">{t("Forgot password?", "ลืมรหัสผ่าน?")}</Link>}
        />
        <FormMessage error={state.error} />
        <Submit pending={pending}>{t("Sign in", "เข้าสู่ระบบ")}</Submit>
      </form>
      {state.code === "EMAIL_NOT_VERIFIED" && <ResendVerification email={email} />}
      <p className="text-center text-sm text-muted">
        {t("No account yet?", "ยังไม่มีบัญชี?")}{" "}
        <Link href="/register" className="font-semibold text-accent hover:underline">{t("Sign up", "สมัครสมาชิก")}</Link>
      </p>
    </div>
  );
}

export function RegisterForm({ google }: { google?: boolean }) {
  const t = useT();
  const { state, onSubmit, pending } = useFormAction(register);
  return (
    <div className="space-y-5">
      {google && <GoogleSignIn />}
      <form onSubmit={onSubmit} className="space-y-[18px]">
        <Field label={t("Email", "Email")} name="email" type="email" autoComplete="email" />
        <Field label={t("Password", "รหัสผ่าน")} name="password" type="password" autoComplete="new-password" minLength={8} hint={t("At least 8 characters", "อย่างน้อย 8 ตัวอักษร")} />
        <Field label={t("Confirm password", "ยืนยันรหัสผ่าน")} name="confirm" type="password" autoComplete="new-password" minLength={8} />
        <FormMessage error={state.error} />
        <Submit pending={pending}>{t("Sign up", "สมัครสมาชิก")}</Submit>
        <p className="text-center text-sm text-muted">
          {t("Already have an account?", "มีบัญชีแล้ว?")}{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">{t("Sign in", "เข้าสู่ระบบ")}</Link>
        </p>
      </form>
    </div>
  );
}

export function VerifyEmailForm({ token }: { token: string }) {
  const t = useT();
  const { state, onSubmit, pending } = useFormAction(verifyEmail);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage error={state.error} />
      {state.code === "INVALID_TOKEN" ? (
        <Link href="/login" className="btn w-full">{t("Go to sign in", "ไปหน้าเข้าสู่ระบบ")}</Link>
      ) : (
        <Submit pending={pending}>{t("Verify email and sign in", "ยืนยัน Email และเข้าสู่ระบบ")}</Submit>
      )}
    </form>
  );
}

export function ForgotPasswordForm({ devMailUrl }: { devMailUrl?: string }) {
  const t = useT();
  const { state, onSubmit, pending } = useFormAction(forgotPassword);
  const [email, setEmail] = useState("");
  // The savedAt of a result the user chose to dismiss ("use a different email").
  const [dismissed, setDismissed] = useState<number | undefined>();

  if (state.message && state.savedAt !== dismissed) {
    return (
      <div className="space-y-4">
        <p role="status" className="soft bg-ok-soft px-3.5 py-3 text-sm leading-relaxed text-ok">
          {t(
            <>Request sent for <b className="break-all">{email}</b> — if it has an account, the link will arrive within a few minutes.</>,
            <>ส่งคำขอสำหรับ <b className="break-all">{email}</b> แล้ว — ถ้า Email นี้มีบัญชี Link จะไปถึงภายในไม่กี่นาที</>,
          )}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>{t("Check the address above is the one you signed up with (no account, no email).", "ตรวจว่า Email ด้านบนตรงกับที่ใช้สมัคร (ถ้าไม่มีบัญชี ระบบจะไม่ส่ง Email)")}</li>
          <li>{t("The link works for 1 hour · you can ask again every 60 seconds", "Link ใช้ได้ 1 ชั่วโมง · ขอใหม่ได้ทุก 60 วินาที")}</li>
          <li>{t("Can't see it? Check your spam folder", "ถ้าไม่เห็น ลองดู Folder Spam")}</li>
        </ul>
        {devMailUrl && (
          <p className="soft bg-surface-2 px-3 py-2 text-xs text-muted">
            {t("Dev mode: email isn't really sent — open it in", "Mode พัฒนา: Email ไม่ได้ส่งออกไปจริง — เปิดดูใน")}{" "}
            <a href={devMailUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">Mailpit</a>
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn flex-1" onClick={() => setDismissed(state.savedAt)}>{t("Use another email", "ใช้ Email อื่น")}</button>
          <Link href="/login" className="btn flex-1">{t("Back to sign in", "กลับไปเข้าสู่ระบบ")}</Link>
        </div>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label={t("Email", "Email")} name="email" type="email" autoComplete="email" defaultValue={email} onValue={setEmail} />
      <FormMessage error={state.error} />
      <Submit pending={pending}>{t("Send reset link", "ส่ง Link ตั้งรหัสผ่านใหม่")}</Submit>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-accent hover:underline">{t("Back to sign in", "กลับไปหน้าเข้าสู่ระบบ")}</Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useT();
  const { state, onSubmit, pending } = useFormAction(resetPassword);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label={t("New password", "รหัสผ่านใหม่")} name="password" type="password" autoComplete="new-password" minLength={8} hint={t("At least 8 characters", "อย่างน้อย 8 ตัวอักษร")} />
      <Field label={t("Confirm new password", "ยืนยันรหัสผ่านใหม่")} name="confirm" type="password" autoComplete="new-password" minLength={8} />
      <FormMessage error={state.error} />
      {state.code === "INVALID_TOKEN" ? (
        <Link href="/forgot-password" className="btn w-full">{t("Request a new link", "ขอ Link ใหม่")}</Link>
      ) : (
        <Submit pending={pending}>{t("Set new password", "ตั้งรหัสผ่านใหม่")}</Submit>
      )}
    </form>
  );
}
