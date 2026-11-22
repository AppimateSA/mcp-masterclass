import { corsHeaders } from "@/lib/auth/config";
import { protectedResourceMetadata } from "@/lib/auth/metadata";

// Serves both /.well-known/oauth-protected-resource and
// /.well-known/oauth-protected-resource/api/mcp (the RFC 9728 path-suffixed form).
export function GET(req: Request) {
  return Response.json(protectedResourceMetadata(req), {
    headers: { ...corsHeaders, "Cache-Control": "max-age=3600" },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
