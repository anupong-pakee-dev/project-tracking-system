// Runs before `npm run dev` / `npm start`: if apps/api/.env points at the local Docker
// Postgres, make sure the container is up. Does nothing for Supabase/Neon URLs.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const envFile = "apps/api/.env";
if (!existsSync(envFile)) {
  console.error(`ไม่พบ ${envFile} — คัดลอกจาก apps/api/.env.example ก่อน`);
  process.exit(1);
}

const url = process.env.DATABASE_URL ?? parseEnv(readFileSync(envFile, "utf8")).DATABASE_URL ?? "";
let host = "";
let port = "";
try {
  ({ hostname: host, port } = new URL(url));
} catch {
  // Not a URL — leave it to the API to report.
}

const isLocalDocker = ["localhost", "127.0.0.1"].includes(host) && (port || "5432") === "5432";
if (!isLocalDocker) process.exit(0);

try {
  execSync("docker compose up -d --wait", { stdio: "inherit" });
} catch {
  console.error("\nเริ่มฐานข้อมูล local ไม่สำเร็จ — เปิด Docker Desktop แล้วลองใหม่ (หรือรัน `docker compose up -d`)\n");
  process.exit(1);
}

// Keep the local schema current, so a fresh clone works with just `npm run dev`.
try {
  execSync("npx prisma migrate deploy", { cwd: "apps/api", stdio: "pipe" });
} catch (err) {
  console.error("apply migrations ไม่สำเร็จ:\n" + (err.stderr?.toString() || err.message));
  process.exit(1);
}
