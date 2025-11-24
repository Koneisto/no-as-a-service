# Cloudflare Workers Deployment Guide

Deploy No-as-a-Service on Cloudflare Workers for **$0/month** (free tier: 100,000 requests/day).

## Why Cloudflare Workers?

- ✅ **Free tier**: 100,000 requests/day
- ✅ **Global edge**: Deployed to 300+ cities worldwide
- ✅ **Fast**: < 10ms response times
- ✅ **Auto-scaling**: Handles traffic spikes automatically
- ✅ **Zero maintenance**: No servers to manage
- ✅ **HTTPS included**: Automatic SSL certificates
- ✅ **Custom domains**: Free (requires Cloudflare DNS)

## Cost Breakdown

| Tier | Requests/day | Cost |
|------|--------------|------|
| Free | 100,000 | $0 |
| Paid | 10 million | $5/month + $0.50 per additional million |

**For most users: This will be FREE forever.**

---

## Prerequisites

1. Cloudflare account (sign up at https://dash.cloudflare.com/sign-up)
2. Node.js installed (v18 or later)
3. Git repository (optional, but recommended)

---

## Quick Start (5 minutes)

### Step 1: Install Wrangler

```bash
npm install -g wrangler

# Or use npx (no global install)
npx wrangler --version
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```

This opens a browser for authentication.

### Step 3: Create KV Namespaces

KV (Key-Value) storage is used to store rejection reasons and rate limit data.

```bash
# Create production KV namespaces
wrangler kv:namespace create "REASONS_KV"
wrangler kv:namespace create "RATE_LIMIT_KV"

# Create preview namespaces (for local development)
wrangler kv:namespace create "REASONS_KV" --preview
wrangler kv:namespace create "RATE_LIMIT_KV" --preview
```

**Copy the IDs from the output!** You'll need them in the next step.

Example output:
```
🌀 Creating namespace with title "noaas-REASONS_KV"
✨ Success! Created KV namespace "noaas-REASONS_KV"
Add the following to your wrangler.toml:
[[kv_namespaces]]
binding = "REASONS_KV"
id = "abc123..."
```

### Step 4: Update wrangler.toml

Edit `wrangler.toml` and replace the placeholder IDs:

```toml
# Replace these with your actual KV namespace IDs from Step 3
[[kv_namespaces]]
binding = "REASONS_KV"
id = "your-actual-reasons-kv-id-here"
preview_id = "your-actual-reasons-kv-preview-id-here"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-actual-ratelimit-kv-id-here"
preview_id = "your-actual-ratelimit-kv-preview-id-here"
```

### Step 5: Upload Reasons to KV

```bash
# Upload reasons.json to KV storage
wrangler kv:key put --binding=REASONS_KV reasons "$(cat reasons.json)"

# Verify it was uploaded
wrangler kv:key get --binding=REASONS_KV reasons | jq 'length'
# Should output: 921
```

### Step 6: Test Locally

```bash
# Run local development server
wrangler dev

# In another terminal, test it
curl http://localhost:8787/health
curl http://localhost:8787/v1/context
```

### Step 7: Deploy to Production

```bash
# Deploy to Cloudflare's edge network
wrangler deploy

# Output will show your Worker URL:
# Published noaas (0.XX sec)
#   https://noaas.your-subdomain.workers.dev
```

**That's it! Your MCP server is live! 🎉**

---

## Testing Your Deployment

```bash
# Replace with your actual Workers URL
export WORKER_URL="https://noaas.your-subdomain.workers.dev"

# Health check
curl $WORKER_URL/health

# Get random rejection
curl -X POST $WORKER_URL/v1/tools/call \
  -H "Content-Type: application/json" \
  -d '{"method":"getRandomNo","params":{"category":"humorous"}}'

# Get count
curl -X POST $WORKER_URL/v1/tools/call \
  -H "Content-Type: application/json" \
  -d '{"method":"getNoCount"}'
```

---

## Custom Domain Setup (Optional)

### Prerequisites
- Domain managed by Cloudflare DNS

### Steps

1. **Add route to wrangler.toml**:
```toml
[[routes]]
pattern = "noaas.yourdomain.com/*"
zone_name = "yourdomain.com"
```

2. **Deploy again**:
```bash
wrangler deploy
```

3. **Verify DNS** (Cloudflare automatically creates the DNS record):
```bash
curl https://noaas.yourdomain.com/health
```

**Cost: $0** (included in Workers free tier)

---

## Monitoring & Analytics

### View Usage Dashboard

```bash
# Open Cloudflare dashboard
wrangler dashboard
```

Or visit: https://dash.cloudflare.com → Workers & Pages → noaas

### Metrics Available:
- Requests per second
- CPU time usage
- Errors
- Bandwidth
- Edge location distribution

### View Logs in Real-Time

```bash
wrangler tail

# Then make requests to see logs
curl https://noaas.your-subdomain.workers.dev/health
```

---

## Updating Your Worker

### Update Code

1. Edit `worker.js`
2. Test locally: `wrangler dev`
3. Deploy: `wrangler deploy`

### Update Reasons

```bash
# Edit reasons.json, then upload
wrangler kv:key put --binding=REASONS_KV reasons "$(cat reasons.json)"
```

### Rollback

```bash
# List deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback --message "Rolling back due to issue"
```

---

## Cost Optimization Tips

### Free Tier Limits
- ✅ 100,000 requests/day = **3 million/month**
- ✅ 10ms CPU time per request
- ✅ KV: 100,000 reads/day (reasons are cached)
- ✅ 1,000 KV writes/day (rate limiting)

### Stay Within Free Tier:
1. **Cache responses** (optional):
   ```javascript
   // Add to worker.js if needed
   ctx.waitUntil(cache.put(request, response.clone()));
   ```

2. **Monitor usage**:
   ```bash
   wrangler metrics
   ```

3. **Set usage alerts** in Cloudflare dashboard

### If You Exceed Free Tier:
- Paid plan: $5/month for 10 million requests
- Still incredibly cheap: **$0.50 per million requests**
- For 1 million requests/day: **~$20/month** (vs $50-200 on traditional hosting)

---

## Comparison: Workers vs Traditional Hosting

| Feature | Cloudflare Workers | VPS (DigitalOcean) | AWS Lambda |
|---------|-------------------|-------------------|------------|
| **Cost** | $0-5/month | $6-12/month | $0.20 per 1M requests |
| **Setup time** | 5 minutes | 30-60 minutes | 15-30 minutes |
| **Scaling** | Automatic | Manual | Automatic |
| **Global edge** | ✅ 300+ cities | ❌ Single region | ⚠️ Regional |
| **Maintenance** | None | Server updates | Minimal |
| **Cold starts** | None | N/A | Yes (100-500ms) |
| **SSL** | Free, automatic | Manual setup | Manual setup |
| **Latency** | <10ms | 50-200ms | 20-100ms |

**Winner: Cloudflare Workers** 🏆

---

## Troubleshooting

### Error: "KV namespace not found"

```bash
# Recreate namespaces
wrangler kv:namespace create "REASONS_KV"
wrangler kv:namespace create "RATE_LIMIT_KV"

# Update wrangler.toml with new IDs
```

### Error: "Reasons not found in KV storage"

```bash
# Re-upload reasons
wrangler kv:key put --binding=REASONS_KV reasons "$(cat reasons.json)"
```

### Error: "Account ID required"

Add your account ID to `wrangler.toml`:
```toml
account_id = "your-account-id"
```

Find it at: https://dash.cloudflare.com (in the URL or sidebar)

### Worker not updating after deploy

```bash
# Clear cache and redeploy
wrangler deploy --no-bundle

# Or wait 1-2 minutes for global propagation
```

### Rate limiting not working

The rate limit KV namespace resets every 60 seconds. Test with:
```bash
# Send 121 requests quickly
for i in {1..121}; do
  curl -s https://your-worker.workers.dev/health > /dev/null
  echo "Request $i"
done
```

You should see a 429 error after 120 requests.

---

## Advanced Configuration

### Increase Rate Limits

Edit `worker.js`:
```javascript
const RATE_LIMIT = {
  requests: 300,  // Increase from 120 to 300
  windowMs: 60000,
};
```

### Add Custom CORS Origins

Edit `worker.js`:
```javascript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://yourdomain.com',  // Restrict to your domain
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

### Add Request Logging

```javascript
// In worker.js, add to fetch handler:
console.log(`${request.method} ${url.pathname} from ${request.headers.get('CF-Connecting-IP')}`);
```

View logs: `wrangler tail`

### Add Analytics

```javascript
// Track usage with Workers Analytics Engine (free tier: 1M events/month)
ctx.waitUntil(
  env.ANALYTICS.writeDataPoint({
    blobs: [url.pathname, request.method],
    doubles: [1],
    indexes: [request.headers.get('CF-Connecting-IP')],
  })
);
```

---

## Security Best Practices

### Already Implemented ✅
- Rate limiting per IP
- Security headers (CSP, X-Frame-Options, etc.)
- CORS configuration
- Input validation
- DDoS protection (Cloudflare's network)

### Additional Options

1. **API Key Authentication** (if needed):
```javascript
// Add to worker.js
const API_KEY = env.API_KEY;  // Set in dashboard

if (request.headers.get('Authorization') !== `Bearer ${API_KEY}`) {
  return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
}
```

2. **Geofencing**:
```javascript
// Restrict to specific countries
const country = request.cf.country;
const allowedCountries = ['US', 'CA', 'GB'];

if (!allowedCountries.includes(country)) {
  return jsonResponse({ error: 'Not available in your region' }, { status: 403 });
}
```

3. **Bot Protection**:
```javascript
// Block known bots (Cloudflare provides this info)
if (request.cf.botManagement.score < 30) {
  return jsonResponse({ error: 'Suspicious activity detected' }, { status: 403 });
}
```

---

## Maintenance

### Backup Reasons

```bash
# Download from KV
wrangler kv:key get --binding=REASONS_KV reasons > reasons-backup.json
```

### Update Dependencies

Workers use Web Standards (no npm dependencies!), but if you add any:
```bash
npm update
wrangler deploy
```

### Monitor Errors

```bash
# Real-time error monitoring
wrangler tail --format=pretty
```

Set up email alerts in Cloudflare dashboard.

---

## Next Steps

1. ✅ Deploy your Worker
2. ✅ Test all endpoints
3. ✅ Set up custom domain (optional)
4. ✅ Monitor usage in dashboard
5. ✅ Share your API URL with users!

---

## Support

- 📚 Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- 💬 Discord: https://discord.gg/cloudflaredev
- 🐛 Issues: Create an issue in your repository
- 📧 Email: systems@koneisto

---

## Example Workers URL

After deployment, your API will be available at:
```
https://noaas.<your-subdomain>.workers.dev
```

Users can call it like:
```bash
curl https://noaas.your-subdomain.workers.dev/v1/tools/call \
  -H "Content-Type: application/json" \
  -d '{"method":"getRandomNo","params":{"category":"humorous"}}'
```

**Congratulations! You're now running a global MCP server for $0/month! 🎉**
