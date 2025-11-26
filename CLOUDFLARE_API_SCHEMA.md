# Cloudflare API Schema Setup

This guide explains how to use the OpenAPI schema with Cloudflare's security features.

## Schema File

- **Location**: `openapi.yaml`
- **Format**: OpenAPI 3.0.3
- **Validation**: ✅ Valid (tested with swagger-cli)

## Cloudflare API Gateway Setup

### 1. Upload Schema to Cloudflare

**Via Dashboard:**
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your account and domain
3. Go to **Security** → **API Gateway**
4. Click **Add Schema**
5. Upload `openapi.yaml`
6. Set the base path to `/`

**Via API:**
```bash
# Get your Zone ID and API Token from Cloudflare Dashboard
ZONE_ID="your-zone-id"
API_TOKEN="your-api-token"

curl -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/api_gateway/schemas" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @openapi.yaml
```

### 2. Enable Schema Validation

Once uploaded, Cloudflare can:
- **Validate requests** against the schema
- **Block invalid requests** automatically
- **Monitor API usage** per endpoint
- **Generate security insights**

**Enable validation:**
1. In API Gateway, click on your schema
2. Go to **Settings** → **Schema Validation**
3. Toggle **Enable Schema Validation**
4. Choose action: **Block** or **Log**

### 3. API Shield Configuration

Cloudflare API Shield provides additional security:

**Enable API Shield:**
1. Go to **Security** → **API Shield**
2. Click **Enable API Shield**
3. Select endpoints to protect
4. Configure security rules

**Recommended Settings:**
- ✅ Enable **Schema Validation**
- ✅ Enable **JWT Validation** (if you add auth later)
- ✅ Enable **mTLS** for internal APIs (optional)
- ✅ Enable **Sequential Rate Limiting**

### 4. Rate Limiting Rules

The schema documents two rate limits:
- **Per-IP**: 30 requests per minute
- **Daily**: 95,000 requests per day

**Create Rate Limiting Rule:**

```bash
# Via Cloudflare API
curl -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rate_limits" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "threshold": 30,
    "period": 60,
    "action": {
      "mode": "ban",
      "timeout": 60,
      "response": {
        "content_type": "application/json",
        "body": "{\"error\": \"Too many requests, please try again later. (30 reqs/min/IP)\"}"
      }
    },
    "match": {
      "request": {
        "url": "api.mcp-for-no.com/*"
      }
    }
  }'
```

**Or via Dashboard:**
1. Go to **Security** → **WAF**
2. Click **Rate Limiting Rules**
3. **Create Rule**:
   - Name: `API Rate Limit - Per IP`
   - If: `(http.host eq "api.mcp-for-no.com")`
   - Then: `Block for 60 seconds when rate > 30 req/min`

## Security Features

### 1. DDoS Protection

Cloudflare provides automatic DDoS protection, but you can enhance it:

1. Go to **Security** → **DDoS**
2. Enable **HTTP DDoS Attack Protection**
3. Set sensitivity: **High**

### 2. WAF Rules

Create custom Web Application Firewall rules:

```
# Block suspicious patterns
(http.request.uri.path contains "admin") or
(http.request.uri.path contains "../") or
(http.request.uri.path contains "..\\") or
(http.request.body contains "<script") or
(http.request.body contains "eval(")
```

### 3. Bot Protection

1. Go to **Security** → **Bots**
2. Enable **Bot Fight Mode** (free) or **Super Bot Fight Mode** (paid)
3. Configure actions for verified bots, likely bots, and definite bots

### 4. CORS Configuration

The API already has CORS headers in the worker. Verify settings:

```yaml
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

To restrict CORS via Cloudflare:
1. Add a Transform Rule
2. **Modify Response Header**
3. Set `Access-Control-Allow-Origin` to specific domains

## Monitoring & Analytics

### View API Analytics

1. Go to **Analytics** → **Traffic**
2. Filter by:
   - Endpoint path (`/v1/tools/call`)
   - Response status codes
   - Rate limit hits
   - Geographic distribution

### API Gateway Insights

1. Go to **Security** → **API Gateway**
2. View:
   - Request volume per endpoint
   - Schema validation errors
   - Security events
   - Top clients by IP

### Set Up Alerts

1. Go to **Notifications**
2. Create alerts for:
   - Rate limit exceeded
   - Schema validation failures
   - 5xx errors spike
   - Daily limit approaching

## Schema Updates

When you update the API:

1. **Update** `openapi.yaml`
2. **Validate** with: `npx @apidevtools/swagger-cli validate openapi.yaml`
3. **Re-upload** to Cloudflare API Gateway
4. **Test** with sample requests

## Testing the Setup

### Test Schema Validation

```bash
# Valid request (should succeed)
curl -X POST https://api.mcp-for-no.com/v1/tools/call \
  -H "Content-Type: application/json" \
  -d '{"method":"getRandomNo","params":{"category":"humorous"}}'

# Invalid request (should be blocked if validation enabled)
curl -X POST https://api.mcp-for-no.com/v1/tools/call \
  -H "Content-Type: application/json" \
  -d '{"method":"invalidMethod"}'

# Invalid category (should be blocked)
curl -X POST https://api.mcp-for-no.com/v1/tools/call \
  -H "Content-Type: application/json" \
  -d '{"method":"getRandomNo","params":{"category":"invalid"}}'
```

### Test Rate Limiting

```bash
# Send 31 requests in 60 seconds (should hit rate limit)
for i in {1..31}; do
  curl -X POST https://api.mcp-for-no.com/v1/tools/call \
    -H "Content-Type: application/json" \
    -d '{"method":"getNoCount"}'
  sleep 1
done
```

## Troubleshooting

### Schema Upload Fails

- Ensure the YAML is valid: `npx @apidevtools/swagger-cli validate openapi.yaml`
- Check file size (must be < 5MB)
- Verify OpenAPI version is 3.0.x or 3.1.x

### Schema Validation Not Working

- Verify **Schema Validation** is enabled in API Gateway settings
- Check that the base path matches (`/`)
- Review Cloudflare logs for validation errors

### Rate Limiting Not Triggering

- Verify rate limit rule is enabled
- Check that the URL pattern matches
- Review **Security Events** logs
- Test from different IPs (rate limits are per-IP)

## Additional Resources

- [Cloudflare API Gateway Docs](https://developers.cloudflare.com/api-gateway/)
- [API Shield Documentation](https://developers.cloudflare.com/api-shield/)
- [OpenAPI Specification](https://spec.openapis.org/oas/v3.0.3)
- [Rate Limiting Guide](https://developers.cloudflare.com/waf/rate-limiting-rules/)

## Support

If you encounter issues:
1. Check [Cloudflare Community](https://community.cloudflare.com/)
2. Review [Cloudflare Status](https://www.cloudflarestatus.com/)
3. Open a ticket with Cloudflare Support (for paid plans)
4. Check the [No-as-a-Service GitHub Issues](https://github.com/Koneisto/no-as-a-service/issues)
