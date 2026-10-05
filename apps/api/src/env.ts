import { z } from "zod";

// Validated once at startup so a misconfigured deployment fails immediately with a clear
// message instead of later, request by request.

const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
/** Host is localhost, with or without `user:password@` in front. */
const isLocalUrl = (url: string) => /\/\/(?:[^@/]*@)?(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);

const schema = z
  .object({
    /** Pooled connection used at runtime (Supabase "transaction pooler" / Neon pooled URL). */
    DATABASE_URL: z.string().min(1, "is required"),
    /** Max pooled connections (default 10 locally, 5 on Vercel). */
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).optional(),
    API_HOST: z.string().default("127.0.0.1"),
    API_PORT: z.coerce.number().int().default(4000),
    /** Shared secret apps/web sends as `Authorization: Bearer …`. Required in production. */
    API_TOKEN: z.string().optional(),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    /** Public URL of apps/web — used for links in emails. */
    APP_URL: z.url().default("http://localhost:3000"),
    /** Locally: Mailpit from docker-compose. In production: your provider's SMTP URL. */
    SMTP_URL: z.string().default("smtp://localhost:1025"),
    MAIL_FROM: z.string().default("Project Tracker <no-reply@tracker.local>"),
    /** Google sign-in (OAuth client of type "Web application"). Leave both unset to turn it off. */
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
  })
  .superRefine((e, ctx) => {
    const fail = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (Boolean(e.GOOGLE_CLIENT_ID) !== Boolean(e.GOOGLE_CLIENT_SECRET)) {
      fail(e.GOOGLE_CLIENT_ID ? "GOOGLE_CLIENT_SECRET" : "GOOGLE_CLIENT_ID", "set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither");
    }
    if (!isProduction) return;
    if (!e.API_TOKEN || e.API_TOKEN.length < 32) {
      fail("API_TOKEN", "must be set to a random string of at least 32 characters in production");
    }
    if (!e.APP_URL.startsWith("https://")) fail("APP_URL", "must be the https URL of the web app in production");
    if (isLocalUrl(e.SMTP_URL)) fail("SMTP_URL", "points at localhost (Mailpit) — set a real SMTP server in production");
    if (isLocalUrl(e.DATABASE_URL)) fail("DATABASE_URL", "points at localhost in production");
  });

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(
      `Invalid API configuration:\n${lines.join("\n")}\n` +
        "Locally: copy apps/api/.env.example to apps/api/.env. On Vercel: Project → Settings → Environment Variables.",
    );
  }
  const e = parsed.data;
  return {
    databaseUrl: e.DATABASE_URL,
    dbPoolMax: e.DB_POOL_MAX,
    host: e.API_HOST,
    port: e.API_PORT,
    apiToken: e.API_TOKEN || null,
    logLevel: e.LOG_LEVEL,
    appUrl: e.APP_URL.replace(/\/$/, ""),
    smtpUrl: e.SMTP_URL,
    mailFrom: e.MAIL_FROM,
    google:
      e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
        ? { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET }
        : null,
    isProduction,
  };
}

export const env = load();
