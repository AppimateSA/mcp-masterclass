import type { NextRequest } from "next/server";
import { AUTH_CODE_TTL_S, issuer } from "@/lib/auth/config";
import { exchangeGoogleCode } from "@/lib/auth/google";
import { sign, verify } from "@/lib/auth/tokens";

interface Txn {
  client_id: string;
  client_name?: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string;
  resource: string;
  state?: string;
  nonce: string;
}

/**
 * Step 2. Google sends the user back here. We confirm who they are from
 * Google's signed id_token, then hand the MCP client OUR authorization code.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const iss = issuer(req);

  let txn: Txn;
  try {
    txn = await verify<Txn & Record<string, unknown>>("txn", p.get("state") ?? "", { issuer: iss });
  } catch {
    return text(400, "This sign-in link has expired or is invalid. Start again from your MCP client.");
  }
  if (req.cookies.get("mcp_txn")?.value !== txn.nonce) {
    return text(400, "Sign-in must finish in the same browser it started in. Start again from your MCP client.");
  }

  const back = (params: Record<string, string>) => {
    const url = new URL(txn.redirect_uri);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (txn.state) url.searchParams.set("state", txn.state);
    url.searchParams.set("iss", iss); // RFC 9207, required by MCP 2026-07-28
    const headers = new Headers({ Location: url.toString() });
    headers.append("Set-Cookie", "mcp_txn=; Path=/oauth; Max-Age=0");
    return new Response(null, { status: 302, headers });
  };

  if (p.get("error")) return back({ error: "access_denied", error_description: "Google sign-in was cancelled" });

  let who;
  try {
    who = await exchangeGoogleCode({ issuer: iss, code: p.get("code") ?? "", nonce: txn.nonce });
  } catch (err) {
    return back({ error: "access_denied", error_description: (err as Error).message });
  }

  const code = await sign(
    "code",
    {
      email: who.email,
      name: who.name,
      client_id: txn.client_id,
      client_name: txn.client_name,
      redirect_uri: txn.redirect_uri,
      code_challenge: txn.code_challenge,
      scope: txn.scope,
      resource: txn.resource,
    },
    { issuer: iss, subject: `google:${who.sub}`, ttlSeconds: AUTH_CODE_TTL_S },
  );
  return back({ code });
}

function text(status: number, message: string) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
