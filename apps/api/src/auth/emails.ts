import { pick, type Lang } from "@tracker/shared/i18n";
import type { Email } from "../mailer.ts";

const escape = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const C = {
  page: "#f4f3ef", card: "#ffffff", line: "#e7e5e0", soft: "#f7f6f3",
  text: "#2b2e35", muted: "#646a73", faint: "#8d929a", accent: "#2a7f7a", accentFg: "#ffffff",
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','Leelawadee UI',Tahoma,Helvetica,Arial,sans-serif";

function layout(o: {
  preheader: string; eyebrow: string; title: string; intro: string[];
  button?: { label: string; url: string }; facts?: [string, string][]; note: string[]; to: string;
  /** [English, Thai] — why this address got the email. */
  reason: [string, string];
  lang: Lang;
}): string {
  const t = (en: string, th: string) => pick(o.lang, en, th);
  const p = (t: string, extra = "") => '<p style="margin:0 0 14px;font-family:' + FONT + ';font-size:15px;line-height:24px;mso-line-height-rule:exactly;color:' + C.text + ';' + extra + '">' + t + "</p>";
  // Served by apps/web from public/email-logo.png — same origin as the links in the email.
  const logo = o.button ? escape(new URL(o.button.url).origin + "/email-logo.png") : "";
  const intro = o.intro.map((t) => p(escape(t))).join("");
  const button = o.button
    ? '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 8px"><tr><td align="center" bgcolor="' + C.accent + '" style="border-radius:10px;background:' + C.accent + '">' +
      '<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="' + escape(o.button.url) + '" style="height:46px;v-text-anchor:middle;width:240px" arcsize="22%" stroke="f" fillcolor="' + C.accent + '"><center style="color:#ffffff;font-family:Tahoma,sans-serif;font-size:15px;font-weight:bold">' + escape(o.button.label) + '</center></v:roundrect><![endif]-->' +
      '<!--[if !mso]><!--><a href="' + escape(o.button.url) + '" target="_blank" style="display:block;padding:13px 28px;font-family:' + FONT + ';font-size:15px;line-height:20px;font-weight:600;color:' + C.accentFg + ';text-decoration:none;border-radius:10px">' + escape(o.button.label) + '</a><!--<![endif]-->' +
      "</td></tr></table>"
    : "";
  const facts = o.facts && o.facts.length
    ? '<table role="presentation" class="soft" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;background:' + C.soft + ';border-radius:10px"><tr><td style="padding:6px 18px">' +
      o.facts.map(([k, v], i) =>
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"' + (i ? ' class="rw" style="border-top:1px solid ' + C.line + '"' : "") + '><tr>' +
        '<td class="mu" width="120" valign="top" style="padding:10px 0;font-family:' + FONT + ';font-size:13px;line-height:20px;color:' + C.muted + '">' + escape(k) + "</td>" +
        '<td class="tx" valign="top" style="padding:10px 0;font-family:' + FONT + ';font-size:13px;line-height:20px;color:' + C.text + ';font-weight:600;word-break:break-all">' + escape(v) + "</td></tr></table>").join("") +
      "</td></tr></table>"
    : "";
  const fallback = o.button
    ? '<p style="margin:22px 0 0;font-family:' + FONT + ';font-size:12px;line-height:19px;color:' + C.muted + '">' + escape(t("If the button doesn't work, copy this link into your browser", "ถ้ากดปุ่มไม่ได้ ให้คัดลอก Link นี้ไปวางใน Browser")) + "</p>" +
      '<p style="margin:4px 0 0;font-family:\'Courier New\',monospace;font-size:12px;line-height:19px;word-break:break-all"><a href="' + escape(o.button.url) + '" class="lk" style="color:' + C.accent + ';text-decoration:underline">' + escape(o.button.url) + "</a></p>"
    : "";
  const note = o.note.map((t) => '<p style="margin:0 0 8px;font-family:' + FONT + ';font-size:13px;line-height:21px;color:' + C.muted + '">' + escape(t) + "</p>").join("");

  return '<!doctype html><html lang="' + o.lang + '" xmlns:v="urn:schemas-microsoft-com:vml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>' + escape(o.title) + "</title>" +
    '<style>@media (max-width:600px){.px{padding-left:24px!important;padding-right:24px!important}}' +
    '@media (prefers-color-scheme:dark){.bg{background:#1d1f24!important}.card{background:#26292f!important;border-color:#353840!important}.tx,.tx p,.tx h1{color:#e6e7ea!important}.mu,.mu p{color:#a5a9b0!important}.soft{background:#2d3037!important}.rw{border-color:#3a3d45!important}.dv{background:#353840!important}.tx p.ey,.ey,.lk{color:#6fc3bb!important}}</style></head>' +
    '<body style="margin:0;padding:0;background:' + C.page + '">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">' + escape(o.preheader) + "&#8203;&nbsp;".repeat(30) + "</div>" +
    '<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + C.page + '" style="background:' + C.page + '"><tr><td align="center" style="padding:36px 12px 40px">' +
    '<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px">' +
    '<tr><td style="padding:0 4px 18px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td width="30" height="30" align="center" valign="middle" bgcolor="' + C.accent + '" style="width:30px;height:30px;border-radius:9px;background:' + C.accent + ';font-family:' + FONT + ';font-size:12px;font-weight:700;color:#ffffff;line-height:30px">' + '<img src="' + logo + '" width="30" height="30" alt="PT" style="display:block;width:30px;height:30px;border:0;outline:none;border-radius:9px;font-size:12px;font-weight:700;color:#ffffff;line-height:30px;text-align:center">' + '</td>' +
    '<td class="tx" style="padding-left:10px;font-family:' + FONT + ';font-size:15px;font-weight:600;color:' + C.text + '">Project Tracker</td></tr></table></td></tr>' +
    '<tr><td class="card" bgcolor="' + C.card + '" style="background:' + C.card + ';border:1px solid ' + C.line + ';border-radius:16px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="px tx" style="padding:36px 40px 30px">' +
    '<p class="ey" style="margin:0 0 8px;font-family:' + FONT + ';font-size:13px;line-height:20px;font-weight:600;color:' + C.accent + '">' + escape(o.eyebrow) + "</p>" +
    '<h1 style="margin:0 0 16px;font-family:' + FONT + ';font-size:23px;line-height:32px;mso-line-height-rule:exactly;font-weight:700;color:' + C.text + '">' + escape(o.title) + "</h1>" +
    intro + button + facts +
    '<div class="mu">' + fallback + "</div></td></tr>" +
    '<tr><td class="px" style="padding:0 40px"><div class="dv" style="height:1px;line-height:1px;font-size:0;background:' + C.line + '">&nbsp;</div></td></tr>' +
    '<tr><td class="px mu" style="padding:20px 40px 26px">' + note + "</td></tr></table></td></tr>" +
    '<tr><td class="mu" style="padding:22px 8px 0;font-family:' + FONT + ';font-size:12px;line-height:19px;color:' + C.faint + '">' +
    escape(t(`This email was sent to ${o.to} ${o.reason[0]} · Automated email, please don't reply`, `Email นี้ส่งถึง ${o.to} ${o.reason[1]} · Email อัตโนมัติ กรุณาอย่าตอบกลับ`)) + "<br>© " + new Date().getFullYear() + " Project Tracker</td></tr>" +
    "</table></td></tr></table></body></html>";
}

/** Text in `lang`. */
const T = (lang: Lang, en: string, th: string) => pick(lang, en, th);

const security = (lang: Lang) =>
  T(lang, "Project Tracker will never ask for your password or OTP by email, phone or chat.", "Project Tracker จะไม่ขอรหัสผ่านหรือรหัส OTP ของคุณทาง Email โทรศัพท์ หรือ Chat");

function when(d: Date, lang: Lang): string {
  const opts = { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" } as const;
  return lang === "th"
    ? new Intl.DateTimeFormat("th-TH", opts).format(d) + " น."
    : new Intl.DateTimeFormat("en-GB", opts).format(d) + " (Bangkok)";
}

export function verifyEmail(to: string, url: string, lang: Lang = "th"): Email {
  return {
    to,
    subject: T(lang, "Verify your email", "ยืนยัน Email") + " — Project Tracker",
    text: [
      T(lang, "Verify your email to start using Project Tracker:", "ยืนยัน Email ของคุณเพื่อเริ่มใช้งาน Project Tracker:"),
      url,
      "",
      T(lang, "This link works for 24 hours. If you didn't sign up, you can ignore this email.", "Link นี้ใช้ได้ 24 ชั่วโมง ถ้าคุณไม่ได้สมัคร ไม่ต้องทำอะไร"),
    ].join("\n"),
    html: layout({
      lang,
      preheader: T(lang, "Verify your email to start using Project Tracker — the link works for 24 hours", "กดยืนยัน Email เพื่อเริ่มใช้งาน Project Tracker — Link ใช้ได้ 24 ชั่วโมง"),
      eyebrow: T(lang, "Confirm your account", "ยืนยันบัญชี"),
      title: T(lang, "Verify your email", "ยืนยัน Email ของคุณ"),
      intro: [
        T(lang, "Thanks for signing up for Project Tracker.", "ขอบคุณที่สมัครใช้งาน Project Tracker"),
        T(lang, "Press the button below to confirm this email is yours, then start tracking your first project right away.", "กดปุ่มด้านล่างเพื่อยืนยันว่า Email นี้เป็นของคุณ แล้วเริ่มติดตาม Project แรกได้ทันที"),
      ],
      button: { label: T(lang, "Verify email", "ยืนยัน Email"), url },
      facts: [[T(lang, "Account", "บัญชี"), to], [T(lang, "Link valid until", "Link ใช้ได้ถึง"), when(new Date(Date.now() + 24 * 3600_000), lang)]],
      note: [
        T(lang, "If you didn't sign up, you can ignore this email — the account won't be activated until it's verified.", "ถ้าคุณไม่ได้สมัคร ไม่ต้องทำอะไร บัญชีจะไม่ถูกเปิดใช้งานจนกว่าจะยืนยัน"),
        security(lang),
      ],
      to,
      reason: ["because an account was created with this address", "เพราะมีการสมัครบัญชีด้วย Email นี้"],
    }),
  };
}

export function resetPassword(to: string, url: string, lang: Lang = "th"): Email {
  return {
    to,
    subject: T(lang, "Reset your password", "ตั้งรหัสผ่านใหม่") + " — Project Tracker",
    text: [
      T(lang, "Someone asked to reset the password for this account:", "มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้:"),
      url,
      "",
      T(lang, "This link works for 1 hour and only once. If you didn't ask, you can ignore this email — your current password still works.", "Link นี้ใช้ได้ 1 ชั่วโมงและใช้ได้ครั้งเดียว ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้"),
    ].join("\n"),
    html: layout({
      lang,
      preheader: T(lang, "Password reset requested — the link works for 1 hour, once", "มีคำขอตั้งรหัสผ่านใหม่ — Link ใช้ได้ 1 ชั่วโมงและใช้ได้ครั้งเดียว"),
      eyebrow: T(lang, "Account security", "ความปลอดภัยของบัญชี"),
      title: T(lang, "Reset your password", "ตั้งรหัสผ่านใหม่"),
      intro: [
        T(lang, "We received a request to reset the password for your Project Tracker account.", "เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชี Project Tracker ของคุณ"),
        T(lang, "Press the button below to set a new password. Other devices that are signed in will be signed out.", "กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ เมื่อตั้งแล้ว อุปกรณ์อื่นที่เข้าสู่ระบบอยู่จะถูกออกจากระบบ"),
      ],
      button: { label: T(lang, "Reset password", "ตั้งรหัสผ่านใหม่"), url },
      facts: [
        [T(lang, "Account", "บัญชี"), to],
        [T(lang, "Requested", "ขอเมื่อ"), when(new Date(), lang)],
        [T(lang, "Link valid for", "Link ใช้ได้"), T(lang, "1 hour · single use", "1 ชั่วโมง · ใช้ได้ครั้งเดียว")],
      ],
      note: [
        T(lang, "If you didn't ask, you can ignore this email. Your current password still works, and nobody can get in without this link.", "ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ และไม่มีใครเข้าบัญชีได้หากไม่มี Link นี้"),
        security(lang),
      ],
      to,
      reason: ["because a password reset was requested", "เพราะมีการขอตั้งรหัสผ่านใหม่"],
    }),
  };
}

/** Sent when someone tries to register with an email that already has a verified account. */
export function alreadyRegistered(to: string, loginUrl: string, forgotUrl: string, lang: Lang = "th"): Email {
  return {
    to,
    subject: T(lang, "You already have an account", "มีบัญชีอยู่แล้ว") + " — Project Tracker",
    text: [
      T(lang, "Someone tried to sign up with this email, but it already has an account.", "มีคนพยายามสมัครด้วย Email นี้ แต่ Email นี้มีบัญชีอยู่แล้ว"),
      `${T(lang, "Sign in", "เข้าสู่ระบบ")}: ${loginUrl}`,
      `${T(lang, "Forgot password", "ลืมรหัสผ่าน")}: ${forgotUrl}`,
      "",
      T(lang, "If this wasn't you, you can ignore this email.", "ถ้าไม่ใช่คุณ ไม่ต้องทำอะไร"),
    ].join("\n"),
    html: layout({
      lang,
      preheader: T(lang, "Someone signed up with this email, but you already have an account", "มีการสมัครด้วย Email นี้ แต่คุณมีบัญชีอยู่แล้ว"),
      eyebrow: T(lang, "Account security", "ความปลอดภัยของบัญชี"),
      title: T(lang, "This email already has an account", "Email นี้มีบัญชีอยู่แล้ว"),
      intro: [
        T(lang, "Someone tried to sign up with this email, but it already has an account.", "มีคนพยายามสมัครด้วย Email นี้ แต่ Email นี้มีบัญชีอยู่แล้ว"),
        T(lang, `If you forgot your password, you can reset it at ${forgotUrl}`, `ถ้าลืมรหัสผ่าน ตั้งใหม่ได้ที่ ${forgotUrl}`),
      ],
      button: { label: T(lang, "Sign in", "เข้าสู่ระบบ"), url: loginUrl },
      facts: [[T(lang, "Account", "บัญชี"), to], [T(lang, "Time", "เวลา"), when(new Date(), lang)]],
      note: [T(lang, "If this wasn't you, you can ignore this email — your account is still safe.", "ถ้าไม่ใช่คุณ ไม่ต้องทำอะไร บัญชีของคุณยังปลอดภัย"), security(lang)],
      to,
      reason: ["because someone signed up with this address", "เพราะมีการสมัครด้วย Email นี้"],
    }),
  };
}
