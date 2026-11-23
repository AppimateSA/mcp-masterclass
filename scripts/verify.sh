#!/usr/bin/env bash
# Check that the stage you have checked out works, end to end.
#   npm run dev                       # terminal 1
#   npm run verify                    # terminal 2 (checks http://localhost:3000)
#   PORT=3100 npm run verify          # if your dev server runs on another port
#   npm run verify -- https://<project>.vercel.app    # check a deployment instead
# Prints PASS / FAIL per check and exits non-zero if anything failed.
set -u
cd "$(dirname "$0")/.."
BASE="${1:-http://localhost:${PORT:-3000}}"; BASE="${BASE%/}"; BASE="${BASE%/api/mcp}"
FAILS=0
pass() { printf '  \033[32mPASS\033[0m  %s\n' "$*"; }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$*"; FAILS=$((FAILS+1)); }
hint() { printf '        %s\n' "$*"; }
todo() { printf '  \033[33mTODO\033[0m  %s\n' "$*"; }
check() { local name="$1"; shift; if "$@" >/tmp/verify.$$ 2>&1; then pass "$name"; else fail "$name"; sed 's/^/        /' /tmp/verify.$$ | tail -6; fi; rm -f /tmp/verify.$$; }

if [ -d app/oauth ]; then STAGE=4; elif [ -f server.json ]; then STAGE=3; elif [ -f app/api/health/route.ts ]; then STAGE=2; else STAGE=1; fi
VERSION=$(node -p "require('./package.json').version")
echo "Agri Prices MCP · stage $STAGE · v$VERSION · checking $BASE"
echo

echo "Setup"
check "node $(node -v) is 20 or newer" node -e 'process.exit(+process.versions.node.split(".")[0] >= 20 ? 0 : 1)'
check "dependencies installed" test -d node_modules/@modelcontextprotocol
if git rev-parse --git-dir >/dev/null 2>&1; then
  check "npm install left package-lock.json unchanged (you can switch branches)" git diff --quiet -- package-lock.json
fi
if ! curl -s -o /dev/null --max-time 10 "$BASE/"; then
  fail "server reachable at $BASE"
  hint "Start it first: npm run dev   (or pass the deployed URL: npm run verify -- https://<project>.vercel.app)"
  exit 1
fi
pass "server reachable at $BASE"

TOKEN="${MCP_TOKEN:-}"
if [ "$STAGE" -eq 4 ] && [ -z "$TOKEN" ]; then
  echo; echo "Stage 4 sign-in"
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/mcp" -H 'Content-Type: application/json' -d '{}')
  [ "$code" = 401 ] && pass "a call without a token is refused (401)" || fail "a call without a token is refused (got $code)"
  issuer=$(curl -s "$BASE/.well-known/oauth-authorization-server" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).issuer)}catch{console.log("")}})')
  case "$issuer" in http*) pass "auth metadata names an issuer ($issuer)";; *) fail "auth metadata names an issuer (got '$issuer')"; hint "Set PUBLIC_BASE_URL in .env.local, or leave it out entirely";; esac
  if [[ "$BASE" == http://localhost* || "$BASE" == http://127.0.0.1* ]]; then
    SECRET=$(grep -E '^AUTH_SECRET=' .env.local 2>/dev/null | cut -d= -f2-)
    if [ -n "$SECRET" ]; then
      TOKEN=$(AUTH_SECRET="$SECRET" PUBLIC_BASE_URL="$BASE" node scripts/dev-token.mjs verify@example.com 2>/dev/null)
      [ -n "$TOKEN" ] && pass "minted a local dev token (scripts/dev-token.mjs)" || fail "minted a local dev token"
    else
      fail "AUTH_SECRET is set in .env.local"; hint "cp .env.example .env.local, then AUTH_SECRET=\$(openssl rand -base64 48)"
    fi
  else
    hint "Deployed stage 4: sign in through Claude, or pass a token: MCP_TOKEN=<token> npm run verify -- $BASE"
  fi
fi

echo; echo "MCP"
check "npm run smoke (tools, resource, prompt, two tool calls)" env MCP_URL="$BASE/api/mcp" MCP_TOKEN="$TOKEN" node scripts/smoke.mjs
check "scripts/curl-demo.sh (one raw JSON-RPC call)" sh -c "MCP_URL='$BASE/api/mcp' MCP_TOKEN='$TOKEN' bash scripts/curl-demo.sh | grep -q structuredContent"

if [ "$STAGE" -ge 2 ]; then
  echo; echo "Hosting"
  health=$(curl -s "$BASE/api/health")
  echo "$health" | grep -q '"status":"ok"' && pass "/api/health is ok" || fail "/api/health is ok"
  region=$(echo "$health" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(j.region+" v"+j.version)}catch{console.log("?")}})')
  pass "health reports $region"
fi

if [ "$STAGE" -ge 3 ]; then
  echo; echo "Registry"
  if grep -q "YOUR-" server.json; then
    todo "server.json not configured yet (next step):"; hint "npm run registry:configure -- <github-user> https://<project>.vercel.app"
  else
    pass "server.json is configured ($(node -p "const s=require('./server.json');s.name+' @ '+s.version"))"
    if [ -x ./mcp-publisher ]; then check "./mcp-publisher validate" ./mcp-publisher validate
    else hint "Install the publisher to validate: npm run registry:install"; fi
  fi
fi

echo
if [ "$FAILS" -eq 0 ]; then printf '\033[32mAll checks passed.\033[0m\n'; else printf '\033[31m%s check(s) failed.\033[0m\n' "$FAILS"; exit 1; fi
