// Imports a JSON backup (or the old data/tracker.json) into one user's account.
//   npm run db:import-json                                  → ../../data/tracker.json into the only account
//   npm run db:import-json -- path/to/file.json             → a backup file
//   npm run db:import-json -- --email you@example.com       → pick the account when there are several
//   add --force to replace an account that already has projects
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createDb } from "../src/db.ts";
import { env } from "../src/env.ts";
import { backupFile, describeZodError } from "../src/schemas.ts";
import { createService } from "../src/service.ts";

const args = process.argv.slice(2);
const force = args.includes("--force");
const emailArg = args.includes("--email") ? args[args.indexOf("--email") + 1]?.toLowerCase() : undefined;
const fileArg = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--email");
const file = path.resolve(fileArg ?? "../../data/tracker.json");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const parsed = backupFile.safeParse(JSON.parse(await readFile(file, "utf8")));
if (!parsed.success) fail(`ไฟล์ไม่ถูกต้อง: ${describeZodError(parsed.error)}`);

const db = createDb(env.databaseUrl, env.dbPoolMax);
try {
  const users = await db.user.findMany({
    where: emailArg ? { email: emailArg } : {},
    select: { id: true, email: true },
  });
  if (users.length === 0) {
    fail(emailArg ? `ไม่พบบัญชี ${emailArg}` : "ยังไม่มีบัญชี — สมัครและยืนยันอีเมลในหน้าเว็บก่อน");
  }
  if (users.length > 1) {
    fail(`มีหลายบัญชี ระบุด้วย --email: ${users.map((u) => u.email).join(", ")}`);
  }
  const user = users[0];

  const svc = createService(db);
  const { projects } = await svc.counts(user.id);
  if (projects > 0 && !force) fail(`${user.email} มี ${projects} โปรเจคอยู่แล้ว — เพิ่ม --force เพื่อแทนที่ทั้งหมด`);

  await svc.replaceAll(user.id, parsed.data);
  const d = parsed.data;
  console.log(`นำเข้า ${d.projects.length} โปรเจค, ${d.tasks.length} งาน, ${d.logs.length} ประวัติ ให้ ${user.email}`);
} finally {
  await db.$disconnect();
}
