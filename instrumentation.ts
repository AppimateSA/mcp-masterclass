import { registerMcpOTel } from "mcp-handler/otel";

/**
 * Stage 2: OpenTelemetry. On Vercel, every MCP request becomes a span
 * (method, tool name, latency, outcome) in the project's Observability tab.
 */
export function register() {
  registerMcpOTel({ serviceName: "agri-prices-mcp" });
}
