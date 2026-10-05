import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need a direct (non-pooled) connection: DIRECT_URL, or DATABASE_URL_UNPOOLED as
    // set by Vercel's Neon integration; otherwise DATABASE_URL is used for both.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  },
});
