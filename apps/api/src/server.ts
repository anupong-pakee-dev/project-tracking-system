// On Vercel this file is bundled by scripts/vercel-build.mjs and its default export handles
// every request.
import type { IncomingMessage, ServerResponse } from "node:http";
import { createGoogleOAuth } from "./auth/google.ts";
import { buildApp } from "./create-app.ts";
import { createDb } from "./db.ts";
import { env } from "./env.ts";
import { createSmtpMailer } from "./mailer.ts";

const db = createDb(env.databaseUrl, env.dbPoolMax);
const app = await buildApp({
  db,
  mailer: createSmtpMailer(env.smtpUrl, env.mailFrom),
  appUrl: env.appUrl,
  apiToken: env.apiToken,
  logLevel: env.logLevel,
  // Google redirects back to apps/web, which hands the code to POST /auth/google.
  google: env.google && createGoogleOAuth({ ...env.google, redirectUri: `${env.appUrl}/auth/google/callback` }),
});

/**
 * Vercel calls this for every request. Don't `listen()` there: Vercel stubs out
 * `Server#listen` so it never emits "listening", and awaiting it at the top level would
 * keep this module from ever finishing loading — every request then hangs until timeout.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await app.ready();
  app.server.emit("request", req, res);
}

// Prisma's pg adapter sends timestamps as UTC without an offset; any other session TimeZone
// silently shifts every stored timestamp. Not awaited, so it never delays startup.
async function checkDatabaseTimeZone() {
  try {
    const [{ tz }] = await db.$queryRaw<{ tz: string }[]>`SELECT current_setting('TimeZone') AS tz`;
    if (!["UTC", "Etc/UTC", "GMT"].includes(tz)) {
      app.log.warn(`Database TimeZone is "${tz}" — set it to UTC: ALTER DATABASE <name> SET timezone TO 'UTC';`);
    }
  } catch (err) {
    app.log.warn({ err }, "Could not check the database TimeZone (is the database running?)");
  }
}

if (!process.env.VERCEL) {
  async function shutdown(signal: string) {
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    await db.$disconnect();
    process.exit(0);
  }
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ host: env.host, port: env.port });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void checkDatabaseTimeZone();
