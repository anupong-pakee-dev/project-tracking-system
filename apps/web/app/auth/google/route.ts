import type { GoogleStartResponse } from "@tracker/shared/api";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { api, ApiError } from "@/lib/api";
import { GOOGLE_COOKIE, GOOGLE_COOKIE_PATH, type GoogleCookie } from "@/lib/google-auth";
import { safeNext } from "@/lib/session";

// Step 1 of Google sign-in: remember state + PKCE verifier in a short-lived cookie, then go to Google.
export async function GET(req: NextRequest) {
  let start: GoogleStartResponse;
  try {
    start = await api<GoogleStartResponse>("POST", "/auth/google/start");
  } catch (err) {
    const code = err instanceof ApiError ? (err.code ?? "GOOGLE_FAILED") : "GOOGLE_FAILED";
    redirect(`/login?error=${code}`);
  }

  const value: GoogleCookie = {
    state: start.state,
    codeVerifier: start.codeVerifier,
    next: safeNext(req.nextUrl.searchParams.get("next")),
  };
  (await cookies()).set(GOOGLE_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    // Lax still sends it on Google's top-level redirect back to the callback.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: GOOGLE_COOKIE_PATH,
    maxAge: 10 * 60,
  });
  redirect(start.url);
}
