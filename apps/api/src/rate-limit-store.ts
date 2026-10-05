import { createHash } from "node:crypto";
import type { FastifyRateLimitOptions, FastifyRateLimitStore } from "@fastify/rate-limit";
import type { Db } from "./db.ts";

type IncrCallback = Parameters<FastifyRateLimitStore["incr"]>[1];

/**
 * A @fastify/rate-limit store backed by Postgres, so limits hold across all serverless
 * instances. One atomic upsert per counted request; expired windows restart at 1.
 */
export function createPgRateLimitStore(db: Db) {
  return class PgRateLimitStore implements FastifyRateLimitStore {
    private readonly route: string;

    constructor(_options?: FastifyRateLimitOptions, route = "") {
      this.route = route;
    }

    incr(key: string, callback: IncrCallback, timeWindow: number): void {
      const hashed = createHash("sha256").update(`${this.route}|${key}`).digest("hex");
      const windowSecs = timeWindow / 1000;
      db.$queryRaw<{ count: number; ttl: number }[]>`
        INSERT INTO rate_limits (key, count, reset_at)
        VALUES (${hashed}, 1, now() + make_interval(secs => ${windowSecs}))
        ON CONFLICT (key) DO UPDATE SET
          count    = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
          reset_at = CASE WHEN rate_limits.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
        RETURNING count, GREATEST(0, (extract(epoch FROM reset_at - now()) * 1000))::int AS ttl`
        .then(([row]) => {
          callback(null, { current: row.count, ttl: row.ttl });
          // Occasionally sweep long-expired windows.
          if (Math.random() < 0.02) {
            db.$executeRaw`DELETE FROM rate_limits WHERE reset_at < now() - interval '1 hour'`.catch(() => undefined);
          }
        })
        .catch((err: Error) => callback(err));
    }

    child(routeOptions: { method?: string | string[]; url?: string; path?: string }): FastifyRateLimitStore {
      return new PgRateLimitStore(undefined, `${routeOptions.method}:${routeOptions.url ?? routeOptions.path}`);
    }
  };
}
