// Smoke test: connect to the MCP server, list everything, call each tool once.
//   npm run smoke                                  -> http://localhost:3000/api/mcp
//   MCP_URL=https://<your-app>.vercel.app/api/mcp npm run smoke
//   MCP_TOKEN=<bearer> npm run smoke               -> stage 4 (authenticated)
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const url = new URL(process.env.MCP_URL ?? "http://localhost:3000/api/mcp");
const token = process.env.MCP_TOKEN;
const mode = process.env.MCP_LEGACY ? undefined : { mode: "auto" };

const client = new Client({ name: "masterclass-smoke", version: "1.0.0" }, mode ? { versionNegotiation: mode } : {});
const transport = new StreamableHTTPClientTransport(url, {
  requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
});

await client.connect(transport);
console.log(`Connected to ${url.href}`);

const { tools } = await client.listTools();
console.log("Tools:    ", tools.map((t) => t.name).join(", "));
const { resources } = await client.listResources();
console.log("Resources:", resources.map((r) => r.uri).join(", "));
const { prompts } = await client.listPrompts();
console.log("Prompts:  ", prompts.map((p) => p.name).join(", "));

const price = await client.callTool({ name: "get_price", arguments: { crop: "tomatoes", marketId: "eln" } });
console.log("\nget_price(tomatoes, eln) ->", JSON.stringify(price.structuredContent ?? price.content));

const cmp = await client.callTool({ name: "compare_markets", arguments: { crop: "cabbage" } });
const c = cmp.structuredContent;
if (c) console.log(`compare_markets(cabbage) -> cheapest ${c.cheapest.marketId}, dearest ${c.dearest.marketId}, spread R${c.spreadZarPerKg}/kg`);
else console.log("compare_markets(cabbage) ->", JSON.stringify(cmp.content));

if (tools.some((t) => t.name === "my_usage")) {
  const usage = await client.callTool({ name: "my_usage", arguments: {} });
  console.log("my_usage ->", JSON.stringify(usage.structuredContent ?? usage.content));
}

await client.close();
