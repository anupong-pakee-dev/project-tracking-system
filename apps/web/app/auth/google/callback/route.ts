import { timingSafeEqual } from "node:crypto";
import type { SessionResponse } from "@tracker/shared/api";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { api, ApiError } from "@/lib/api";
import { GOOGLE_COOKIE, GOOGLE_COOKIE_PATH, type GoogleCookie } from "@/lib/google-auth";
import { safeNext, setSession } from "@/lib/session";

function readCookie(raw: string | undefined): GoogleCookie | null {
  try {
    const v = JSON.parse(raw ?? "") as Partial<GoogleCookie>;
    return typeof v.state === "string" && typeof v.codeVerifier === "string" ? (v as GoogleCookie) : null;
  } catch {
    return null;
  }
}

const sameState = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Step 2 of Google sign-in: Google redirects here with ?code&state (or ?error).
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const jar = await cookies();
  const saved = readCookie(jar.get(GOOGLE_COOKIE)?.value);
  jar.delete({ name: GOOGLE_COOKIE, path: GOOGLE_COOKIE_PATH });

  if (params.get("error")) redirect("/login?error=GOOGLE_CANCELLED");
  const code = params.get("code");
  const state = params.get("state");
  // The state must match the one this browser started with — stops someone else's sign-in
  // from being completed in this browser.
  if (!saved || !code || !state || !sameState(state, saved.state)) redirect("/login?error=GOOGLE_STATE");

  let errorCode: string | null = null;
  try {
    await setSession(
      await api<SessionResponse>("POST", "/auth/google", { code, codeVerifier: saved.codeVerifier }),
    );
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    errorCode = err.code ?? "GOOGLE_FAILED";
  }
  redirect(errorCode ? `/login?error=${errorCode}` : safeNext(saved.next));
}
