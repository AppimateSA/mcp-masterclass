// Fill in server.json for YOUR namespace and deployment.
//   npm run registry:configure -- <github-user-or-org> <vercel-url> [repo-url] [--version x.y.z]
// Example:
//   npm run registry:configure -- thandi-dev https://agri-prices-thandi.vercel.app
// Submitting again? Versions are immutable in the registry, so pick a new one:
//   npm run registry:configure -- thandi-dev https://agri-prices-thandi.vercel.app --version 0.3.1
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
let version;
const vi = args.findIndex((a) => a === "--version" || a.startsWith("--version="));
if (vi !== -1) {
  version = args[vi].includes("=") ? args[vi].split("=")[1] : args[vi + 1];
  args.splice(vi, args[vi].includes("=") ? 1 : 2);
  if (!/^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/.test(version ?? "")) {
    console.error("--version must look like 0.3.1");
    process.exit(1);
  }
}
const [owner, deployUrl, repoUrl] = args;
if (!owner || !deployUrl) {
  console.error("Usage: npm run registry:configure -- <github-user-or-org> <vercel-url> [repo-url] [--version x.y.z]");
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
server.version = version ?? pkg.version;
server.websiteUrl = base;
server.remotes = [{ type: "streamable-http", url: `${base}/api/mcp` }];
server.repository = { url: repoUrl ?? `https://github.com/${owner}/mcp-masterclass`, source: "github" };

writeFileSync("server.json", JSON.stringify(server, null, 2) + "\n");
console.log(`server.json → ${server.name} @ ${server.version}\n  remote: ${server.remotes[0].url}`);
console.log("Next: npm run registry:validate && npm run registry:login && npm run registry:publish");
