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
        <li>Account: my_usage (plan, limits, usage this month)</li>
      </ul>
      <p>
        Sign-in: add this server as a connector in your MCP client. It will open Google sign-in. Free plan: 10 calls per
        minute and 100 per day.
      </p>
      <p>
        <em>Prices are illustrative sample data, not real market prices.</em>
      </p>
    </main>
  );
}
