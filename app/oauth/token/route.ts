import { ACCESS_TOKEN_TTL_S, AUTH_CODE_TTL_S, REFRESH_TOKEN_TTL_S, corsHeaders, issuer, resourceUrl } from "@/lib/auth/config";
import { pkceS256, sign, verify } from "@/lib/auth/tokens";
import { store } from "@/lib/commerce/store";

/**
 * Step 3. The MCP client swaps the code (plus its PKCE verifier) for tokens.
 * The access token's audience is THIS MCP endpoint, so it is useless anywhere else.
 */
export async function POST(req: Request) {
  const form = await readForm(req);
  const iss = issuer(req);
  const resource = resourceUrl(req);
  const grant = form.get("grant_type");

  if (form.get("resource") && form.get("resource")!.replace(/\/+$/, "") !== resource) {
    return error("invalid_target", "Unknown resource");
  }

  if (grant === "authorization_code") {
    let code;
    try {
      code = await verify<{
        sub: string; email: string; name?: string; client_id: string; client_name?: string; redirect_uri: string;
        code_challenge: string; scope: string; resource: string; jti: string;
      }>("code", form.get("code") ?? "", { issuer: iss });
    } catch {
      return error("invalid_grant", "Authorization code is invalid or expired");
    }
    if (code.client_id !== form.get("client_id")) return error("invalid_grant", "client_id does not match the code");
    if (code.redirect_uri !== form.get("redirect_uri")) return error("invalid_grant", "redirect_uri does not match the code");
    const verifier = form.get("code_verifier") ?? "";
    if (!verifier || (await pkceS256(verifier)) !== code.code_challenge) return error("invalid_grant", "PKCE verification failed");
    // Single use. With Redis this holds across instances; in memory it is per instance.
    if (!(await store.setOnce(`code-used:${code.jti}`, AUTH_CODE_TTL_S * 2))) return error("invalid_grant", "Authorization code already used");

    return issueTokens(iss, resource, { sub: code.sub, email: code.email, name: code.name, client_id: code.client_id, client_name: code.client_name, scope: code.scope });
  }

  if (grant === "refresh_token") {
    let rt;
    try {
      rt = await verify<{ sub: string; email: string; name?: string; client_id: string; client_name?: string; scope: string }>(
        "refresh", form.get("refresh_token") ?? "", { issuer: iss, audience: resource },
      );
    } catch {
      return error("invalid_grant", "Refresh token is invalid or expired");
    }
    if (form.get("client_id") && rt.client_id !== form.get("client_id")) return error("invalid_grant", "client_id does not match");
    return issueTokens(iss, resource, { sub: rt.sub, email: rt.email, name: rt.name, client_id: rt.client_id, client_name: rt.client_name, scope: rt.scope });
  }

  return error("unsupported_grant_type", "Use authorization_code or refresh_token");
}

async function issueTokens(
  iss: string,
  resource: string,
  who: { sub: string; email: string; name?: string; client_id: string; client_name?: string; scope: string },
) {
  const claims = { email: who.email, name: who.name, client_id: who.client_id, client_name: who.client_name, scope: who.scope };
  const accessToken = await sign("access", claims, { issuer: iss, audience: resource, subject: who.sub, ttlSeconds: ACCESS_TOKEN_TTL_S });
  const refreshToken = await sign("refresh", claims, { issuer: iss, audience: resource, subject: who.sub, ttlSeconds: REFRESH_TOKEN_TTL_S });
  return Response.json(
    { access_token: accessToken, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL_S, refresh_token: refreshToken, scope: who.scope },
    { headers: { ...corsHeaders, "Cache-Control": "no-store", Pragma: "no-cache" } },
  );
}

async function readForm(req: Request): Promise<URLSearchParams> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await req.json()) as Record<string, string>;
    return new URLSearchParams(body);
  }
  return new URLSearchParams(await req.text());
}

function error(code: string, description: string) {
  return Response.json(
    { error: code, error_description: description },
    { status: 400, headers: { ...corsHeaders, "Cache-Control": "no-store" } },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
