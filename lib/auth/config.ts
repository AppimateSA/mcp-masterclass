import { getPublicOrigin } from "mcp-handler";

/**
 * Stage 4 configuration. See .env.example.
 *
 * The shape of the auth, in one sentence:
 *   Google tells us WHO the person is; this server issues its OWN short-lived
 *   access token, bound to this MCP endpoint, that clients send on every call.
 *
 * Why not hand Google's token straight to the MCP server? Google does not
 * support MCP client registration (CIMD or DCR) and its access tokens are not
 * bound to our resource URL (RFC 8707). So this app is a small OAuth 2.1
 * authorization server that delegates the login step to Google.
 */

export const SCOPES = ["prices:read"] as const;
export const ACCESS_TOKEN_TTL_S = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_S = 60 * 60 * 24 * 30; // 30 days
export const AUTH_CODE_TTL_S = 60; // codes are one-shot and short-lived
export const TXN_TTL_S = 10 * 60; // time allowed to finish the Google login

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}

export const env = {
  get googleClientId() {
    return required("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret() {
    return required("GOOGLE_CLIENT_SECRET");
  },
  get authSecret() {
    const s = required("AUTH_SECRET");
    if (s.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters (openssl rand -base64 48)");
    return s;
  },
  /** Optional: restrict sign-in to these email domains, e.g. "thecortexhub.africa,appimate.com". */
  get allowedEmailDomains(): string[] {
    return (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  },
};

/**
 * The public origin is the OAuth issuer. Set PUBLIC_BASE_URL in production so
 * the issuer is stable across preview and production deployments.
 */
export function issuer(req: Request): string {
  // `||`, not `??`: a blank PUBLIC_BASE_URL= copied from .env.example must fall back too.
  return (process.env.PUBLIC_BASE_URL || getPublicOrigin(req)).replace(/\/+$/, "");
}

/** The protected resource (RFC 8707 / RFC 9728): the MCP endpoint itself. */
export function resourceUrl(req: Request): string {
  return `${issuer(req)}/api/mcp`;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
};
