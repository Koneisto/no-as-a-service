# Quick Start: Deploy to Cloudflare Workers in 5 Minutes

This is the **fastest and cheapest** way to deploy NoaaS as a public MCP server.

## TL;DR

```bash
# 1. Install wrangler
npm install

# 2. Login
npx wrangler login

# 3. Create KV namespaces
npx wrangler kv:namespace create "REASONS_KV"
npx wrangler kv:namespace create "REASONS_KV" --preview
npx wrangler kv:namespace create "RATE_LIMIT_KV"
npx wrangler kv:namespace create "RATE_LIMIT_KV" --preview

# 4. Update wrangler.toml with the IDs from step 3

# 5. Upload reasons
npx wrangler kv:key put --binding=REASONS_KV reasons "$(cat reasons.json)"

# 6. Deploy
npx wrangler deploy

# Done! Your API is live at: https://noaas.YOUR-SUBDOMAIN.workers.dev
```

---

## Detailed Steps

### 1. Install Dependencies

```bash
npm install
```

This installs `wrangler` (Cloudflare's CLI) as a dev dependency.

### 2. Login to Cloudflare

```bash
npx wrangler login
```

A browser window will open for authentication.

### 3. Create KV Namespaces

KV (Key-Value) stores your rejection reasons and rate limit data.

```bash
# Production namespaces
npx wrangler kv:namespace create "REASONS_KV"
npx wrangler kv:namespace create "RATE_LIMIT_KV"

# Preview namespaces (for local testing)
npx wrangler kv:namespace create "REASONS_KV" --preview
npx wrangler kv:namespace create "RATE_LIMIT_KV" --preview
```

**Important:** Copy the IDs from each command's output!

Example output:
```
✨ Success! Created KV namespace "noaas-REASONS_KV"
[[kv_namespaces]]
binding = "REASONS_KV"
id = "abc123def456..."
```

### 4. Update wrangler.toml

Open `wrangler.toml` and replace the placeholder IDs:

```toml
[[kv_namespaces]]
binding = "REASONS_KV"
id = "abc123def456..."  # ← Your actual ID from step 3
preview_id = "xyz789..."  # ← Your actual preview ID

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "ghi012jkl345..."  # ← Your actual ID
preview_id = "mno678..."  # ← Your actual preview ID
```

### 5. Upload Rejection Reasons

```bash
npx wrangler kv:key put --binding=REASONS_KV reasons "$(cat reasons.json)"
```

Verify it worked:
```bash
npx wrangler kv:key get --binding=REASONS_KV reasons | jq 'length'
# Should output: 921
```

### 6. Test Locally (Optional)

```bash
npm run worker:dev
```

Then in another terminal:
```bash
curl http://localhost:8787/health
curl http://localhost:8787/v1/context
```

Press Ctrl+C to stop.

### 7. Deploy to Production

```bash
npm run worker:deploy
```

Output will show your live URL:
```
✨ Uploaded noaas
✨ Published noaas
   https://noaas.YOUR-SUBDOMAIN.workers.dev
```

---

## Test Your Deployment

Replace `YOUR-SUBDOMAIN` with your actual subdomain:

```bash
# Health check
curl https://noaas.YOUR-SUBDOMAIN.workers.dev/health

# Get random rejection
curl -X POST https://noaas.YOUR-SUBDOMAIN.workers.dev/v1/tools/call \
  -H "Content-Type: application/json" \
  -d '{"method":"getRandomNo","params":{"category":"humorous"}}'

# Get count
curl -X POST https://noaas.YOUR-SUBDOMAIN.workers.dev/v1/tools/call \
  -H "Content-Type: application/json" \
  -d '{"method":"getNoCount"}'
```

---

## Available Commands

```bash
# Local development server
npm run worker:dev

# Deploy to production
npm run worker:deploy

# View live logs
npm run worker:tail

# Upload reasons.json updates
npm run worker:kv:upload

# Automated deployment script
npm run deploy:auto
```

---

## Cost

**FREE** for up to 100,000 requests/day!

That's **3 million requests per month** on the free tier.

### Built-in Daily Limit Protection

The Worker includes automatic daily request limiting (95,000 requests/day) to keep you safely within the free tier:

- ✅ Prevents surprise charges
- ✅ Real-time usage monitoring in `/health` endpoint
- ✅ Usage headers in every response
- ✅ Clear error messages when limit reached
- ✅ Automatic reset at midnight UTC

**Configuration:** Edit `DAILY_LIMIT` in `worker.js` to adjust or disable.

**See:** [DAILY_LIMIT_GUIDE.md](./DAILY_LIMIT_GUIDE.md) for full details.

If you exceed the free tier:
- Paid tier: $5/month for 10 million requests
- Additional: $0.50 per million requests

**For most users, this will be free forever.**

---

## Custom Domain (Optional)

If you have a domain on Cloudflare:

1. Add to `wrangler.toml`:
```toml
[[routes]]
pattern = "noaas.yourdomain.com/*"
zone_name = "yourdomain.com"
```

2. Deploy again:
```bash
npm run worker:deploy
```

3. Access at:
```bash
curl https://noaas.yourdomain.com/health
```

**Cost: $0** (included)

---

## What You Get

✅ **Global edge deployment** (300+ cities worldwide)
✅ **Automatic HTTPS** (free SSL certificates)
✅ **DDoS protection** (Cloudflare's network)
✅ **Auto-scaling** (handles any traffic spike)
✅ **99.99% uptime** SLA
✅ **< 10ms response times** globally
✅ **Zero maintenance** (no servers to manage)
✅ **Built-in analytics** (requests, errors, performance)

---

## Monitoring

View your Worker's performance:

```bash
# Open Cloudflare dashboard
npx wrangler dashboard

# View real-time logs
npm run worker:tail
```

Or visit: https://dash.cloudflare.com → Workers & Pages

---

## Updating

### Update Code
```bash
# Edit worker.js
npm run worker:deploy
```

### Update Reasons
```bash
# Edit reasons.json
npm run worker:kv:upload
```

### Rollback
```bash
npx wrangler rollback
```

---

## Troubleshooting

### "KV namespace not found"
Make sure you updated `wrangler.toml` with the actual KV namespace IDs from step 3.

### "Reasons not found in KV storage"
Run: `npm run worker:kv:upload`

### Still having issues?
See [WORKERS_DEPLOYMENT.md](./WORKERS_DEPLOYMENT.md) for detailed troubleshooting.

---

## Next Steps

1. ✅ Your MCP server is live!
2. ✅ Share the URL with users
3. ✅ Check analytics in Cloudflare dashboard
4. ✅ Set up custom domain (optional)
5. ✅ Monitor usage and costs

---

## Share Your API

Your users can call your API like this:

```javascript
const response = await fetch('https://noaas.YOUR-SUBDOMAIN.workers.dev/v1/tools/call', {
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

---

**Congratulations! You're running a global MCP server for $0/month! 🎉**

For more details, see:
- [WORKERS_DEPLOYMENT.md](./WORKERS_DEPLOYMENT.md) - Complete deployment guide
- [README.md](./README.md) - API documentation
- [examples/usage-examples.md](./examples/usage-examples.md) - Code examples
