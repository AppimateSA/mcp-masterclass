import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "./config";

/**
 * Google is used only as the identity provider ("Sign in with Google", OIDC).
 * Create an OAuth client in Google Cloud Console → APIs & Services → Credentials:
 *   type: Web application
 *   authorised redirect URI: https://<your-app>.vercel.app/oauth/google/callback
 *                            http://localhost:3000/oauth/google/callback
 */

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export interface GoogleIdentity {
  sub: string; // stable Google account id: use this as the customer key, not the email
  email: string;
  name?: string;
  hd?: string; // Google Workspace domain, if any
}

export function googleCallbackUrl(issuer: string) {
  return `${issuer}/oauth/google/callback`;
}

export function googleAuthorizeUrl(opts: { issuer: string; state: string; nonce: string }) {
  const url = new URL(GOOGLE_AUTH);
  url.search = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: googleCallbackUrl(opts.issuer),
    response_type: "code",
    scope: "openid email profile",
    state: opts.state,
    nonce: opts.nonce,
    prompt: "select_account",
  }).toString();
  return url.toString();
}

export async function exchangeGoogleCode(opts: { issuer: string; code: string; nonce: string }): Promise<GoogleIdentity> {
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: opts.code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: googleCallbackUrl(opts.issuer),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new Error("Google returned no id_token");

  const { payload } = await jwtVerify(id_token, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.googleClientId,
  });
  if (payload.nonce !== opts.nonce) throw new Error("Google id_token nonce mismatch");
  if (payload.email_verified !== true) throw new Error("Google account email is not verified");

  const identity: GoogleIdentity = {
    sub: String(payload.sub),
    email: String(payload.email).toLowerCase(),
    name: typeof payload.name === "string" ? payload.name : undefined,
    hd: typeof payload.hd === "string" ? payload.hd : undefined,
  };

  const allowed = env.allowedEmailDomains;
  if (allowed.length && !allowed.includes(identity.email.split("@")[1])) {
    throw new Error("This Google account's domain is not allowed to use this server");
  }
  return identity;
}
