import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoogleOAuth } from "./google.ts";

const config = { clientId: "client-123", clientSecret: "secret", redirectUri: "https://web.test/auth/google/callback" };
const google = createGoogleOAuth(config);

const idToken = (claims: object) =>
  ["header", Buffer.from(JSON.stringify(claims)).toString("base64url"), "signature"].join(".");

const valid = {
  iss: "https://accounts.google.com",
  aud: "client-123",
  exp: Math.floor(Date.now() / 1000) + 3600,
  sub: "1234567890",
  email: "Me@Gmail.com",
  email_verified: true,
};

function mockTokenEndpoint(body: object, status = 200) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe("Google OAuth", () => {
  it("builds an auth URL with PKCE and the configured redirect", () => {
    const url = new URL(google.authUrl({ state: "s", codeChallenge: "c" }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "client-123",
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid email",
      state: "s",
      code_challenge: "c",
      code_challenge_method: "S256",
    });
  });

  it("exchanges the code and reads the ID token", async () => {
    const fetch = mockTokenEndpoint({ id_token: idToken(valid) });
    await expect(google.exchange("the-code", "the-verifier")).resolves.toEqual({
      sub: "1234567890",
      email: "me@gmail.com",
      emailVerified: true,
    });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = new URLSearchParams(String(init.body));
    expect(body.get("code")).toBe("the-code");
    expect(body.get("code_verifier")).toBe("the-verifier");
    expect(body.get("redirect_uri")).toBe(config.redirectUri);
  });

  it.each([
    ["another app's token", { aud: "someone-else" }],
    ["a foreign issuer", { iss: "https://evil.test" }],
    ["an expired token", { exp: Math.floor(Date.now() / 1000) - 10 }],
    ["no email", { email: undefined }],
  ])("rejects %s", async (_, override) => {
    mockTokenEndpoint({ id_token: idToken({ ...valid, ...override }) });
    await expect(google.exchange("code", "verifier")).rejects.toMatchObject({ status: 400, code: "GOOGLE_FAILED" });
  });

  it("passes on email_verified", async () => {
    mockTokenEndpoint({ id_token: idToken({ ...valid, email_verified: false }) });
    expect((await google.exchange("code", "verifier")).emailVerified).toBe(false);
  });

  it("fails cleanly when Google rejects the code", async () => {
    mockTokenEndpoint({ error: "invalid_grant" }, 400);
    await expect(google.exchange("code", "verifier")).rejects.toMatchObject({ status: 400, code: "GOOGLE_FAILED" });
  });
});
