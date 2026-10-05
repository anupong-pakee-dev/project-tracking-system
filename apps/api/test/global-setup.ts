import { execSync } from "node:child_process";

/** Brings the test database up to the current schema before the integration tests run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return; // integration tests skip themselves

  const realDbs = [process.env.DATABASE_URL, process.env.DIRECT_URL, process.env.DATABASE_URL_UNPOOLED];
  if (realDbs.includes(url)) {
    throw new Error("TEST_DATABASE_URL must not be your real database — the tests wipe it.");
  }

  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
