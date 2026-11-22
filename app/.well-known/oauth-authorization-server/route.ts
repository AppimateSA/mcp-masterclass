import { corsHeaders } from "@/lib/auth/config";
import { authorizationServerMetadata } from "@/lib/auth/metadata";

export function GET(req: Request) {
  return Response.json(authorizationServerMetadata(req), {
    headers: { ...corsHeaders, "Cache-Control": "max-age=3600" },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
