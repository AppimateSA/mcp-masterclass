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

---

## Stage 2: deploy to Vercel

What changed from stage 1:

- `app/api/mcp/route.ts`: `maxDuration`, name and version from `lib/version.ts`
- `app/api/health/route.ts`: a health check for uptime monitors (never point those at `/api/mcp`)
- `instrumentation.ts`: OpenTelemetry via `mcp-handler/otel`, so each tool call shows up as a span in Vercel Observability
- `vercel.json`: functions run in `cpt1` (Cape Town). The default is `iad1` (Washington, D.C.), which adds a transatlantic round trip to every tool call for South African users

### Deploy

```bash
npm i -g vercel
vercel login
vercel            # preview deployment
vercel --prod     # production: https://<project>.vercel.app
```

Or import the GitHub repo at vercel.com/new and pick this branch. No environment variables are needed for stages 1 to 3.

Check it:

```bash
curl https://<project>.vercel.app/api/health
MCP_URL=https://<project>.vercel.app/api/mcp npm run smoke
MCP_URL=https://<project>.vercel.app/api/mcp bash scripts/curl-demo.sh
```

### Connect a client

| Client | How |
|---|---|
| Claude (web, desktop) | Settings → Connectors → Add custom connector → `https://<project>.vercel.app/api/mcp` |
| VS Code / Cursor | Add to `.vscode/mcp.json` or `~/.cursor/mcp.json`: `{ "servers": { "agri-prices": { "type": "http", "url": "https://<project>.vercel.app/api/mcp" } } }` |
| MCP Inspector | `npm run inspector`, transport "Streamable HTTP", paste the URL |

### Why serverless fits MCP 2026-07-28

The 2026-07-28 spec dropped the `initialize` handshake and the `Mcp-Session-Id` header. Each request
carries its own protocol version and client info, so any request can land on any instance. That is
how Vercel Functions scale: no sticky sessions and no Redis needed just to hold sessions.

---

## Stage 3: publish to the Official MCP Registry

The registry at `registry.modelcontextprotocol.io` is a **metadata catalogue, not a host**. Your server
stays on Vercel; the registry stores a `server.json` that tells clients and sub-registries where it
lives. Ownership is proven by namespace:

| Login method | Namespace you may publish |
|---|---|
| `mcp-publisher login github` (or GitHub OIDC in Actions) | `io.github.<your-username-or-org>/*` |
| DNS or HTTP challenge | `com.yourdomain/*` (reverse-DNS) |

What changed from stage 2: `server.json`, `scripts/configure-registry.mjs`, `.github/workflows/publish-mcp.yml`.

### Publish by hand (in the room)

```bash
# 1. Point server.json at your namespace and your Vercel deployment
npm run registry:configure -- <github-username> https://<project>.vercel.app

# 2. Install the publisher CLI (macOS/Linux)
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher
#    Windows: download mcp-publisher_windows_amd64.tar.gz from the registry's GitHub releases

# 3. Validate, log in with GitHub (device flow), publish
./mcp-publisher validate
./mcp-publisher login github
./mcp-publisher publish

# 4. Find yourself
curl "https://registry.modelcontextprotocol.io/v0/servers?search=agri-prices"
```

### Publish from CI (recommended afterwards)

Commit the configured `server.json`, then tag a release:

```bash
git tag v0.3.0 && git push origin v0.3.0
```

The workflow checks `/api/health` is live, verifies the publisher binary with Sigstore, logs in with
GitHub OIDC (no stored secret), sets the version from the tag and publishes.

### Rules worth knowing

- Remote servers **must** be publicly reachable at the URL in `remotes`, and should use Streamable HTTP (SSE is deprecated).
- `description` is at most 100 characters.
- Versions are immutable: bump the version for every publish.
- For an npm/PyPI package (stdio) instead of a remote, add `"mcpName"` to `package.json` (or `mcp-name:` to the README) so the registry can verify you own the package.
- The registry is still in preview; data resets can happen.

---

## Stage 4: Sign in with Google, then sell it

Once a server is public and listed, you need to know **who** is calling before you can do anything
commercial. Identity is what makes the rest possible:

| Without identity | With identity (stage 4) |
|---|---|
| Rate-limit by IP (unfair: campuses and mobile carriers share IPs) | Rate-limit per customer, by plan |
| Logs say "someone called get_price" | Audit trail: customer, client app, tool, outcome, latency |
| No way to charge | Usage metered per customer per month, ready for invoicing |

### How the auth works

Google is only the identity provider. It can't be the MCP authorization server by itself: it doesn't
accept MCP client registration (CIMD or DCR), and its tokens aren't bound to your server's URL.
So this app runs a small OAuth 2.1 authorization server that sends the login step to Google:

```
MCP client ──(1) POST /api/mcp, no token──▶ 401 + WWW-Authenticate: resource_metadata=…
           ──(2) GET /.well-known/oauth-protected-resource/api/mcp  → "my issuer is <this app>"
           ──(3) GET /.well-known/oauth-authorization-server         → endpoints, PKCE S256, CIMD
           ──(4) POST /oauth/register (DCR) or client_id = https URL (CIMD)
 browser   ──(5) GET /oauth/authorize ──▶ Google sign-in ──▶ /oauth/google/callback
           ◀─(6) redirect to client with ?code&state&iss
MCP client ──(7) POST /oauth/token (code + PKCE verifier) → access token, aud = this /api/mcp
           ──(8) POST /api/mcp  Authorization: Bearer …  → metered tool calls
```

| File | Role |
|---|---|
| `app/api/mcp/route.ts` | `withMcpAuth`: rejects calls without a valid token for **this** resource |
| `app/.well-known/*` | Discovery (RFC 9728 protected resource, RFC 8414 authorization server) |
| `app/oauth/register` | Dynamic Client Registration (stateless: the client_id is a signed JWT) |
| `app/oauth/authorize` | Checks client + redirect URI + PKCE, sends the user to Google |
| `app/oauth/google/callback` | Verifies Google's id_token, issues our one-time code (with `iss`, RFC 9207) |
| `app/oauth/token` | Code + PKCE → access/refresh tokens; refresh grant |
| `lib/commerce/metered.ts` | Identify → limit → run → audit → bill, around every tool |
| `lib/commerce/plans.ts` | Free and Pro plans, limits and price per call |

### Set up

1. **Google Cloud Console** → APIs & Services → Credentials → Create OAuth client ID → *Web application*.
   Authorised redirect URIs: `https://<project>.vercel.app/oauth/google/callback` and
   `http://localhost:3000/oauth/google/callback`. Configure the consent screen (External, Testing,
   add your testers' emails).
2. Copy `.env.example` to `.env.local` and fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `AUTH_SECRET` (`openssl rand -base64 48`).
3. On Vercel: Project → Settings → Environment Variables, same values, plus
   `PUBLIC_BASE_URL=https://<project>.vercel.app`. Add **Upstash Redis** from the Vercel Marketplace
   so limits and usage are shared across instances. Redeploy.
4. Bump the version and republish to the registry (stage 3): `git tag v0.4.0 && git push origin v0.4.0`.

### Try it

```bash
# In Claude: Settings → Connectors → Add custom connector → https://<project>.vercel.app/api/mcp
# Claude discovers the OAuth endpoints, opens Google sign-in, then calls tools as you.
# Ask: "What's my usage on agri-prices?"  (calls my_usage)

# Locally, without Google:
AUTH_SECRET=<same as .env.local> node scripts/dev-token.mjs you@example.com
MCP_TOKEN=<token> npm run smoke
```

Call `get_price` 11 times in a minute on the Free plan to see the rate-limit message. The model can
read it and tell the user what to do. Put your email in `PRO_EMAILS` to see Pro limits and the
estimated charge in `my_usage`.

### Production notes

- Tokens and registrations are stateless signed JWTs so the demo needs no database. A real service
  keeps refresh tokens and clients in a database so it can revoke them, and rotates `AUTH_SECRET`.
- Codes are single-use only across instances when Redis is configured.
- Use `customerId` (`google:<sub>`) as the billing key, not the email: people change emails.
- Arguments are hashed in the audit trail, not stored. Keep only what you need (POPIA).
- To charge, point `BILLING_METER_URL` at a function that forwards usage to your billing provider,
  and set `plan:<customerId>` to `pro` from that provider's subscription webhook.
