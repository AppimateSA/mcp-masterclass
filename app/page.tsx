export default function Home() {
  return (
    <main>
      <h1>Agri Prices MCP</h1>
      <p>
        A teaching MCP server from the <strong>MCP Africa Symposium 2026 Master Class</strong> (The Cortex Hub,
        East London). It serves sample fresh-produce prices for five South African markets.
      </p>
      <p>
        MCP endpoint: <code>/api/mcp</code> (Streamable HTTP)
      </p>
      <ul>
        <li>Tools: list_markets, get_price, compare_markets</li>
        <li>Resource: markets://catalogue</li>
        <li>Prompt: weekly_price_brief</li>
      </ul>
      <p>
        <em>Prices are illustrative sample data, not real market prices.</em>
      </p>
    </main>
  );
}
