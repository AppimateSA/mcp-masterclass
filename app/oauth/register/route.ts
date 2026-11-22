import { corsHeaders, issuer } from "@/lib/auth/config";
import { isAcceptableRedirectUri } from "@/lib/auth/clients";
import { sign } from "@/lib/auth/tokens";

/**
 * Dynamic Client Registration (RFC 7591). Deprecated by MCP 2026-07-28 in
 * favour of Client ID Metadata Documents, but many clients still use it.
 * Stateless: the client_id we return is a signed JWT of the registration.
 */
export async function POST(req: Request) {
  let body: {
    redirect_uris?: unknown;
    client_name?: string;
    token_endpoint_auth_method?: string;
    grant_types?: string[];
    response_types?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return error("invalid_client_metadata", "Body must be JSON");
  }

  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (redirectUris.length === 0) return error("invalid_redirect_uri", "redirect_uris is required");
  const bad = redirectUris.find((u) => !isAcceptableRedirectUri(u));
  if (bad) return error("invalid_redirect_uri", `Redirect URI not allowed: ${bad}`);
  if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== "none") {
    return error("invalid_client_metadata", "Only public clients (token_endpoint_auth_method=none) are supported");
  }

  const clientName = (body.client_name ?? "MCP client").slice(0, 100);
  const clientId = await sign("client", { redirect_uris: redirectUris, client_name: clientName }, { issuer: issuer(req) });

  return Response.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: clientName,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201, headers: { ...corsHeaders, "Cache-Control": "no-store" } },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

function error(code: string, description: string) {
  return Response.json({ error: code, error_description: description }, { status: 400, headers: corsHeaders });
}
