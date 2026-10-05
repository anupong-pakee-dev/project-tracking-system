import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import pg from "pg";
import { PrismaClient } from "./generated/prisma/client.ts";

export type Db = PrismaClient;
/** The client handed to `$transaction(async (tx) => …)` callbacks. */
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const onVercel = Boolean(process.env.VERCEL);

/**
 * @param poolMax max connections in the pool. Defaults to 10 locally and 5 on Vercel, where many
 * function instances share the database — use the provider's pooled URL there.
 */
export function createDb(connectionString: string, poolMax?: number): Db {
  const pool = new pg.Pool({
    connectionString,
    max: poolMax ?? (onVercel ? 5 : 10),
    // Release idle connections quickly on serverless so instances don't hoard them.
    idleTimeoutMillis: onVercel ? 5_000 : 30_000,
    connectionTimeoutMillis: 10_000,
  });
  // Lets Fluid compute close idle clients before an instance is suspended.
  if (onVercel) attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}
