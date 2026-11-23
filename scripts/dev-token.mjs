// LOCAL TESTING ONLY: mint an access token without going through Google,
// signed with your AUTH_SECRET, for http://localhost:3000.
//   AUTH_SECRET=... node scripts/dev-token.mjs [email]
// Then: MCP_TOKEN=<token> npm run smoke
import { SignJWT } from "jose";

const secret = process.env.AUTH_SECRET;
if (!secret || secret.length < 32) {
  console.error("Set AUTH_SECRET (same value as the dev server's .env.local)");
  process.exit(1);
}
const base = (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(base)) {
  console.error("dev-token only targets a local server. Use the real Google sign-in for deployments.");
  process.exit(1);
}
const email = process.argv[2] ?? "tester@example.com";

const token = await new SignJWT({ typ: "access", email, name: "Local Tester", client_id: "dev-token-script", client_name: "dev-token script", scope: "prices:read" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuer(base)
  .setAudience(`${base}/api/mcp`)
  .setSubject(`google:dev-${email}`)
  .setIssuedAt()
  .setJti(crypto.randomUUID())
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(secret));

console.log(token);
