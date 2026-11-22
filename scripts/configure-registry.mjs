// Fill in server.json for YOUR namespace and deployment.
//   npm run registry:configure -- <github-user-or-org> <vercel-url> [repo-url]
// Example:
//   npm run registry:configure -- thandi-dev https://agri-prices-thandi.vercel.app
import { readFileSync, writeFileSync } from "node:fs";

const [owner, deployUrl, repoUrl] = process.argv.slice(2);
if (!owner || !deployUrl) {
  console.error("Usage: npm run registry:configure -- <github-user-or-org> <vercel-url> [repo-url]");
  process.exit(1);
}

const base = deployUrl.replace(/\/+$/, "").replace(/\/api\/mcp$/, "");
if (!/^https:\/\//.test(base)) {
  console.error("The deployment URL must be public HTTPS (the registry requires a publicly reachable remote).");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const server = JSON.parse(readFileSync("server.json", "utf8"));

server.name = `io.github.${owner}/agri-prices`;
server.version = pkg.version;
server.websiteUrl = base;
server.remotes = [{ type: "streamable-http", url: `${base}/api/mcp` }];
server.repository = { url: repoUrl ?? `https://github.com/${owner}/mcp-masterclass`, source: "github" };

writeFileSync("server.json", JSON.stringify(server, null, 2) + "\n");
console.log(`server.json → ${server.name} @ ${server.version}\n  remote: ${server.remotes[0].url}`);
console.log("Next: mcp-publisher validate && mcp-publisher login github && mcp-publisher publish");
