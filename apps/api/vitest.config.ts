import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Makes TEST_DATABASE_URL from .env available (existing env vars win).
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
  },
});
