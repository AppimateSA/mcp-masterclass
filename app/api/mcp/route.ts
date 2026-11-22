import { createMcpHandler } from "mcp-handler";
import { registerServer } from "@/lib/mcp/server";

/**
 * Stage 1: a simple MCP server, no auth.
 * Endpoint: POST /api/mcp (Streamable HTTP, MCP 2026-07-28 stateless core).
 */
const handler = createMcpHandler(registerServer, {
  serverInfo: { name: "agri-prices", version: "0.1.0" },
  instructions:
    "Fresh-produce prices (ZAR/kg) for five South African markets. Sample data: always quote the source and asOf date.",
});

export { handler as GET, handler as POST, handler as DELETE };
