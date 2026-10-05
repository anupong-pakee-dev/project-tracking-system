// Creates apps/api/.env and apps/web/.env.local from their .env.example templates, with one
// freshly generated API_TOKEN shared by both. Existing files are never overwritten.
//   npm run setup:env
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";

const targets = [
  { example: "apps/api/.env.example", file: "apps/api/.env" },
  { example: "apps/web/.env.example", file: "apps/web/.env.local" },
];

// Reuse a token that's already set in either file, so the two always match.
const existingToken = targets
  .filter((t) => existsSync(t.file))
  .map((t) => parseEnv(readFileSync(t.file, "utf8")).API_TOKEN)
  .find(Boolean);
const token = existingToken ?? randomBytes(32).toString("hex");

for (const { example, file } of targets) {
  if (existsSync(file)) {
    console.log(`• ${file} already exists — left unchanged`);
    continue;
  }
  copyFileSync(example, file);
  const content = readFileSync(file, "utf8").replace(/^API_TOKEN=.*$/m, `API_TOKEN=${token}`);
  writeFileSync(file, content);
  console.log(`✓ created ${file}`);
}

const tokens = targets.filter((t) => existsSync(t.file)).map((t) => parseEnv(readFileSync(t.file, "utf8")).API_TOKEN);
if (new Set(tokens).size > 1) {
  console.warn("\n⚠ API_TOKEN differs between apps/api/.env and apps/web/.env.local — make them identical.");
} else {
  console.log("\nAPI_TOKEN matches in both files. Next: `npm run dev` (Docker Desktop must be running).");
}
