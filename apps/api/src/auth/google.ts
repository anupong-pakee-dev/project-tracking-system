import { createHash, randomBytes } from "node:crypto";
import { bi } from "@tracker/shared/i18n";
import { HttpError } from "../errors.ts";

/** What we take from Google's ID token. */
export interface GoogleProfile {
  /** Google's stable account id. */
  sub: string;
  email: string;
  emailVerified: boolean;
}

/** Google sign-in (OAuth 2.0 authorization code + PKCE). Swappable so tests don't call Google. */
export interface GoogleOAuth {
  /** The URL to send the browser to. */
  authUrl(params: { state: string; codeChallenge: string }): string;
  /** Exchanges the code Google returned for the signed-in account. */
  exchange(code: string, codeVerifier: string): Promise<GoogleProfile>;
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** Must be listed under "Authorized redirect URIs" in Google Cloud Console. */
  redirectUri: string;
}

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

/** A random PKCE verifier and its S256 challenge. */
export function newPkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  return { codeVerifier, codeChallenge: createHash("sha256").update(codeVerifier).digest("base64url") };
}

const failed = (cause?: unknown) =>
  Object.assign(new HttpError(400, bi("Google sign-in failed — please try again", "เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองใหม่อีกครั้ง"), "GOOGLE_FAILED"), { cause });

export function createGoogleOAuth({ clientId, clientSecret, redirectUri }: GoogleOAuthConfig): GoogleOAuth {
  return {
    authUrl({ state, codeChallenge }) {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        prompt: "select_account",
      });
      return `${AUTH_ENDPOINT}?${params}`;
    },

    async exchange(code, codeVerifier) {
      let res: Response;
      try {
        res = await fetch(TOKEN_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            code_verifier: codeVerifier,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err) {
        throw Object.assign(new HttpError(502, bi("Couldn't reach Google — please try again", "ติดต่อ Google ไม่ได้ ลองใหม่อีกครั้ง")), { cause: err });
      }
      const data = (await res.json().catch(() => null)) as { id_token?: unknown; error?: unknown } | null;
      if (!res.ok || typeof data?.id_token !== "string") throw failed(data?.error);

      // The ID token came straight from Google's token endpoint over TLS, so its signature
      // doesn't need checking (OpenID Connect Core §3.1.3.7) — only its claims.
      let claims: Record<string, unknown>;
      try {
        claims = JSON.parse(Buffer.from(data.id_token.split(".")[1] ?? "", "base64url").toString("utf8"));
      } catch (err) {
        throw failed(err);
      }
      const { iss, aud, exp, sub, email, email_verified } = claims;
      if (
        !ISSUERS.has(iss as string) ||
        aud !== clientId ||
        typeof exp !== "number" ||
        exp * 1000 < Date.now() ||
        typeof sub !== "string" ||
        typeof email !== "string"
      ) {
        throw failed("unexpected id_token claims");
      }
      return { sub, email: email.toLowerCase(), emailVerified: email_verified === true };
    },
  };
}
