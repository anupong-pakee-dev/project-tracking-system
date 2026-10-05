// Copies one account's projects back from an older copy of the database (e.g. a Neon branch
// restored to a point in time before the data was lost) into the live database.
//
//   RECOVER_FROM="<old branch url>" RECOVER_TO="<live database url>" \
//     npm run db:recover -w @tracker/api -- --email you@example.com            → dry run: shows what it would copy
//   … same, plus --apply                                                       → copies it
//
// Only adds: projects (with their tasks and history) that exist in the old copy but not in the
// live database. Nothing in the live database is changed or deleted, and running it twice is safe.
import { createDb } from "../src/db.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const email = args.includes("--email") ? args[args.indexOf("--email") + 1]?.toLowerCase() : undefined;
const from = process.env.RECOVER_FROM;
const to = process.env.RECOVER_TO;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!from || !to) fail("Set RECOVER_FROM (old copy) and RECOVER_TO (live database) to Postgres connection URLs.");
if (from === to) fail("RECOVER_FROM and RECOVER_TO are the same database.");
if (!email) fail("Pass --email <the account's email>.");

const source = createDb(from, 2);
const target = createDb(to, 2);
try {
  const [oldUser, liveUser] = await Promise.all([
    source.user.findUnique({ where: { email } }),
    target.user.findUnique({ where: { email } }),
  ]);
  if (!oldUser) fail(`No account ${email} in the old copy.`);
  if (!liveUser) fail(`No account ${email} in the live database.`);

  const projects = await source.project.findMany({
    where: { userId: oldUser.id },
    include: { tasks: true, logs: true },
    orderBy: { createdAt: "asc" },
  });
  const existing = new Set(
    (await target.project.findMany({ where: { id: { in: projects.map((p) => p.id) } }, select: { id: true } })).map((p) => p.id),
  );
  const missing = projects.filter((p) => !existing.has(p.id));

  console.log(`Old copy: ${projects.length} project(s) for ${email}; ${missing.length} not in the live database:`);
  for (const p of missing) {
    console.log(`  • ${p.name} — ${p.tasks.length} task(s), ${p.logs.length} history entr${p.logs.length === 1 ? "y" : "ies"}`);
  }
  if (!missing.length) process.exit(0);
  if (!apply) {
    console.log("\nDry run — nothing copied. Add --apply to copy these.");
    process.exit(0);
  }

  await target.$transaction(async (tx) => {
    for (const { tasks, logs, ...p } of missing) {
      // Same ids as before, so a second run skips what's already back.
      await tx.project.create({ data: { ...p, userId: liveUser.id } });
      if (tasks.length) await tx.task.createMany({ data: tasks, skipDuplicates: true });
      if (logs.length) await tx.progressLog.createMany({ data: logs, skipDuplicates: true });
    }
  });
  console.log(`\nCopied ${missing.length} project(s) back into ${email}'s account.`);
} finally {
  await Promise.all([source.$disconnect(), target.$disconnect()]);
}

