# Running the demo on any computer

Everything you need to run all four stages from a fresh clone, in order. Every branch has this
file, so it is still here after `git checkout`. After each stage, `npm run verify` tells you whether
it works.

## 0. Before the session

| You need | Check with |
|---|---|
| Node.js 20 or newer | `node -v` |
| Git, and access to this repo | `git ls-remote https://github.com/AppimateSA/mcp-masterclass` |
| A GitHub account (stage 3: registry namespace) | github.com |
| A Vercel account and the CLI (stage 2) | `npm i -g vercel && vercel login` |
| Stage 4 with real sign-in only: a Google OAuth client | console.cloud.google.com |

```bash
git clone https://github.com/AppimateSA/mcp-masterclass && cd mcp-masterclass
```

Port 3000 busy? Run the server with `npm run dev -- -p 3100` and check with `PORT=3100 npm run verify`.

## 1. Build: a simple MCP server

```bash
git checkout stage-1-basic-mcp
npm install
npm run dev                  # terminal 1: http://localhost:3000/api/mcp
npm run verify               # terminal 2: all checks should pass
npm run inspector            # optional: MCP Inspector UI, connect to http://localhost:3000/api/mcp
```

What you show: three tools (`list_markets`, `get_price`, `compare_markets`), one resource
(`markets://catalogue`) and one prompt (`weekly_price_brief`).

Writing raw HTTP calls yourself? The 2026-07-28 spec needs `Mcp-Method` and `Mcp-Name` headers on
every request, or the server answers `-32020`. `scripts/curl-demo.sh` shows the full request.

## 2. Host: deploy to Vercel (Cape Town)

```bash
git checkout stage-2-deploy-vercel
npm install
vercel link                  # pick or create a project
vercel --prod                # → https://<project>.vercel.app
npm run verify -- https://<project>.vercel.app      # health should report region cpt1
```

Connect a client: Claude → Settings → Connectors → Add custom connector → `https://<project>.vercel.app/api/mcp`.

Notes:
- Give people the production domain. If your Vercel team has Deployment Protection on, the
  per-deployment URLs (`<project>-<hash>-<team>.vercel.app`) ask for a Vercel login.
- If you connected the Git repo, set the project's production branch to the stage you are showing
  (Project → Settings → Git), or a push to `main` (stage 1) replaces it.
- `vercel link` may add `.env*` to `.gitignore`. Undo that line: it would hide `.env.example`.

## 3. Distribute: submit to the Official MCP Registry

```bash
git checkout stage-3-publish-registry
npm install
npm run registry:configure -- <github-username> https://<project>.vercel.app
npm run registry:install     # downloads ./mcp-publisher (macOS/Linux; Windows: see README)
npm run registry:validate
npm run registry:login       # GitHub device flow: open the link, enter the code
npm run registry:publish
curl "https://registry.modelcontextprotocol.io/v0/servers?search=agri-prices"
```

**Submitting again** (a rehearsal, then the live demo, or any change): versions are immutable, so
every submit needs a new version. Pick the next one yourself:

```bash
npm run registry:configure -- <github-username> https://<project>.vercel.app --version 0.3.1
npm run registry:publish
```

Notes:
- The interactive login only grants **your personal** namespace, `io.github.<username>/*`, even if
  you own an organization. To publish as `io.github.<org>/*`, use the GitHub Actions workflow
  (`git tag v0.3.1 && git push origin v0.3.1`) or `./mcp-publisher login github --token <classic PAT with read:org>`.
- The remote must be public HTTPS, and the description is at most 100 characters.
- To make the live server report the same version, deploy this branch too (`vercel --prod`).

## 4. Sell: sign in with Google, rate limits, usage billing

```bash
git checkout stage-4-google-oauth
npm install
cp .env.example .env.local
# edit .env.local: AUTH_SECRET=<output of: openssl rand -base64 48>
npm run dev
npm run verify               # mints a local dev token, so no Google client is needed
```

What you show: a call with no token gets 401 and a pointer to the sign-in metadata; with a token the
same smoke test passes and a fourth tool, `my_usage`, appears. Call `get_price` 11 times in a minute
to see the Free-plan rate limit; add your email to `PRO_EMAILS` to see Pro pricing.

Real Google sign-in (needs a Google OAuth client, Web application):
- Redirect URIs: `http://localhost:3000/oauth/google/callback` and `https://<project>.vercel.app/oauth/google/callback`
- Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`, and on Vercel together with
  `AUTH_SECRET` and `PUBLIC_BASE_URL=https://<project>.vercel.app`. Add Upstash Redis on Vercel so
  limits are shared across instances.
- In Claude, add the connector URL; Claude opens Google sign-in, then calls tools as you.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `git checkout` says "Your local changes would be overwritten" | `git checkout -- package-lock.json` (or `git stash`) and try again |
| `npm run inspector` waits at "Ok to proceed?" | Type `y`, or update: this branch uses `npx -y` |
| Stage 4: every call is 401, even with a token | `PUBLIC_BASE_URL` must match the URL you call, or be left empty |
| Registry: "You do not have permission to publish" | Use your own username in `registry:configure`, or see the org note above |
| Registry: "version already exists" | Bump with `--version` (step 3) |
