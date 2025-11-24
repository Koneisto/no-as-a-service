# No-as-a-Service (NoaaS)

> A Model Context Protocol (MCP) compliant API that delivers creative, humorous, and professional rejection responses.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

NoaaS is a lightweight, production-ready API service that provides 900+ curated "no" responses across different categories (polite, humorous, professional, creative). It implements JSON-RPC 2.0 and MCP-compatible endpoints for easy integration with AI assistants, chatbots, and applications.

## Features

- 🎯 **921 curated rejection responses** across 4 categories
- 🔒 **Production-hardened** with security headers, CORS, rate limiting
- 🚀 **Fast & lightweight** - Node.js with Express
- 🐳 **Docker-ready** with health checks and multi-stage builds
- 📊 **Observable** with health checks and rate limit headers
- ⚡ **MCP-compliant** endpoints for AI integration

## Quick Start

### 🚀 Deploy to Cloudflare Workers (Recommended - FREE!)

The **fastest and cheapest** way to deploy NoaaS publicly:

```bash
# 1. Install and login
npm install
npx wrangler login

# 2. Create KV namespaces (copy the IDs!)
npx wrangler kv:namespace create "REASONS_KV"
npx wrangler kv:namespace create "RATE_LIMIT_KV"

# 3. Update wrangler.toml with KV IDs from step 2

# 4. Upload reasons and deploy
npx wrangler kv:key put --binding=REASONS_KV reasons "$(cat reasons.json)"
npx wrangler deploy

# Done! Your API is live globally! 🎉
```

**📖 See [QUICKSTART_WORKERS.md](./QUICKSTART_WORKERS.md) for detailed steps**

**💰 Cost: FREE** (100,000 requests/day on free tier)

---

### Local Development

```bash
# Install dependencies
npm install

# Start server
npm start

# Server runs on http://localhost:3000
```

### Docker

```bash
# Build image
docker build -t noaas:latest .

# Run container
docker run -p 3000:3000 noaas:latest

# Or use docker-compose
docker-compose up
```

## API Endpoints

### Health Check
```bash
GET /health
```
Returns service status, uptime, and loaded reasons count.

### MCP Endpoints

#### Get Server Info
```bash
GET /v1/server
```

#### Get Random Rejection (Context)
```bash
GET /v1/context
```
Returns a random rejection reason with metadata.

#### List Available Tools
```bash
POST /v1/tools/list
Content-Type: application/json
```

#### Call a Tool
```bash
POST /v1/tools/call
Content-Type: application/json

{
  "method": "getRandomNo",
  "params": {
    "category": "humorous"
  }
}
```

**Categories:** `polite`, `humorous`, `professional`, `creative`

#### Get Rejection Count
```bash
POST /v1/tools/call
Content-Type: application/json

{
  "method": "getNoCount"
}
```

#### List Resources
```bash
POST /v1/resources/list
Content-Type: application/json
```

#### Get Resource
```bash
POST /v1/resources/get
Content-Type: application/json

{
  "name": "no_responses"
}
```

#### List Prompts
```bash
POST /v1/prompts/list
Content-Type: application/json
```

#### Get Prompt Template
```bash
POST /v1/prompts/get
Content-Type: application/json

{
  "name": "rejection_response"
}
```

## Using with Claude Desktop (MCP)

NoaaS now includes a **native MCP server** with stdio transport for direct Claude Desktop integration.

### Architecture

The MCP implementation consists of two components:

1. **REST API** (Cloudflare Workers) - The backend at `https://api.mcp-for-no.com`
2. **MCP Server** (Local Node.js process) - A stdio transport wrapper that bridges Claude Desktop to the REST API

Claude Desktop spawns the local MCP server as a subprocess and communicates via stdin/stdout. The MCP server then makes HTTP requests to the REST API.

```
Claude Desktop (stdio) ←→ Local MCP Server (HTTP) ←→ REST API (Cloudflare)
```

### Installation

**Prerequisites:** Node.js v18+ and Git

**Quick Setup:**

```bash
cd ~
git clone https://github.com/Koneisto/no-as-a-service.git
cd no-as-a-service
npm install
npm run mcp:build
pwd  # Copy this path
```

**Claude Desktop Configuration:**

Edit your `claude_desktop_config.json` (see locations below) and add:

```json
{
  "mcpServers": {
    "noaas": {
      "command": "node",
      "args": [
        "/YOUR/PATH/HERE/no-as-a-service/build/mcp-server.js"
      ],
      "env": {
        "API_BASE_URL": "https://api.mcp-for-no.com"
      }
    }
  }
}
```

**Config file locations:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

Replace `/YOUR/PATH/HERE` with the output from `pwd` command above.

**Complete setup instructions:** See main [README.md](../README.md#use-with-claude-desktop-mcp)

### Available MCP Tools

- `getRandomNo` - Get a creative rejection (optional category parameter)
- `getNoCount` - Get total count of available rejections

### Direct HTTP API Usage

You can also use the REST API directly without MCP:

```javascript
// Fetch a random rejection
const response = await fetch('https://api.mcp-for-no.com/v1/tools/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'getRandomNo',
    params: { category: 'humorous' }
  })
});

const data = await response.json();
console.log(data.result.response);
```

## Cloudflare Deployment

### Option 1: Cloudflare Workers (Recommended for Serverless)

Cloudflare Workers don't support Node.js directly, but you can adapt this:

1. Rewrite to use Cloudflare Workers API
2. Store `reasons.json` in KV or R2
3. Deploy with Wrangler

**Note:** This requires code modifications as Workers don't support `express` or `fs`.

### Option 2: Cloudflare Pages + Functions

Similar limitations to Workers.

### Option 3: Cloudflare Tunnels (Easiest - Deploy as-is)

Deploy your Node.js app anywhere and expose it via Cloudflare Tunnel:

```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create noaas

# Configure tunnel (create config.yml)
cat > ~/.cloudflared/config.yml << EOF
url: http://localhost:3000
tunnel: <TUNNEL_ID>
credentials-file: /path/to/credentials.json
EOF

# Run tunnel
cloudflared tunnel run noaas

# Make it permanent with cloudflared service install
```

Then route a domain to your tunnel in Cloudflare dashboard.

### Option 4: VPS/Cloud + Cloudflare Proxy

1. Deploy to any VPS (DigitalOcean, AWS, GCP, etc.)
2. Point your domain to the server IP
3. Enable Cloudflare proxy (orange cloud)
4. Benefits: DDoS protection, CDN, WAF

**Example for DigitalOcean:**
```bash
# On your server
git clone <your-repo>
cd no-as-a-service
docker-compose up -d

# Point DNS to server IP
# Enable Cloudflare proxy
```

## Environment Variables

```bash
PORT=3000              # Server port (default: 3000)
NODE_ENV=production    # Environment mode (default: development)
TRUST_PROXY=1          # Number of trusted proxies (default: 1)
CORS_ORIGIN=*          # Allowed CORS origins (default: *)
```

## Rate Limiting

- **60 requests per minute** per IP address
- Rate limit headers included in responses:
  - `RateLimit-Limit`: Maximum requests allowed
  - `RateLimit-Remaining`: Requests remaining in window
  - `RateLimit-Reset`: Seconds until limit resets

## Security Features

- ✅ Helmet security headers (CSP, HSTS, X-Frame-Options, etc.)
- ✅ CORS configuration
- ✅ Input validation for malformed JSON
- ✅ Rate limiting per IP
- ✅ Non-root Docker user
- ✅ Environment variable validation
- ✅ Graceful error handling
- ✅ Production-safe error responses (no stack traces)

## Examples

### Get a Random Humorous Rejection
```bash
curl -X POST https://your-domain.com/v1/tools/call \
  -H "Content-Type: application/json" \
  -d '{"method":"getRandomNo","params":{"category":"humorous"}}'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "response": "I'd love to say yes, but my calendar is allergic to that date."
  }
}
```

### Check Service Health
```bash
curl https://your-domain.com/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-21T20:00:00.000Z",
  "uptime": 3600.5,
  "environment": "production",
  "reasons_loaded": 921
}
```

### Get Total Count of Rejections
```bash
curl -X POST https://your-domain.com/v1/tools/call \
  -H "Content-Type: application/json" \
  -d '{"method":"getNoCount"}'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "count": 921
  }
}
```

## Performance

- **Startup time:** < 2 seconds
- **Response time:** < 10ms average
- **Memory usage:** ~50MB
- **Docker image:** ~150MB (Alpine-based)

## Monitoring

### Health Check Endpoint
Monitor with:
- Docker: Built-in `HEALTHCHECK`
- Kubernetes: Liveness/readiness probes
- Uptime monitors: Pingdom, UptimeRobot, etc.

```bash
# Docker healthcheck (built-in)
curl -f http://localhost:3000/health || exit 1
```

## License

MIT License - see LICENSE file for details

## Author

hotheadhacker

## Contributing

Contributions welcome! Please open an issue or PR.

## Support

- 📧 Email: systems@koneisto
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/no-as-a-service/issues)
