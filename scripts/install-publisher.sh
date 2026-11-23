#!/usr/bin/env bash
# Download the Official MCP Registry publisher CLI into ./mcp-publisher (gitignored).
#   npm run registry:install
# macOS and Linux. On Windows, download mcp-publisher_windows_amd64.tar.gz from
# https://github.com/modelcontextprotocol/registry/releases and extract it here.
set -euo pipefail
cd "$(dirname "$0")/.."
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')
URL="https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_${OS}_${ARCH}.tar.gz"
echo "Downloading $URL"
curl -fsSL "$URL" | tar xz mcp-publisher
chmod +x mcp-publisher
./mcp-publisher --help | head -1
echo "Installed ./mcp-publisher"
