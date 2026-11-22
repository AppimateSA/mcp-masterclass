import type { NextRequest } from "next/server";
import { SCOPES, TXN_TTL_S, issuer, resourceUrl } from "@/lib/auth/config";
import { redirectUriMatches, resolveClient } from "@/lib/auth/clients";
import { googleAuthorizeUrl } from "@/lib/auth/google";
import { randomToken, sign } from "@/lib/auth/tokens";

/**
 * Step 1 of the login. An MCP client (Claude, VS Code...) sends the user here.
 * We check the client and its redirect URI, remember the request in a signed
 * "txn" token, and send the user to Google to sign in.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const iss = issuer(req);
  const clientId = p.get("client_id") ?? "";
  const redirectUri = p.get("redirect_uri") ?? "";

  // Until the client and redirect URI are verified, errors are shown here,
  // never redirected (an unverified redirect is an open redirector).
  let client;
  try {
    client = await resolveClient(clientId, iss);
  } catch (err) {
    return page(400, "Unknown client", `This app could not be identified (${(err as Error).message}).`);
  }
  if (!redirectUriMatches(redirectUri, client.redirectUris)) {
    return page(400, "Redirect not allowed", "The redirect_uri does not match the client's registration.");
  }

  const state = p.get("state") ?? undefined;
  const fail = (error: string, description: string) => {
    const url = new URL(redirectUri);
    url.searchParams.set("error", error);
    url.searchParams.set("error_description", description);
    if (state) url.searchParams.set("state", state);
    url.searchParams.set("iss", iss);
    return Response.redirect(url, 302);
  };

  if (p.get("response_type") !== "code") return fail("unsupported_response_type", "Only response_type=code is supported");
  const codeChallenge = p.get("code_challenge");
  if (!codeChallenge || p.get("code_challenge_method") !== "S256") {
    return fail("invalid_request", "PKCE with code_challenge_method=S256 is required");
  }
  const resource = p.get("resource") ?? resourceUrl(req);
  if (resource.replace(/\/+$/, "") !== resourceUrl(req)) return fail("invalid_target", `Unknown resource ${resource}`);

  const requested = (p.get("scope") ?? SCOPES.join(" ")).split(" ").filter(Boolean);
  const scope = requested.filter((s) => (SCOPES as readonly string[]).includes(s));
  if (scope.length === 0) scope.push(...SCOPES);

  const nonce = randomToken();
  const txn = await sign(
    "txn",
    { client_id: clientId, client_name: client.clientName, redirect_uri: redirectUri, code_challenge: codeChallenge, scope: scope.join(" "), resource, state, nonce },
    { issuer: iss, ttlSeconds: TXN_TTL_S },
  );

  // Bind the login to this browser: the callback must present the same nonce cookie (stops login CSRF).
  const res = Response.redirect(googleAuthorizeUrl({ issuer: iss, state: txn, nonce }), 302);
  const headers = new Headers(res.headers);
  headers.append(
    "Set-Cookie",
    `mcp_txn=${nonce}; Path=/oauth; HttpOnly; SameSite=Lax; Max-Age=${TXN_TTL_S}${iss.startsWith("https") ? "; Secure" : ""}`,
  );
  return new Response(null, { status: 302, headers });
}

function page(status: number, title: string, message: string) {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><body style="font-family:system-ui;max-width:560px;margin:64px auto"><h1>${esc(title)}</h1><p>${esc(message)}</p></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
