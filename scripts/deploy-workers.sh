#!/bin/bash

# Cloudflare Workers Deployment Script
# This script automates the deployment of NoaaS to Cloudflare Workers

set -e  # Exit on error

echo "🚀 NoaaS Cloudflare Workers Deployment Script"
echo "=============================================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

echo "✅ Wrangler CLI found"
echo ""

# Check if logged in
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Cloudflare. Running login..."
    wrangler login
else
    echo "✅ Already logged in"
    wrangler whoami
fi
echo ""

# Check if KV namespaces exist in wrangler.toml
if grep -q "your-reasons-kv-id" wrangler.toml; then
    echo "⚠️  KV namespaces not configured!"
    echo ""
    echo "Creating KV namespaces..."
    echo ""

    # Create REASONS_KV
    echo "📦 Creating REASONS_KV namespace..."
    wrangler kv:namespace create "REASONS_KV"
    echo ""

    echo "📦 Creating REASONS_KV preview namespace..."
    wrangler kv:namespace create "REASONS_KV" --preview
    echo ""

    # Create RATE_LIMIT_KV
    echo "📦 Creating RATE_LIMIT_KV namespace..."
    wrangler kv:namespace create "RATE_LIMIT_KV"
    echo ""

    echo "📦 Creating RATE_LIMIT_KV preview namespace..."
    wrangler kv:namespace create "RATE_LIMIT_KV" --preview
    echo ""

    echo "⚠️  IMPORTANT: Update wrangler.toml with the KV namespace IDs shown above!"
    echo "Then run this script again."
    exit 1
fi

echo "✅ KV namespaces configured"
echo ""

# Check if reasons.json exists
if [ ! -f "reasons.json" ]; then
    echo "❌ reasons.json not found!"
    exit 1
fi

echo "✅ reasons.json found"
echo ""

# Upload reasons to KV
echo "📤 Uploading reasons.json to KV storage..."
wrangler kv:key put --binding=REASONS_KV reasons "$(cat reasons.json)"
echo "✅ Reasons uploaded successfully"
echo ""

# Verify upload
echo "🔍 Verifying upload..."
REASON_COUNT=$(wrangler kv:key get --binding=REASONS_KV reasons | jq 'length')
echo "✅ Verified: $REASON_COUNT reasons in KV storage"
echo ""

# Test locally first
echo "🧪 Would you like to test locally before deploying? (y/n)"
read -r TEST_LOCAL

if [ "$TEST_LOCAL" = "y" ] || [ "$TEST_LOCAL" = "Y" ]; then
    echo "🏃 Starting local development server..."
    echo "Press Ctrl+C to stop and continue with deployment"
    echo ""
    wrangler dev
fi

# Deploy to production
echo ""
echo "🚀 Deploying to Cloudflare Workers..."
wrangler deploy

echo ""
echo "=============================================="
echo "✅ Deployment successful!"
echo ""
echo "Your MCP server is now live! 🎉"
echo ""
echo "Next steps:"
echo "1. Test your endpoints (see output above for URL)"
echo "2. Check the Cloudflare dashboard for analytics"
echo "3. Share your API URL with users!"
echo ""
echo "Testing commands:"
echo "  curl https://noaas.YOUR-SUBDOMAIN.workers.dev/health"
echo "  curl -X POST https://noaas.YOUR-SUBDOMAIN.workers.dev/v1/tools/call \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"method\":\"getRandomNo\",\"params\":{\"category\":\"humorous\"}}'"
echo ""
