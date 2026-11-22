# Agri Prices MCP: MCP Africa Master Class 2026

A teaching MCP server built live at the **MCP Africa Symposium 2026 Master Class**
(The Cortex Hub, East London, 23 November 2026). It serves sample fresh-produce prices
(ZAR/kg) for five South African markets, and grows over four stages, one branch each.

| Branch | Stage | Master Class session |
|---|---|---|
| `stage-1-basic-mcp` | A simple MCP server with no auth: tools, a resource, a prompt | 11:00 Build studio |
| `stage-2-deploy-vercel` | Deploy to Vercel, add health check and OpenTelemetry | 13:15 Secure and host, 14:15 Operate and observe |
| `stage-3-publish-registry` | Publish to the Official MCP Registry with `server.json` and GitHub OIDC | 13:15 Secure and host |
| `stage-4-google-oauth` | Sign in with Google, then rate limits, audit trail and usage billing per customer | 15:15 Sell and price |

Each branch builds on the one before it. `main` is the same as stage 1.

```bash
git clone https://github.com/AppimateSA/mcp-masterclass && cd mcp-masterclass
git checkout stage-1-basic-mcp   # or any stage
npm install
npm run dev                      # http://localhost:3000/api/mcp
npm run smoke                    # in a second terminal
```

> **Sample data.** Prices in `lib/data/markets.ts` are illustrative, not real market prices.

---

## Stage 1: a simple MCP server (no auth)

Stack: Next.js App Router, [`mcp-handler`](https://github.com/vercel/mcp-handler) v2,
MCP TypeScript SDK v2 (`@modelcontextprotocol/server`), Zod v4. The server speaks the
**2026-07-28** spec (stateless core) and still answers older clients.

| Primitive | Who controls it | In this server |
|---|---|---|
| Tools | the model | `list_markets`, `get_price`, `compare_markets` |
| Resources | the application | `markets://catalogue` |
| Prompts | the user | `weekly_price_brief` |

Files to read, in order:

1. `lib/data/markets.ts`: the data boundary (swap in your own source here)
2. `lib/mcp/server.ts`: tool, resource and prompt contracts (Zod schemas → JSON Schema)
3. `app/api/mcp/route.ts`: the HTTP endpoint (about 10 lines)

### Try it

```bash
npm run smoke                     # SDK client: lists everything, calls two tools
bash scripts/curl-demo.sh         # one raw JSON-RPC tools/call, no handshake
npm run inspector                 # MCP Inspector UI → connect to http://localhost:3000/api/mcp
```

### Build-studio exercise

Pick your team's workflow (agriculture, health or finance). Replace the data file and
add **one tool, one resource and one prompt** of your own. Keep every result carrying
`source` and `asOf`.
