import { DATA_AS_OF, DATA_SOURCE } from "@/lib/data/markets";
import { SERVER_NAME, SERVER_VERSION } from "@/lib/version";

// Uptime checks and the "Lab reviewed" readiness check hit this, not /api/mcp.
export function GET() {
  return Response.json(
    {
      status: "ok",
      server: SERVER_NAME,
      version: SERVER_VERSION,
      region: process.env.VERCEL_REGION ?? "local",
      data: { asOf: DATA_AS_OF, source: DATA_SOURCE },
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
