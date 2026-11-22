import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { SCOPES, issuer, resourceUrl } from "@/lib/auth/config";
import { verify } from "@/lib/auth/tokens";
import { registerServer } from "@/lib/mcp/server";
import { SERVER_NAME, SERVER_VERSION } from "@/lib/version";

/**
 * Stage 4: the MCP endpoint now requires a Bearer token issued by this
 * server's own OAuth layer (after "Sign in with Google").
 * No token → 401 with a WWW-Authenticate header pointing at
 * /.well-known/oauth-protected-resource/api/mcp, which is how MCP clients
 * discover where to send the user to sign in.
 */
export const maxDuration = 60;

const handler = createMcpHandler(registerServer, {
  serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
  instructions:
    "Fresh-produce prices (ZAR/kg) for five South African markets. Sample data: always quote the source and asOf date. " +
    "Calls are metered per customer; my_usage shows the plan, limits and usage.",
});

async function verifyToken(req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;
  try {
    const resource = resourceUrl(req);
    const t = await verify<{ sub: string; email: string; name?: string; client_id: string; client_name?: string; scope: string; exp: number }>(
      "access",
      bearer,
      { issuer: issuer(req), audience: resource }, // audience check: tokens for other servers are refused
    );
    return {
      token: bearer,
      clientId: await shortClientId(t.client_id),
      scopes: t.scope.split(" "),
      expiresAt: t.exp,
      resource: new URL(resource),
      extra: { sub: t.sub, email: t.email, name: t.name, clientName: t.client_name },
    };
  } catch {
    return undefined; // expired, wrong signature or wrong audience → 401
  }
}

/** CIMD client ids are readable URLs; DCR ids are long JWTs, so log a short fingerprint instead. */
async function shortClientId(clientId: string): Promise<string> {
  if (clientId.startsWith("https://") || clientId.length < 64) return clientId;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(clientId));
  return `dcr:${Buffer.from(digest).toString("hex").slice(0, 12)}`;
}

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: [...SCOPES],
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
