# Daily Request Limit Guide

This guide explains how the built-in daily request limit works and how to configure it.

## Why Daily Limits?

The daily limit feature helps you:
- ✅ **Stay within Cloudflare's free tier** (100k requests/day)
- ✅ **Avoid unexpected charges** if you exceed the free tier
- ✅ **Monitor usage** in real-time
- ✅ **Get warnings** before hitting the limit

## How It Works

The Worker tracks total requests per day (UTC timezone) using Workers KV storage:

1. Each request increments a daily counter
2. Counter resets automatically at midnight UTC
3. When limit is reached, returns `429 Too Many Requests`
4. Users see clear error message with reset time

## Default Configuration

Located in `worker.js`:

```javascript
const DAILY_LIMIT = {
  enabled: true,              // Enable/disable daily limit
  maxRequests: 95000,         // Max requests per day (95k = safe buffer)
  warnThreshold: 0.9,         // Warn at 90% usage (85,500 requests)
};
```

**Why 95,000 and not 100,000?**
- Leaves 5k buffer for safety
- Prevents hitting Cloudflare's hard limit
- Accounts for potential counting delays

## Monitoring Usage

### Health Check Endpoint

```bash
curl https://your-worker.workers.dev/health
```

**Response includes daily usage:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-21T20:00:00.000Z",
  "service": "noaas-cloudflare-workers",
  "edge_location": "global",
  "daily_usage": {
    "requests_today": 45230,
    "limit": 95000,
    "remaining": 49770,
    "percent_used": 47.61,
    "resets_at": "2025-11-22T00:00:00.000Z"
  }
}
```

### Response Headers

Every API response includes usage headers:

```bash
curl -I https://your-worker.workers.dev/v1/context
```

**Headers:**
```
X-Daily-Limit: 95000
X-Daily-Remaining: 49770
X-Daily-Used: 45230
```

### Warning Status

When usage exceeds 90% (85,500 requests):

```json
{
  "status": "warning",
  "warning": "Approaching daily limit (91% used)",
  "daily_usage": {
    "requests_today": 86450,
    "limit": 95000,
    "remaining": 8550,
    "percent_used": 91.0
  }
}
```

## Limit Exceeded Response

When the daily limit is reached:

**Status Code:** `429 Too Many Requests`

**Response:**
```json
{
  "error": "Daily request limit reached",
  "message": "Service has reached its daily limit of 95000 requests. This helps keep the service free!",
  "limit": 95000,
  "current": 95000,
  "resetAt": "2025-11-22T00:00:00.000Z",
  "resetIn": "4h 23m"
}
```

**Headers:**
```
X-Daily-Limit: 95000
X-Daily-Remaining: 0
X-Daily-Reset: 15780
Retry-After: 15780
```

## Configuration Options

### Increase the Limit

Edit `worker.js`:

```javascript
const DAILY_LIMIT = {
  enabled: true,
  maxRequests: 150000,  // Increase to 150k (requires paid tier)
  warnThreshold: 0.9,
};
```

**Note:** Exceeding 100k/day will incur charges:
- Paid tier: $5/month base + $0.50 per additional million requests

### Disable Daily Limit

If you have a paid account and don't want limits:

```javascript
const DAILY_LIMIT = {
  enabled: false,  // Completely disable daily checks
  maxRequests: 95000,
  warnThreshold: 0.9,
};
```

### Adjust Warning Threshold

Get warnings at different usage levels:

```javascript
const DAILY_LIMIT = {
  enabled: true,
  maxRequests: 95000,
  warnThreshold: 0.8,  // Warn at 80% (76,000 requests)
};
```

### Change Timezone

By default, the counter resets at midnight UTC. To use a different timezone, edit the `checkDailyLimit` function in `worker.js`:

```javascript
// Current: UTC midnight
const today = new Date().toISOString().split('T')[0];

// For PST (UTC-8):
const pstDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
const today = pstDate.toISOString().split('T')[0];
```

## Cost Scenarios

### Scenario 1: Stay Free Forever
- **Daily limit:** 95,000 requests
- **Monthly total:** ~2.85 million requests
- **Cost:** $0

### Scenario 2: Moderate Growth
- **Daily limit:** 150,000 requests
- **Monthly total:** ~4.5 million requests
- **Cost:** $5/month (paid tier)

### Scenario 3: High Traffic
- **Daily limit:** 300,000 requests
- **Monthly total:** ~9 million requests
- **Cost:** $5/month + $0 (still under 10M included)

### Scenario 4: Very High Traffic
- **Daily limit:** 500,000 requests
- **Monthly total:** ~15 million requests
- **Cost:** $5/month + $2.50 (5M extra @ $0.50/M) = **$7.50/month**

**Even at 500k requests/day, it's still incredibly cheap!**

## Best Practices

### 1. Monitor Daily Usage

Set up a cron job or GitHub Action to check usage:

```bash
#!/bin/bash
# check-usage.sh

USAGE=$(curl -s https://your-worker.workers.dev/health | jq '.daily_usage.percent_used')

if (( $(echo "$USAGE > 80" | bc -l) )); then
  echo "WARNING: Daily usage at ${USAGE}%"
  # Send alert (email, Slack, etc.)
fi
```

### 2. Set Up Alerts

Use Cloudflare's Workers Analytics:
1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages → noaas
3. Set up email alerts at 80% and 95% usage

### 3. Implement Client-Side Caching

Reduce requests by caching responses:

```javascript
// Client-side cache (5 minutes)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function getRandomNo(category) {
  const cacheKey = `no:${category}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const response = await fetch('https://your-worker.workers.dev/v1/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'getRandomNo', params: { category } })
  });

  const data = await response.json();
  cache.set(cacheKey, { data, timestamp: Date.now() });

  return data;
}
```

### 4. Use Batch Requests

If your app needs multiple rejections, batch them:

```javascript
// Bad: 10 separate requests
for (let i = 0; i < 10; i++) {
  await getRandomNo();
}

// Good: Get 10 at once, cache locally
const batch = await Promise.all([
  getRandomNo(), getRandomNo(), getRandomNo(), /* ... */
]);
// Use from local cache for next 9 requests
```

### 5. Educate Users

Add usage info to your API docs:

```markdown
## Rate Limits
- Per-IP: 120 requests/minute
- Global: 95,000 requests/day
- Limits reset at midnight UTC
```

## Testing the Daily Limit

### Test Locally

When using `wrangler dev`, the daily limit uses the preview KV namespace, so you can test without affecting production.

```bash
# Start dev server
wrangler dev

# Check current usage
curl http://localhost:8787/health | jq '.daily_usage'

# Simulate hitting limit (in worker.js, temporarily set maxRequests: 10)
for i in {1..15}; do
  curl http://localhost:8787/v1/context
done
```

### Test in Production (Carefully!)

```bash
# Check current usage
curl https://your-worker.workers.dev/health | jq '.daily_usage.requests_today'

# Temporarily lower limit for testing
# In worker.js: maxRequests: 100
# Deploy: wrangler deploy

# Test hitting limit
for i in {1..120}; do
  echo "Request $i"
  curl -s https://your-worker.workers.dev/health > /dev/null
done

# Should see 429 after 100 requests

# Reset limit: maxRequests: 95000
# Redeploy: wrangler deploy
```

## Troubleshooting

### Counter Not Resetting

**Problem:** Daily counter doesn't reset at midnight

**Solution:**
- KV entries have TTL (48 hours), they auto-expire
- Check date calculation is UTC: `new Date().toISOString().split('T')[0]`
- Verify timezone is correct

### Incorrect Count

**Problem:** Request count seems wrong

**Solution:**
- KV writes are eventually consistent (< 1 second delay)
- Health check reads may be slightly behind
- Use `wrangler tail` to see actual increments

### Hitting Limit Too Early

**Problem:** Reaching limit before expected

**Solution:**
- Check for loops or retry logic in client code
- Look for clients caching the API URL and hammering it
- Review Cloudflare analytics for traffic patterns
- Consider implementing exponential backoff
- Note: Per-IP rate limit is 60 requests/minute (1 per second)

### Want Higher Limits

**Problem:** Need more than 95k requests/day

**Solution:**
1. Upgrade to paid Workers plan ($5/month)
2. Increase `maxRequests` in worker.js
3. Monitor costs in Cloudflare dashboard
4. At $0.50 per million requests, even 1M req/day is only ~$15/month

## FAQ

### Q: Can I have different limits for different endpoints?

**A:** Yes! Modify the code:

```javascript
// In worker.js, add endpoint-specific limits
const ENDPOINT_LIMITS = {
  '/health': { enabled: false },  // No limit on health checks
  '/v1/context': { maxRequests: 50000 },  // 50k for context
  '/v1/tools/call': { maxRequests: 45000 },  // 45k for tools
};

// Then update checkDailyLimit to use path-specific limits
```

### Q: Does the daily limit count OPTIONS requests?

**A:** No, CORS preflight OPTIONS requests bypass the counter.

### Q: What happens if KV is unavailable?

**A:** The Worker allows requests through (fail-open) to prevent service disruption. Counter resumes when KV is available.

### Q: Can I track weekly or monthly limits instead?

**A:** Yes! Change the key format:

```javascript
// Monthly limit
const month = new Date().toISOString().split('T')[0].substring(0, 7); // YYYY-MM
const key = `monthly:${month}`;
// Set TTL to 60 days
```

### Q: Does this work with multiple Workers?

**A:** Yes! All Workers sharing the same KV namespace share the same counter. Perfect for load balancing.

## Summary

The daily limit feature:
- ✅ Keeps you within free tier (95k/day buffer)
- ✅ Resets automatically at midnight UTC
- ✅ Provides real-time usage monitoring
- ✅ Returns clear error messages when exceeded
- ✅ Highly configurable
- ✅ Zero cost to implement (uses existing KV namespace)

**Deploy with confidence knowing you won't get surprise charges!**

---

For more information:
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers KV Pricing](https://developers.cloudflare.com/kv/platform/pricing/)
- [Deployment Guide](./WORKERS_DEPLOYMENT.md)
