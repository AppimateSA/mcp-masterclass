import { verify } from "./tokens";

/**
 * Who is the MCP *client* (Claude, VS Code, Cursor, the Inspector)?
 *
 * Two ways a client identifies itself to this authorization server:
 *  1. Client ID Metadata Document (CIMD), preferred by MCP 2026-07-28:
 *     the client_id IS an https URL serving the client's JSON metadata.
 *  2. Dynamic Client Registration (DCR), deprecated but still common:
 *     the client POSTs to /oauth/register and gets a client_id back.
 *     Here that client_id is a signed JWT, so no database is needed.
 */

export interface ResolvedClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  kind: "cimd" | "dcr";
}

const cimdCache = new Map<string, { client: ResolvedClient; expires: number }>();

export async function resolveClient(clientId: string, issuer: string): Promise<ResolvedClient> {
  if (clientId.startsWith("https://")) return fetchCimd(clientId);

  const claims = await verify<{ redirect_uris: string[]; client_name?: string }>("client", clientId, { issuer });
  return {
    clientId,
    clientName: claims.client_name ?? "MCP client",
    redirectUris: claims.redirect_uris,
    kind: "dcr",
  };
}

async function fetchCimd(clientId: string): Promise<ResolvedClient> {
  const cached = cimdCache.get(clientId);
  if (cached && cached.expires > Date.now()) return cached.client;

  const url = new URL(clientId);
  // Basic SSRF guard. A production server should also refuse private IP ranges after DNS resolution.
  if (url.pathname === "/" || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(url.hostname)) {
    throw new Error("client_id metadata URL is not allowed");
  }

  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000), redirect: "error" });
  if (!res.ok) throw new Error(`Could not fetch client metadata (${res.status})`);
  const text = await res.text();
  if (text.length > 64_000) throw new Error("Client metadata document too large");
  const doc = JSON.parse(text) as { client_id?: string; client_name?: string; redirect_uris?: string[] };

  if (doc.client_id !== clientId) throw new Error("client_id in metadata document does not match its URL");
  if (!Array.isArray(doc.redirect_uris) || doc.redirect_uris.length === 0) throw new Error("Metadata has no redirect_uris");

  const client: ResolvedClient = {
    clientId,
    clientName: doc.client_name ?? url.hostname,
    redirectUris: doc.redirect_uris,
    kind: "cimd",
  };
  cimdCache.set(clientId, { client, expires: Date.now() + 5 * 60_000 });
  return client;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Accept https, http on loopback only, or a private-use scheme (cursor://, vscode://). */
export function isAcceptableRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:") return LOOPBACK.has(u.hostname);
    return !["javascript:", "data:", "file:", "vbscript:"].includes(u.protocol);
  } catch {
    return false;
  }
}

/**
 * Exact match, except for loopback http URIs, where the port may differ
 * (RFC 8252 §7.3: native apps pick a free port at runtime).
 */
export function redirectUriMatches(requested: string, registered: string[]): boolean {
  if (registered.includes(requested)) return true;
  let r: URL;
  try {
    r = new URL(requested);
  } catch {
    return false;
  }
  if (r.protocol !== "http:" || !LOOPBACK.has(r.hostname)) return false;
  return registered.some((reg) => {
    try {
      const g = new URL(reg);
      return g.protocol === "http:" && g.hostname === r.hostname && g.pathname === r.pathname && g.search === r.search;
    } catch {
      return false;
    }
  });
}
