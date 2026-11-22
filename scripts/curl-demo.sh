#!/usr/bin/env bash
# One raw MCP tool call over Streamable HTTP (MCP 2026-07-28, stateless core).
# No initialize handshake, no session id: every request carries its own
# protocol version, client info and capabilities in _meta, and the
# Mcp-Method / Mcp-Name headers let gateways route and meter without parsing JSON.
#   bash scripts/curl-demo.sh                         # local
#   MCP_URL=https://<app>.vercel.app/api/mcp bash scripts/curl-demo.sh
URL="${MCP_URL:-http://localhost:3000/api/mcp}"

curl -s -X POST "$URL" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: tools/call' \
  -H 'Mcp-Name: get_price' \
  ${MCP_TOKEN:+-H "Authorization: Bearer $MCP_TOKEN"} \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_price",
      "arguments": { "crop": "tomatoes", "marketId": "eln" },
      "_meta": {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": { "name": "curl", "version": "1.0.0" },
        "io.modelcontextprotocol/clientCapabilities": {}
      }
    }
  }'
echo
