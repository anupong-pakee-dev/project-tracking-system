// Build step for the API project on Vercel (see apps/api/vercel.json).
//   1. generate the Prisma client
//   2. on PRODUCTION deploys only, apply pending migrations
//      (uses DIRECT_URL, else DATABASE_URL_UNPOOLED from the Neon integration, else DATABASE_URL)
//   3. bundle src/server.ts into one file and emit it with the Build Output API
//      (.vercel/output), so Vercel deploys exactly that bundle and never compiles our TypeScript
//      itself — its per-file compiler can't resolve `.ts` imports or @tracker/shared (shipped as
//      .ts source) and every request would fail with ERR_MODULE_NOT_FOUND.
// Preview deploys skip migrations so they can never change the production schema. Set
// RUN_MIGRATIONS=1 on a preview environment that has its own database (e.g. Neon preview
// branching) to migrate it too.
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

run("npx prisma generate");

const env = process.env.VERCEL_ENV ?? "local";
if (env === "production" || process.env.RUN_MIGRATIONS === "1") {
  if (!process.env.DIRECT_URL && !process.env.DATABASE_URL_UNPOOLED && !process.env.DATABASE_URL) {
    console.error("DATABASE_URL / DIRECT_URL is not set — cannot apply migrations.");
    process.exit(1);
  }
  console.log(`Applying migrations (${env})…`);
  run("npx prisma migrate deploy");
} else {
  console.log(`Skipping migrations on "${env}" deploy.`);
}

const out = ".vercel/output";
const fn = `${out}/functions/index.func`;
rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });

await build({
  entryPoints: ["src/server.ts"],
  outfile: `${fn}/index.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  sourcemap: true,
  // Some CommonJS dependencies call require() — give the ESM bundle one.
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  logLevel: "info",
});

writeFileSync(
  `${fn}/.vc-config.json`,
  JSON.stringify({
    runtime: "nodejs24.x",
    handler: "index.mjs",
    launcherType: "Nodejs",
    shouldAddHelpers: false,
    shouldAddSourcemapSupport: true,
    supportsResponseStreaming: true,
  }),
);
// Every path goes to the one function; Fastify does the routing.
writeFileSync(`${out}/config.json`, JSON.stringify({ version: 3, routes: [{ src: "/(.*)", dest: "/index" }] }));
console.log(`Wrote ${out}`);
