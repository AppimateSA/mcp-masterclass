import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "./config";

/**
 * Every artefact this server hands out is a signed JWT with a `typ` claim, so
 * the server stays stateless (no database needed to run on Vercel):
 *
 *   client   - a dynamically registered client (DCR)
 *   txn      - an in-flight login while the user is at Google
 *   code     - the authorization code (60 s, single use)
 *   access   - the access token MCP clients send as `Authorization: Bearer`
 *   refresh  - the refresh token
 *
 * A production service would usually keep refresh tokens and registrations in
 * a database so they can be listed and revoked. The shapes stay the same.
 */
export type TokenType = "client" | "txn" | "code" | "access" | "refresh";

const key = () => new TextEncoder().encode(env.authSecret);

export async function sign(
  typ: TokenType,
  claims: Record<string, unknown>,
  opts: { issuer: string; audience?: string; ttlSeconds?: number; subject?: string },
): Promise<string> {
  let jwt = new SignJWT({ ...claims, typ })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(opts.issuer)
    .setIssuedAt()
    .setJti(crypto.randomUUID());
  if (opts.audience) jwt = jwt.setAudience(opts.audience);
  if (opts.subject) jwt = jwt.setSubject(opts.subject);
  if (opts.ttlSeconds) jwt = jwt.setExpirationTime(`${opts.ttlSeconds}s`);
  return jwt.sign(key());
}

export async function verify<T extends JWTPayload = JWTPayload>(
  typ: TokenType,
  token: string,
  opts: { issuer: string; audience?: string },
): Promise<T & { typ: TokenType }> {
  const { payload } = await jwtVerify(token, key(), {
    issuer: opts.issuer,
    audience: opts.audience,
    algorithms: ["HS256"],
  });
  if (payload.typ !== typ) throw new Error(`Expected a ${typ} token`);
  return payload as T & { typ: TokenType };
}

/** PKCE S256: BASE64URL(SHA256(code_verifier)) must equal the code_challenge. */
export async function pkceS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return Buffer.from(digest).toString("base64url");
}

export function randomToken(bytes = 24): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");
}
