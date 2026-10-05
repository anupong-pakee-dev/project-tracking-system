import { timingSafeEqual } from "node:crypto";
import rateLimit from "@fastify/rate-limit";
import type { AuthUser } from "@tracker/shared/api";
import { daysBetween, isISODate, todayISO } from "@tracker/shared/dates";
import { bi, DEFAULT_LANG, LANG_HEADER, localize, toLang, type Lang } from "@tracker/shared/i18n";
import type { ISODate } from "@tracker/shared/types";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import type { GoogleOAuth } from "./auth/google.ts";
import { createAuthService } from "./auth/service.ts";
import type { Db } from "./db.ts";
import { HttpError, notFound } from "./errors.ts";
import { Prisma } from "./generated/prisma/client.ts";
import type { Mailer } from "./mailer.ts";
import { createPgRateLimitStore } from "./rate-limit-store.ts";
import { buildSampleData } from "./sample.ts";
import * as S from "./schemas.ts";
import { createService } from "./service.ts";

declare module "fastify" {
  interface FastifyRequest {
    /** Set on routes that require a signed-in user. */
    user: AuthUser | null;
    /** Language for messages, from the X-Lang header apps/web sends. */
    lang: Lang;
  }
}

export interface AppOptions {
  db: Db;
  mailer: Mailer;
  /** Public URL of apps/web, used in email links. */
  appUrl: string;
  /** Shared secret apps/web must send as `Authorization: Bearer …`. */
  apiToken?: string | null;
  logLevel?: string;
  /** Per-IP limits on auth endpoints. Default on. */
  rateLimit?: boolean;
  /** Google sign-in. Off when null/omitted. */
  google?: GoogleOAuth | null;
}

// Headers apps/web sets on every call.
const SESSION_HEADER = "x-session-token"; // the user's session cookie
const CLIENT_IP_HEADER = "x-client-ip"; // the browser's IP (for rate limits)
const CLIENT_UA_HEADER = "x-client-user-agent";

/**
 * The web app sends its local date in `X-Client-Date` so both sides agree on "today".
 * Anything implausible (more than a day off the server clock) falls back to the server's date.
 */
function today(req: FastifyRequest): ISODate {
  const server = todayISO();
  const client = req.headers["x-client-date"];
  if (typeof client === "string" && isISODate(client) && Math.abs(daysBetween(server, client)) <= 1) {
    return client;
  }
  return server;
}

function id(req: FastifyRequest): string {
  const parsed = S.idParam.safeParse(req.params);
  if (!parsed.success) throw notFound();
  return parsed.data.id;
}

function header(req: FastifyRequest, name: string): string | undefined {
  const v = req.headers[name];
  return typeof v === "string" && v ? v : undefined;
}

function tokenMatches(given: string | undefined, token: string): boolean {
  const a = Buffer.from(given?.replace(/^Bearer\s+/i, "") ?? "");
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const { db, mailer, appUrl, apiToken = null, logLevel = "info" } = opts;
  const app = Fastify({
    logger: {
      level: logLevel,
      redact: [`req.headers["${SESSION_HEADER}"]`, "req.headers.authorization"],
    },
    // Backup restores; Vercel Functions cap request bodies at 4.5 MB.
    bodyLimit: 4 * 1024 * 1024,
  });
  const svc = createService(db);
  const auth = createAuthService({ db, mailer, appUrl, log: app.log, google: opts.google });

  app.decorateRequest("user", null);
  app.decorateRequest("lang", DEFAULT_LANG);
  // First hook, so even the API-token error below is in the right language.
  app.addHook("onRequest", async (req) => {
    req.lang = toLang(header(req, LANG_HEADER));
  });
  /** A message for this request's reader. */
  const say = (req: FastifyRequest, message: string) => localize(message, req.lang);

  await app.register(rateLimit, {
    global: false,
    // Counters live in Postgres so every serverless instance shares them.
    store: createPgRateLimitStore(db),
    // apps/web calls from its own server, so key on the browser IP it forwards. Trustworthy
    // because only holders of API_TOKEN (required in production) can reach these routes.
    keyGenerator: (req) => header(req, CLIENT_IP_HEADER) ?? req.ip,
  });
  const limit = (max: number, timeWindow: string) =>
    opts.rateLimit === false ? {} : { config: { rateLimit: { max, timeWindow } } };

  if (apiToken) {
    app.addHook("onRequest", async (req, reply) => {
      if (req.url === "/health") return;
      if (!tokenMatches(req.headers.authorization, apiToken)) {
        return reply.code(401).send({ error: say(req, bi("Unauthorized (invalid API token)", "ไม่ได้รับอนุญาต (API token ไม่ถูกต้อง)")), code: "BAD_API_TOKEN" });
      }
    });
  }

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) return reply.code(400).send({ error: say(req, S.describeZodError(err)) });
    if (err instanceof HttpError) return reply.code(err.status).send({ error: say(req, err.message), code: err.code });
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return reply.code(404).send({ error: say(req, bi("Not found", "ไม่พบข้อมูล")) });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429) {
      return reply.code(429).send({
        error: say(req, bi("Too many attempts — please wait a moment and try again", "ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่")),
        code: "RATE_LIMITED",
      });
    }
    if (status && status >= 400 && status < 500) {
      // Fastify's own errors: malformed JSON, body too large, wrong content type…
      const detail = (err as Error).message;
      return reply.code(status).send({ error: say(req, bi(`Bad request: ${detail}`, `คำขอไม่ถูกต้อง: ${detail}`)) });
    }
    req.log.error(err);
    return reply.code(500).send({ error: say(req, bi("Something went wrong on our side — please try again", "เกิดข้อผิดพลาดภายในระบบ ลองใหม่อีกครั้ง")) });
  });

  app.get("/health", async (_req, reply) => {
    try {
      await db.$queryRaw`SELECT 1`;
      return { ok: true, db: "up" };
    } catch {
      return reply.code(503).send({ ok: false, db: "down" });
    }
  });

  // ---------- Auth (public) ----------

  const ua = (req: FastifyRequest) => header(req, CLIENT_UA_HEADER);
  const SENT = bi(
    "If this email can be used, we've sent a link to it — check your inbox (and spam folder)",
    "ถ้า Email นี้ใช้ได้ เราได้ส่ง Link ไปให้แล้ว — ตรวจกล่องจดหมาย (และ Folder Spam)",
  );

  app.post("/auth/register", limit(5, "10 minutes"), async (req, reply) => {
    const { email, password } = S.registerInput.parse(req.body);
    await auth.register(email, password, req.lang);
    return reply.code(202).send({ message: say(req, SENT) });
  });

  app.post("/auth/login", limit(10, "5 minutes"), async (req) => {
    const { email, password } = S.loginInput.parse(req.body);
    return auth.login(email, password, ua(req));
  });

  app.post("/auth/verify-email", limit(20, "10 minutes"), async (req) => {
    return auth.verifyEmail(S.tokenInput.parse(req.body).token, ua(req));
  });

  app.post("/auth/resend-verification", limit(5, "10 minutes"), async (req, reply) => {
    await auth.resendVerification(S.emailInput.parse(req.body).email, req.lang);
    return reply.code(202).send({ message: say(req, SENT) });
  });

  app.post("/auth/forgot-password", limit(5, "10 minutes"), async (req, reply) => {
    await auth.forgotPassword(S.emailInput.parse(req.body).email, req.lang);
    return reply.code(202).send({ message: say(req, SENT) });
  });

  app.get("/auth/providers", async () => ({ google: Boolean(opts.google) }));

  app.post("/auth/google/start", limit(30, "10 minutes"), async () => auth.googleStart());

  app.post("/auth/google", limit(20, "10 minutes"), async (req) => {
    const { code, codeVerifier } = S.googleCallbackInput.parse(req.body);
    return auth.googleSignIn(code, codeVerifier, ua(req));
  });

  app.post("/auth/reset-password", limit(10, "10 minutes"), async (req) => {
    const { token, password } = S.resetPasswordInput.parse(req.body);
    return auth.resetPassword(token, password, ua(req));
  });

  // ---------- Everything below requires a signed-in user ----------

  await app.register(async (r) => {
    r.addHook("onRequest", async (req) => {
      req.user = await auth.authenticate(header(req, SESSION_HEADER));
    });
    const uid = (req: FastifyRequest) => req.user!.id;

    r.get("/auth/me", async (req) => req.user);

    r.post("/auth/logout", async (req, reply) => {
      await auth.logout(header(req, SESSION_HEADER)!);
      return reply.code(204).send();
    });

    // Projects
    r.get("/projects", async (req) => svc.listViews(uid(req), today(req)));

    r.post("/projects", async (req, reply) => {
      const projectId = await svc.createProject(uid(req), S.createProjectInput.parse(req.body), today(req), req.lang);
      return reply.code(201).send({ id: projectId });
    });

    r.get("/projects/:id", async (req) => svc.getView(uid(req), id(req), today(req)));

    r.patch("/projects/:id", async (req, reply) => {
      await svc.updateProject(uid(req), id(req), S.projectInput.parse(req.body));
      return reply.code(204).send();
    });

    r.put("/projects/:id/status", async (req, reply) => {
      await svc.setStatus(uid(req), id(req), S.statusInput.parse(req.body).status, today(req));
      return reply.code(204).send();
    });

    r.delete("/projects/:id", async (req, reply) => {
      await svc.deleteProject(uid(req), id(req));
      return reply.code(204).send();
    });

    // Tasks
    r.post("/projects/:id/tasks", async (req, reply) => {
      const message = await svc.addTasks(uid(req), id(req), S.addTasksInput.parse(req.body).tasks, today(req), req.lang);
      return reply.code(201).send({ message: say(req, message) });
    });

    r.patch("/tasks/:id", async (req, reply) => {
      await svc.updateTask(uid(req), id(req), S.updateTaskInput.parse(req.body), today(req), req.lang);
      return reply.code(204).send();
    });

    r.post("/tasks/:id/move", async (req, reply) => {
      await svc.moveTask(uid(req), id(req), S.moveTaskInput.parse(req.body).direction);
      return reply.code(204).send();
    });

    r.delete("/tasks/:id", async (req, reply) => {
      await svc.deleteTask(uid(req), id(req), today(req), req.lang);
      return reply.code(204).send();
    });

    // Progress
    r.post("/projects/:id/progress", async (req, reply) => {
      const message = await svc.submitProgress(uid(req), id(req), S.progressInput.parse(req.body), today(req));
      return reply.code(201).send({ message: say(req, message) });
    });

    r.delete("/logs/:id", async (req, reply) => {
      await svc.deleteLog(uid(req), id(req));
      return reply.code(204).send();
    });

    // Data management (always scoped to the signed-in user)
    r.get("/stats", async (req) => svc.counts(uid(req)));

    r.get("/backup", async (req) => svc.exportAll(uid(req)));

    r.put("/backup", async (req) => {
      const data = S.backupFile.parse(req.body);
      await svc.replaceAll(uid(req), data);
      const n = data.projects.length;
      return { message: say(req, bi(`Imported ${n} project${n === 1 ? "" : "s"}`, `นำเข้าแล้ว ${n} Project`)) };
    });

    r.post("/sample", async (req) => {
      // Added next to the user's own projects — never replaces them.
      await svc.addAll(uid(req), buildSampleData(today(req), req.lang));
      return { message: say(req, bi("Sample data loaded", "Load ข้อมูลตัวอย่างแล้ว")) };
    });

    r.delete("/data", async (req, reply) => {
      await svc.replaceAll(uid(req), { version: 1, projects: [], tasks: [], logs: [] });
      return reply.code(204).send();
    });
  });

  return app;
}
