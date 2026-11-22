import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { CROPS, DATA_AS_OF, DATA_SOURCE, MARKETS, getAllQuotes, getQuote } from "@/lib/data/markets";

/**
 * The three MCP primitives, one of each kind at minimum:
 *   - Tools     (model-controlled actions):  list_markets, get_price, compare_markets
 *   - Resources (application-controlled data): markets://catalogue
 *   - Prompts   (user-controlled templates):   weekly_price_brief
 */

const crop = z.enum(CROPS).describe("Crop name, e.g. tomatoes");
const marketId = z.enum(MARKETS.map((m) => m.id) as [string, ...string[]]).describe(
  "Market id: jhb, tsh, cpt, dbn or eln (call list_markets to see them)",
);

const quoteShape = z.object({
  crop: z.string(),
  marketId: z.string(),
  marketName: z.string(),
  priceZarPerKg: z.number(),
  asOf: z.string(),
  source: z.string(),
});

const json = (value: unknown) => [{ type: "text" as const, text: JSON.stringify(value, null, 2) }];

export function registerServer(server: McpServer) {
  // ── Tools ────────────────────────────────────────────────────────────────
  server.registerTool(
    "list_markets",
    {
      title: "List fresh-produce markets",
      description: "List the South African fresh-produce markets this server has prices for.",
      outputSchema: z.object({
        markets: z.array(z.object({ id: z.string(), name: z.string(), province: z.string() })),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const output = { markets: MARKETS.map((m) => ({ ...m })) };
      return { content: json(output), structuredContent: output };
    },
  );

  server.registerTool(
    "get_price",
    {
      title: "Get crop price",
      description:
        "Get the average price (ZAR per kg) of a crop at one market. Returns provenance (source, asOf).",
      inputSchema: z.object({ crop, marketId }),
      outputSchema: quoteShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ crop, marketId }) => {
      const output = getQuote(crop, marketId as (typeof MARKETS)[number]["id"]);
      return { content: json(output), structuredContent: { ...output } };
    },
  );

  server.registerTool(
    "compare_markets",
    {
      title: "Compare a crop across markets",
      description:
        "Compare a crop's price across all markets and report the cheapest, the dearest and the spread.",
      inputSchema: z.object({ crop }),
      outputSchema: z.object({
        crop: z.string(),
        cheapest: quoteShape,
        dearest: quoteShape,
        spreadZarPerKg: z.number(),
        quotes: z.array(quoteShape),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ crop }) => {
      const quotes = getAllQuotes(crop).sort((a, b) => a.priceZarPerKg - b.priceZarPerKg);
      const cheapest = quotes[0];
      const dearest = quotes[quotes.length - 1];
      const output = {
        crop,
        cheapest,
        dearest,
        spreadZarPerKg: Math.round((dearest.priceZarPerKg - cheapest.priceZarPerKg) * 100) / 100,
        quotes,
      };
      return { content: json(output), structuredContent: output };
    },
  );

  // ── Resources ────────────────────────────────────────────────────────────
  server.registerResource(
    "markets-catalogue",
    "markets://catalogue",
    {
      title: "Markets and crops catalogue",
      description: "Every market and crop this server covers, with the data's source and date.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ markets: MARKETS, crops: CROPS, asOf: DATA_AS_OF, source: DATA_SOURCE }, null, 2),
        },
      ],
    }),
  );

  // ── Prompts ──────────────────────────────────────────────────────────────
  server.registerPrompt(
    "weekly_price_brief",
    {
      title: "Weekly price brief",
      description: "Draft a short weekly price brief for a farmer or buyer, for one crop.",
      argsSchema: z.object({
        crop: z.string().describe("Crop name, e.g. tomatoes"),
        audience: z.string().optional().describe("Who the brief is for, e.g. 'smallholder farmer in Mthatha'"),
      }),
    },
    ({ crop, audience }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `Use the compare_markets tool for "${crop}" and write a five-line price brief` +
              `${audience ? ` for ${audience}` : ""}. Name the cheapest and dearest market, the spread in rand ` +
              `per kg, one practical suggestion, and state the data source and date.`,
          },
        },
      ],
    }),
  );
}
