import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: no session cookie → send to /login. Whether the session is actually
// valid is decided by the API on every request (an expired one also ends up at /login).
const SESSION_COOKIE = "tracker_session"; // keep in sync with lib/session.ts

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/check-email",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/auth/google", // Google sign-in start + callback (app/auth/google)
  "/robots.txt",
];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic || req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // email-logo.png is loaded by mail clients, which are never signed in.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|email-logo.png).*)"],
};
