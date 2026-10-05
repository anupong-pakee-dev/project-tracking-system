// Integration tests: real HTTP requests (via Fastify inject) against a real PostgreSQL.
// They WIPE the database, so they only run when TEST_DATABASE_URL is set — locally that's
// the `tracker_test` database in docker-compose.yml (see apps/api/.env). Migrations are
// applied first by test/global-setup.ts. Emails are captured in memory.
import type { ProjectView, SessionResponse } from "@tracker/shared/api";
import { addDays, todayISO } from "@tracker/shared/dates";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { GoogleOAuth, GoogleProfile } from "./auth/google.ts";
import { buildApp } from "./create-app.ts";
import { createDb } from "./db.ts";
import { createMemoryMailer } from "./mailer.ts";

const url = process.env.TEST_DATABASE_URL;
const TODAY = todayISO();
const PASSWORD = "correct horse battery";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

describe.skipIf(!url)("API", () => {
  const db = createDb(url!, 2);
  const mailer = createMemoryMailer();
  let app: FastifyInstance;

  /** Stand-in for Google: each code maps to the account "Google" says signed in. */
  const googleAccounts = new Map<string, GoogleProfile>();
  const google: GoogleOAuth = {
    authUrl: ({ state, codeChallenge }) => `https://google.test/auth?state=${state}&challenge=${codeChallenge}`,
    async exchange(code) {
      const profile = googleAccounts.get(code);
      if (!profile) throw new Error("unknown code");
      return profile;
    },
  };
  const VERIFIER = "v".repeat(43);
  /** Signs in with Google as `profile`. */
  function withGoogle(profile: Partial<GoogleProfile> & { email: string }) {
    const code = `code-${googleAccounts.size}`;
    googleAccounts.set(code, { sub: `sub-${profile.email}`, emailVerified: true, ...profile });
    return call("POST", "/auth/google", { code, codeVerifier: VERIFIER });
  }

  const call = (method: Method, path: string, payload?: unknown, session?: string) =>
    app.inject({
      method,
      url: path,
      headers: {
        authorization: "Bearer secret-token",
        // Assertions below check the Thai messages.
        "x-lang": "th",
        "x-client-date": TODAY,
        ...(session ? { "x-session-token": session } : {}),
      },
      payload: payload as object,
    });

  /** The token from the link in the latest email to `to`. */
  function tokenFromMail(to: string): string {
    const mail = mailer.sent.filter((m) => m.to === to).at(-1);
    const token = mail?.text.match(/token=([\w-]+)/)?.[1];
    if (!token) throw new Error(`no link in mail to ${to}`);
    return token;
  }

  /** Registers, verifies via the emailed link, returns the session token. */
  async function signUp(email: string): Promise<string> {
    expect((await call("POST", "/auth/register", { email, password: PASSWORD })).statusCode).toBe(202);
    const res = await call("POST", "/auth/verify-email", { token: tokenFromMail(email) });
    expect(res.statusCode).toBe(200);
    return res.json<SessionResponse>().token;
  }

  beforeAll(async () => {
    app = await buildApp({
      db,
      mailer,
      appUrl: "http://web.test",
      apiToken: "secret-token",
      logLevel: "silent",
      rateLimit: false,
      google,
    });
    await app.ready();
  });
  beforeEach(async () => {
    mailer.sent.length = 0;
    googleAccounts.clear();
    await db.user.deleteMany(); // sessions, tokens and projects cascade
    await db.project.deleteMany();
    await db.rateLimit.deleteMany();
  });
  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  // ---------- Auth ----------

  describe("auth", () => {
    it("rejects requests without the API token or a session", async () => {
      expect((await app.inject({ method: "GET", url: "/projects" })).statusCode).toBe(401);
      const res = await call("GET", "/projects");
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe("UNAUTHENTICATED");
      expect((await app.inject({ method: "GET", url: "/health" })).json()).toEqual({ ok: true, db: "up" });
    });

    it("registers, requires verification, then logs in", async () => {
      const reg = await call("POST", "/auth/register", { email: " Me@Example.com ", password: PASSWORD });
      expect(reg.statusCode).toBe(202);
      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0].to).toBe("me@example.com");
      expect(mailer.sent[0].text).toContain("http://web.test/verify-email?token=");

      const early = await call("POST", "/auth/login", { email: "me@example.com", password: PASSWORD });
      expect(early.statusCode).toBe(403);
      expect(early.json().code).toBe("EMAIL_NOT_VERIFIED");

      const verified = await call("POST", "/auth/verify-email", { token: tokenFromMail("me@example.com") });
      expect(verified.statusCode).toBe(200);
      expect(verified.json().user.email).toBe("me@example.com");

      const login = await call("POST", "/auth/login", { email: "ME@example.com", password: PASSWORD });
      expect(login.statusCode).toBe(200);
      const me = await call("GET", "/auth/me", undefined, login.json<SessionResponse>().token);
      expect(me.json().email).toBe("me@example.com");
    });

    it("validates register input in Thai", async () => {
      let res = await call("POST", "/auth/register", { email: "nope", password: PASSWORD });
      expect(res.json().error).toBe("รูปแบบ Email ไม่ถูกต้อง");
      res = await call("POST", "/auth/register", { email: "a@b.co", password: "short" });
      expect(res.json().error).toBe("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    });

    it("stores timestamps as real instants (database session must be UTC)", async () => {
      await call("POST", "/auth/register", { email: "tz@example.com", password: PASSWORD });
      const [row] = await db.$queryRaw<{ epoch: number }[]>`
        SELECT extract(epoch FROM created_at)::float8 AS epoch FROM users WHERE email = 'tz@example.com'`;
      expect(Math.abs(row.epoch * 1000 - Date.now())).toBeLessThan(60_000);
    });

    it("never stores plain passwords or tokens", async () => {
      await call("POST", "/auth/register", { email: "a@b.co", password: PASSWORD });
      const user = await db.user.findUniqueOrThrow({ where: { email: "a@b.co" }, include: { authTokens: true } });
      expect(user.passwordHash).toMatch(/^scrypt\$/);
      expect(user.passwordHash).not.toContain(PASSWORD);
      expect(user.authTokens[0].tokenHash).not.toBe(tokenFromMail("a@b.co"));
    });

    it("does not reveal whether an email is registered", async () => {
      await signUp("taken@example.com");
      const res = await call("POST", "/auth/register", { email: "taken@example.com", password: "another password" });
      expect(res.statusCode).toBe(202);
      expect(mailer.sent.at(-1)!.subject).toContain("มีบัญชีอยู่แล้ว");
      // …and the original password still works.
      expect((await call("POST", "/auth/login", { email: "taken@example.com", password: PASSWORD })).statusCode).toBe(200);

      const forgot = await call("POST", "/auth/forgot-password", { email: "nobody@example.com" });
      expect(forgot.statusCode).toBe(202);
      expect(mailer.sent.filter((m) => m.to === "nobody@example.com")).toHaveLength(0);
    });

    it("rejects wrong passwords and unknown emails the same way", async () => {
      await signUp("me@example.com");
      const wrong = await call("POST", "/auth/login", { email: "me@example.com", password: "wrong password" });
      const unknown = await call("POST", "/auth/login", { email: "who@example.com", password: "wrong password" });
      expect(wrong.statusCode).toBe(401);
      expect(unknown.json()).toEqual(wrong.json());
    });

    it("verification links are single-use", async () => {
      await call("POST", "/auth/register", { email: "me@example.com", password: PASSWORD });
      const token = tokenFromMail("me@example.com");
      expect((await call("POST", "/auth/verify-email", { token })).statusCode).toBe(200);
      const again = await call("POST", "/auth/verify-email", { token });
      expect(again.statusCode).toBe(400);
      expect(again.json().code).toBe("INVALID_TOKEN");
    });

    it("throttles repeated emails", async () => {
      await call("POST", "/auth/register", { email: "me@example.com", password: PASSWORD });
      await call("POST", "/auth/resend-verification", { email: "me@example.com" });
      expect(mailer.sent).toHaveLength(1);
    });

    it("resets the password and signs out other sessions", async () => {
      const oldSession = await signUp("me@example.com");
      await call("POST", "/auth/forgot-password", { email: "me@example.com" });
      const token = tokenFromMail("me@example.com");
      expect(mailer.sent.at(-1)!.text).toContain("http://web.test/reset-password?token=");

      const short = await call("POST", "/auth/reset-password", { token, password: "short" });
      expect(short.statusCode).toBe(400);

      const res = await call("POST", "/auth/reset-password", { token, password: "a brand new password" });
      expect(res.statusCode).toBe(200);
      expect((await call("GET", "/auth/me", undefined, oldSession)).statusCode).toBe(401);
      expect((await call("GET", "/auth/me", undefined, res.json<SessionResponse>().token)).statusCode).toBe(200);

      expect((await call("POST", "/auth/login", { email: "me@example.com", password: PASSWORD })).statusCode).toBe(401);
      expect(
        (await call("POST", "/auth/login", { email: "me@example.com", password: "a brand new password" })).statusCode,
      ).toBe(200);
      expect((await call("POST", "/auth/reset-password", { token, password: "yet another one" })).statusCode).toBe(400);
    });

    it("logs out", async () => {
      const s = await signUp("me@example.com");
      expect((await call("POST", "/auth/logout", undefined, s)).statusCode).toBe(204);
      expect((await call("GET", "/projects", undefined, s)).statusCode).toBe(401);
    });

    it("lets the first verified account adopt projects created before accounts existed", async () => {
      await db.project.create({
        data: { name: "เก่า", color: "#4f46e5", startDate: new Date("2026-09-01"), targetDate: new Date("2026-12-01") },
      });
      const first = await signUp("first@example.com");
      const second = await signUp("second@example.com");
      expect((await call("GET", "/projects", undefined, first)).json()).toHaveLength(1);
      expect((await call("GET", "/projects", undefined, second)).json()).toHaveLength(0);
    });

    it("rate-limits login per client IP, shared across API instances (like serverless)", async () => {
      // Two independent instances = two Vercel function instances sharing one database.
      const a = await buildApp({ db, mailer, appUrl: "http://web.test", logLevel: "silent" });
      const b = await buildApp({ db, mailer, appUrl: "http://web.test", logLevel: "silent" });
      const attempt = (app: FastifyInstance, ip: string) =>
        app.inject({
          method: "POST",
          url: "/auth/login",
          headers: { "x-client-ip": ip },
          payload: { email: "x@example.com", password: "whatever" },
        });
      for (let i = 0; i < 5; i++) expect((await attempt(a, "1.1.1.1")).statusCode).toBe(401);
      for (let i = 0; i < 5; i++) expect((await attempt(b, "1.1.1.1")).statusCode).toBe(401);
      const blocked = await attempt(a, "1.1.1.1");
      expect(blocked.statusCode).toBe(429);
      expect(blocked.json().code).toBe("RATE_LIMITED");
      expect((await attempt(b, "2.2.2.2")).statusCode).toBe(401);
      // No raw IPs in the table.
      const keys = await db.rateLimit.findMany({ select: { key: true } });
      expect(keys.every((k) => /^[0-9a-f]{64}$/.test(k.key))).toBe(true);
      await a.close();
      await b.close();
    });

    it("cleans up expired sessions on login", async () => {
      await signUp("me@example.com");
      const user = await db.user.findUniqueOrThrow({ where: { email: "me@example.com" } });
      await db.session.create({
        data: { userId: user.id, tokenHash: "x".repeat(64), expiresAt: new Date(Date.now() - 1000) },
      });
      await call("POST", "/auth/login", { email: "me@example.com", password: PASSWORD });
      expect(await db.session.count({ where: { userId: user.id, expiresAt: { lt: new Date() } } })).toBe(0);
    });
  });

  // ---------- Google sign-in ----------

  describe("google", () => {
    it("reports whether Google sign-in is on", async () => {
      expect((await call("GET", "/auth/providers")).json()).toEqual({ google: true });
      const off = await buildApp({ db, mailer, appUrl: "http://web.test", logLevel: "silent", rateLimit: false });
      expect((await off.inject({ method: "GET", url: "/auth/providers" })).json()).toEqual({ google: false });
      const start = await off.inject({ method: "POST", url: "/auth/google/start" });
      expect(start.statusCode).toBe(404);
      expect(start.json().code).toBe("GOOGLE_DISABLED");
      await off.close();
    });

    it("starts with a fresh state and an S256 PKCE challenge", async () => {
      const a = (await call("POST", "/auth/google/start")).json();
      const b = (await call("POST", "/auth/google/start")).json();
      expect(a.state).not.toBe(b.state);
      const { createHash } = await import("node:crypto");
      const challenge = createHash("sha256").update(a.codeVerifier).digest("base64url");
      expect(a.url).toBe(`https://google.test/auth?state=${a.state}&challenge=${challenge}`);
    });

    it("signs up a new user, verified, with no password and no email", async () => {
      const res = await withGoogle({ email: "new@gmail.com" });
      expect(res.statusCode).toBe(200);
      const session = res.json<SessionResponse>();
      expect(session.user.email).toBe("new@gmail.com");
      expect((await call("GET", "/auth/me", undefined, session.token)).statusCode).toBe(200);
      expect(mailer.sent).toHaveLength(0);

      const user = await db.user.findUniqueOrThrow({ where: { email: "new@gmail.com" } });
      expect(user.emailVerifiedAt).not.toBeNull();
      expect(user.passwordHash).toBeNull();
      expect(user.googleId).toBe("sub-new@gmail.com");
      // No password yet, so password login fails like any wrong password…
      const login = await call("POST", "/auth/login", { email: "new@gmail.com", password: PASSWORD });
      expect(login.statusCode).toBe(401);
      // …and signing in with Google again finds the same account.
      expect((await withGoogle({ email: "new@gmail.com" })).json<SessionResponse>().user.id).toBe(user.id);
    });

    it("links to an existing account with the same email and keeps its password", async () => {
      await signUp("me@example.com");
      const res = await withGoogle({ email: "me@example.com" });
      expect(res.statusCode).toBe(200);
      expect(await db.user.count()).toBe(1);
      expect((await call("POST", "/auth/login", { email: "me@example.com", password: PASSWORD })).statusCode).toBe(200);
    });

    it("drops the password of an unverified account it takes over (it may not be the owner's)", async () => {
      await call("POST", "/auth/register", { email: "me@example.com", password: PASSWORD });
      expect((await withGoogle({ email: "me@example.com" })).statusCode).toBe(200);
      const user = await db.user.findUniqueOrThrow({ where: { email: "me@example.com" } });
      expect(user.emailVerifiedAt).not.toBeNull();
      expect(user.passwordHash).toBeNull();
      expect((await call("POST", "/auth/login", { email: "me@example.com", password: PASSWORD })).statusCode).toBe(401);
    });

    it("lets a Google account set a password through forgot-password", async () => {
      await withGoogle({ email: "me@gmail.com" });
      await call("POST", "/auth/forgot-password", { email: "me@gmail.com" });
      const res = await call("POST", "/auth/reset-password", { token: tokenFromMail("me@gmail.com"), password: PASSWORD });
      expect(res.statusCode).toBe(200);
      expect((await call("POST", "/auth/login", { email: "me@gmail.com", password: PASSWORD })).statusCode).toBe(200);
    });

    it("rejects unverified Google emails and a second Google account for one email", async () => {
      const unverified = await withGoogle({ email: "x@example.com", emailVerified: false });
      expect(unverified.statusCode).toBe(400);
      expect(unverified.json().code).toBe("GOOGLE_EMAIL_UNVERIFIED");
      expect(await db.user.count()).toBe(0);

      await withGoogle({ email: "me@example.com", sub: "first" });
      const other = await withGoogle({ email: "me@example.com", sub: "second" });
      expect(other.statusCode).toBe(409);
      expect(other.json().code).toBe("GOOGLE_ACCOUNT_MISMATCH");
    });

    it("adopts pre-account projects when the first account comes from Google", async () => {
      await db.project.create({
        data: { name: "เก่า", color: "#4f46e5", startDate: new Date("2026-09-01"), targetDate: new Date("2026-12-01") },
      });
      const session = (await withGoogle({ email: "first@gmail.com" })).json<SessionResponse>().token;
      expect((await call("GET", "/projects", undefined, session)).json()).toHaveLength(1);
    });

    it("validates the callback input", async () => {
      const res = await call("POST", "/auth/google", { code: "abc", codeVerifier: "short" });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Link ไม่ถูกต้อง");
    });
  });

  // ---------- Projects ----------

  describe("projects", () => {
    let me: string;
    const as = (method: Method, path: string, payload?: unknown) => call(method, path, payload, me);

    async function createProject(extra: Record<string, unknown> = {}) {
      const res = await as("POST", "/projects", {
        name: "Web ทดสอบ",
        color: "#4f46e5",
        startDate: addDays(TODAY, -10),
        targetDate: addDays(TODAY, 10),
        tasks: [
          { title: "A", weight: 3 },
          { title: "B", weight: 1 },
        ],
        ...extra,
      });
      expect(res.statusCode).toBe(201);
      return res.json<{ id: string }>().id;
    }

    const view = async (id: string) => (await as("GET", `/projects/${id}`)).json<ProjectView>();

    beforeEach(async () => {
      me = await signUp("me@example.com");
    });

    it("keeps each user's data private", async () => {
      const id = await createProject();
      const [task] = (await view(id)).tasks;
      const other = await signUp("other@example.com");
      const asOther = (method: Method, path: string, payload?: unknown) => call(method, path, payload, other);

      expect((await asOther("GET", "/projects")).json()).toEqual([]);
      expect((await asOther("GET", `/projects/${id}`)).statusCode).toBe(404);
      expect((await asOther("PUT", `/projects/${id}/status`, { status: "done" })).statusCode).toBe(404);
      expect((await asOther("POST", `/projects/${id}/progress`, { note: "x" })).statusCode).toBe(404);
      expect((await asOther("PATCH", `/tasks/${task.id}`, { title: "hacked", weight: 1 })).statusCode).toBe(404);
      expect((await asOther("DELETE", `/tasks/${task.id}`)).statusCode).toBe(404);
      expect((await asOther("DELETE", `/projects/${id}`)).statusCode).toBe(404);
      await asOther("DELETE", "/data");
      expect((await asOther("GET", "/backup")).json().projects).toEqual([]);

      const mine = await view(id);
      expect(mine.project.status).toBe("active");
      expect(mine.tasks.map((t) => t.title)).toEqual(["A", "B"]);
    });

    it("creates a project with weighted tasks and forecasts it", async () => {
      const v = await view(await createProject());
      expect(v.tasks.map((t) => t.title)).toEqual(["A", "B"]);
      expect(v.forecast.progress).toBe(0);
      expect(v.forecast.health).toBe("no-data");
    });

    it("validates input with Thai messages", async () => {
      const res = await as("POST", "/projects", {
        name: "x",
        color: "#4f46e5",
        startDate: TODAY,
        targetDate: addDays(TODAY, -1),
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("วันเป้าหมายต้องอยู่หลังวันเริ่ม");
      expect((await as("GET", "/projects/not-a-uuid")).statusCode).toBe(404);
    });

    it("records progress, auto-notes it and completes at 100%", async () => {
      const id = await createProject();
      const [a, b] = (await view(id)).tasks;

      expect((await as("POST", `/projects/${id}/progress`, { tasks: { [a.id]: 100 } })).statusCode).toBe(201);
      let v = await view(id);
      expect(v.forecast.progress).toBe(75);
      expect(v.logs[0]).toMatchObject({ progress: 75, note: "A 0→100%", kind: "update", date: TODAY });

      const none = await as("POST", `/projects/${id}/progress`, {});
      expect(none.statusCode).toBe(400);
      expect(none.json().error).toContain("ยังไม่มีอะไรเปลี่ยน");

      await as("POST", `/projects/${id}/progress`, { tasks: { [b.id]: 100 }, note: "เสร็จ" });
      v = await view(id);
      expect(v.project.status).toBe("done");
      expect(v.project.completedAt).toBe(TODAY);
    });

    it("rejects future-dated updates", async () => {
      const id = await createProject({ tasks: [] });
      expect((await as("POST", `/projects/${id}/progress`, { manual: 10, date: addDays(TODAY, 1) })).statusCode).toBe(400);
    });

    it("logs scope changes when tasks are added or removed", async () => {
      const id = await createProject();
      const [a] = (await view(id)).tasks;
      await as("POST", `/projects/${id}/progress`, { tasks: { [a.id]: 100 } }); // 75%

      await as("POST", `/projects/${id}/tasks`, { tasks: [{ title: "C", weight: 4 }] });
      let v = await view(id);
      expect(v.forecast.progress).toBeCloseTo(37.5);
      expect(v.logs[0]).toMatchObject({ kind: "scope", note: "เพิ่มงาน: C" });

      const c = v.tasks.find((t) => t.title === "C")!;
      expect((await as("DELETE", `/tasks/${c.id}`)).statusCode).toBe(204);
      v = await view(id);
      expect(v.forecast.progress).toBe(75);
      expect(v.logs[0].note).toBe("ลบงาน: C");
    });

    it("stores several tags (preset or custom) and a MoSCoW priority per task, COULD by default", async () => {
      const id = await createProject();
      const [a] = (await view(id)).tasks;
      expect(a).toMatchObject({ categories: ["other"], priority: "could" });

      await as("POST", `/projects/${id}/tasks`, { tasks: [{ title: "C", weight: 1, categories: ["uxui", "api"], priority: "must" }] });
      expect((await view(id)).tasks.find((t) => t.title === "C")).toMatchObject({ categories: ["uxui", "api"], priority: "must" });

      const patch = { title: "A", weight: 3, categories: ["Backend", "  Marketing  ", "backend", "other"], priority: "should" };
      expect((await as("PATCH", `/tasks/${a.id}`, patch)).statusCode).toBe(204);
      expect((await view(id)).tasks[0]).toMatchObject({ categories: ["backend", "Marketing"], priority: "should" });
      expect((await as("PATCH", `/tasks/${a.id}`, { ...patch, categories: [] })).statusCode).toBe(204);
      expect((await view(id)).tasks[0].categories).toEqual(["other"]);

      const bad = await as("PATCH", `/tasks/${a.id}`, { ...patch, priority: null });
      expect(bad.statusCode).toBe(400);
      expect(bad.json().error).toBe("ระดับความสำคัญไม่ถูกต้อง");
    });

    it("answers in the language from X-Lang (Thai by default)", async () => {
      const id = await createProject({ tasks: [] });
      const body = { manual: 10, date: addDays(TODAY, 1) };
      const inLang = (lang?: string) =>
        app.inject({
          method: "POST",
          url: `/projects/${id}/progress`,
          payload: body,
          headers: {
            authorization: "Bearer secret-token",
            "x-client-date": TODAY,
            "x-session-token": me,
            ...(lang ? { "x-lang": lang } : {}),
          },
        });
      expect((await inLang("en")).json().error).toBe("You can't record progress for a future date");
      expect((await inLang("th")).json().error).toBe("บันทึกล่วงหน้าไม่ได้");
      expect((await inLang()).json().error).toBe("บันทึกล่วงหน้าไม่ได้");
      expect((await inLang("both")).json().error).toBe("บันทึกล่วงหน้าไม่ได้");
    });

    it("reorders tasks", async () => {
      const id = await createProject();
      const [a] = (await view(id)).tasks;
      await as("POST", `/tasks/${a.id}/move`, { direction: 1 });
      expect((await view(id)).tasks.map((t) => t.title)).toEqual(["B", "A"]);
    });

    it("updates, pauses, and deletes projects (cascading)", async () => {
      const id = await createProject();
      const patch = await as("PATCH", `/projects/${id}`, {
        name: "ชื่อใหม่",
        color: "#059669",
        startDate: addDays(TODAY, -10),
        targetDate: addDays(TODAY, 20),
        skipWeekends: true,
      });
      expect(patch.statusCode).toBe(204);
      let v = await view(id);
      expect(v.project).toMatchObject({ name: "ชื่อใหม่", skipWeekends: true });
      expect(v.forecast.unit).toBe("workday");

      await as("PUT", `/projects/${id}/status`, { status: "paused" });
      v = await view(id);
      expect(v.forecast.health).toBe("paused");

      expect((await as("DELETE", `/projects/${id}`)).statusCode).toBe(204);
      expect((await as("GET", `/projects/${id}`)).statusCode).toBe(404);
      expect((await as("GET", "/stats")).json()).toEqual({ projects: 0, tasks: 0, logs: 0 });
    });

    it("round-trips backups (with fresh ids) and loads sample data", async () => {
      await as("POST", "/sample");
      const backup = (await as("GET", "/backup")).json();
      expect(backup.projects).toHaveLength(3);

      await as("DELETE", "/data");
      expect((await as("PUT", "/backup", backup)).statusCode).toBe(200);
      const restored = (await as("GET", "/backup")).json();
      // Ids are new and exports are ordered by id, so compare content regardless of order.
      const byJson = (a: unknown, b: unknown) => JSON.stringify(a).localeCompare(JSON.stringify(b));
      const strip = (d: typeof backup) => ({
        projects: d.projects.map(({ id: _id, ...p }: Record<string, unknown>) => p).sort(byJson),
        tasks: d.tasks.map(({ id: _id, projectId: _p, ...t }: Record<string, unknown>) => t).sort(byJson),
        logs: d.logs.length,
      });
      expect(strip(restored)).toEqual(strip(backup));
      expect(restored.projects[0].id).not.toBe(backup.projects[0].id);

      // Another user can restore the same file without clashing.
      const other = await signUp("other@example.com");
      expect((await call("PUT", "/backup", backup, other)).statusCode).toBe(200);

      const list = (await as("GET", "/projects")).json<ProjectView[]>();
      expect(list.map((v) => v.forecast.health)).toEqual(["late", "at-risk", "on-track"]);
    });

    it("adds sample data next to the user's own projects instead of replacing them", async () => {
      const mine = await createProject();
      await as("POST", "/sample");
      await as("POST", "/sample");
      const list = (await as("GET", "/projects")).json<ProjectView[]>();
      expect(list).toHaveLength(7);
      expect((await view(mine)).tasks.map((t) => t.title)).toEqual(["A", "B"]);
    });

    it("refuses service calls without a user id (Prisma would treat undefined as 'everyone')", async () => {
      const { createService } = await import("./service.ts");
      const svc = createService(db);
      await createProject();
      expect(() => svc.replaceAll(undefined as never, { version: 1, projects: [], tasks: [], logs: [] })).toThrow(
        /valid user id/,
      );
      expect((await as("GET", "/stats")).json().projects).toBe(1);
    });

    it("restores older backups with one category and no priority", async () => {
      const backup = (await (await as("POST", "/sample"), as("GET", "/backup"))).json();
      backup.tasks = backup.tasks.map(({ categories, priority: _p, ...t }: Record<string, unknown>) => ({
        ...t,
        category: (categories as string[])[0],
        priority: null,
      }));
      expect((await as("PUT", "/backup", backup)).statusCode).toBe(200);
      const tasks = (await as("GET", "/backup")).json().tasks;
      expect(tasks.every((t: { categories: string[]; priority: string }) => t.categories.length === 1 && t.priority === "could")).toBe(true);
    });

    it("rejects broken backups without touching data", async () => {
      await as("POST", "/sample");
      const res = await as("PUT", "/backup", { version: 1, projects: [], tasks: [{ id: "x" }], logs: [] });
      expect(res.statusCode).toBe(400);
      expect((await as("GET", "/stats")).json().projects).toBe(3);
    });
  });
});
