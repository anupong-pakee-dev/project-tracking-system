import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt parameters (OWASP: N=2^17,r=8,p=1 is ideal; 2^15 keeps login < ~100ms on a laptop).
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const MAX_MEM = 128 * N * R * 2;

function scryptAsync(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_LEN, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Returns `scrypt$N$r$p$salt$hash` (base64url parts). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, { N, r: R, p: P, maxmem: MAX_MEM });
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scryptAsync(password, Buffer.from(salt, "base64url"), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 128 * Number(n) * Number(r) * 2,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A hash of a random password, used to keep login timing equal for unknown emails. */
export const DUMMY_HASH = await hashPassword(randomBytes(16).toString("hex"));

/** A random URL-safe token and the SHA-256 hash we store instead of it. */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
