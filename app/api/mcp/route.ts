import { createMcpHandler } from "mcp-handler";
import { registerServer } from "@/lib/mcp/server";
import { SERVER_NAME, SERVER_VERSION } from "@/lib/version";

/**
 * Stage 2: the same server, ready for Vercel.
 * Endpoint: POST /api/mcp (Streamable HTTP, MCP 2026-07-28 stateless core).
 * Stateless means any request can land on any function instance, which is
 * exactly how serverless scales.
 */
export const maxDuration = 60; // seconds; raise it for slow upstream APIs

const handler = createMcpHandler(registerServer, {
  serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
  instructions:
    "Fresh-produce prices (ZAR/kg) for five South African markets. Sample data: always quote the source and asOf date.",
});

export { handler as GET, handler as POST, handler as DELETE };
