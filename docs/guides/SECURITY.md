# Security Guide

This document outlines security best practices and configurations for deploying NoaaS.

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [CORS Configuration](#cors-configuration)
3. [Rate Limiting](#rate-limiting)
4. [Trust Proxy Settings](#trust-proxy-settings)
5. [Security Headers](#security-headers)
6. [Secrets Management](#secrets-management)
7. [Production Deployment](#production-deployment)
8. [Security Checklist](#security-checklist)

---

## Environment Variables

### Setup

1. **Never commit `.env` files to version control**
   - The `.gitignore` file already excludes `.env` files
   - Use `.env.example` as a template

2. **Create your `.env` file**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Required variables**
   ```bash
   PORT=3000
   NODE_ENV=production
   TRUST_PROXY=1
   CORS_ORIGIN=https://your-domain.com
   ```

### Environment Variable Reference

| Variable | Default | Description | Security Impact |
|----------|---------|-------------|----------------|
| `PORT` | `3000` | Server port | Low - Use standard ports in production |
| `NODE_ENV` | `development` | Environment mode | **High** - Always set to `production` in prod |
| `TRUST_PROXY` | `1` | Proxy trust level | **High** - Critical for rate limiting accuracy |
| `CORS_ORIGIN` | `*` | Allowed origins | **Critical** - Never use `*` in production |
| `RATE_LIMIT_MAX` | `60` | Max requests per window | Medium - Prevents abuse |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) | Medium - Prevents abuse |
| `REASONS_FILE_PATH` | `./reasons.json` | Data file path | Low - Ensure file permissions are correct |

---

## CORS Configuration

### Development Setup

For local development, allowing all origins is acceptable:

```bash
CORS_ORIGIN=*
```

### Production Setup

**Always specify exact origins in production:**

#### Single Origin
```bash
CORS_ORIGIN=https://your-app.com
```

#### Multiple Origins
```bash
CORS_ORIGIN=https://your-app.com,https://app.your-domain.com
```

#### Dynamic Origins (Advanced)

For complex scenarios, modify `index.js`:

```javascript
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = CORS_ORIGIN.split(',');
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));
```

### Security Implications

| Configuration | Security Level | Use Case |
|---------------|----------------|----------|
| `CORS_ORIGIN=*` | ⚠️ Unsafe | Development only |
| `CORS_ORIGIN=https://specific-domain.com` | ✅ Safe | Production (single domain) |
| Multiple specific domains | ✅ Safe | Production (multi-domain) |
| Dynamic validation | ✅ Safe | Production (complex rules) |

---

## Rate Limiting

### How It Works

Rate limiting prevents abuse by restricting requests per IP address.

**Default:** 60 requests per minute per IP (1 request per second)

### Configuration

```bash
# .env
RATE_LIMIT_MAX=60
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MESSAGE=Too many requests, please slow down.
```

### Recommended Limits by Use Case

| Use Case | Requests | Window | Configuration |
|----------|----------|--------|---------------|
| **Public API** | 60 | 1 minute | Default (recommended) |
| **Internal API** | 300 | 1 minute | Relaxed for trusted networks |
| **Strict Protection** | 30 | 1 minute | High-security environments |
| **Per-second limit** | 10 | 1 second | Very strict (1000ms window) |

### Behind Cloudflare or Proxy

When behind Cloudflare, rate limiting uses `cf-connecting-ip` header to get real IP:

```javascript
keyGenerator: (req) => req.headers['cf-connecting-ip'] || req.ip
```

**Important:** You must configure `TRUST_PROXY` correctly for this to work.

---

## Trust Proxy Settings

### Why It Matters

When behind a reverse proxy (Nginx, Cloudflare, etc.), the real client IP is forwarded via headers. Setting `TRUST_PROXY` correctly ensures:

1. ✅ Accurate rate limiting per real IP
2. ✅ Correct logging of client IPs
3. ✅ Security headers work properly

### Configuration

#### Behind Single Proxy (Cloudflare, Nginx)
```bash
TRUST_PROXY=1
```

#### Behind Multiple Proxies
```bash
# Trust 2 proxies
TRUST_PROXY=2
```

#### Trust Specific IPs Only (Most Secure)
```bash
TRUST_PROXY=loopback,10.0.0.1
```

#### Behind Cloudflare (Trust All Cloudflare IPs)
```bash
TRUST_PROXY=true
```

### Verification

Test that your IP is being detected correctly:

```bash
curl -H "X-Forwarded-For: 1.2.3.4" https://your-api.com/health
# Check logs to see if 1.2.3.4 is detected
```

### Security Risk

⚠️ **Setting `TRUST_PROXY=true` without a proxy can be exploited:**

Attackers can spoof `X-Forwarded-For` headers to bypass rate limits.

**Solution:** Only set `TRUST_PROXY=true` when actually behind a trusted proxy.

---

## Security Headers

NoaaS uses [Helmet.js](https://helmetjs.github.io/) for security headers.

### Default Headers Applied

```
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=15552000; includeSubDomains
```

### Custom Configuration

To customize Helmet settings, edit `index.js`:

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // If needed for inline styles
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

---

## Secrets Management

### Local Development

Use `.env` file for local secrets:

```bash
# .env (never commit this)
API_KEY=dev-key-123
DATABASE_URL=postgresql://localhost/noaas
```

### Production Deployment

**Never use `.env` files in production.** Use platform-specific secret management:

#### Docker
```bash
docker run -e NODE_ENV=production -e API_KEY=secret your-image
```

#### Docker Compose
```yaml
services:
  api:
    environment:
      - NODE_ENV=production
      - API_KEY=${API_KEY}
    env_file:
      - .env.production  # Not committed to git
```

#### Kubernetes
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: noaas-secrets
type: Opaque
data:
  api-key: <base64-encoded-secret>
```

#### Cloud Platforms

- **AWS**: Use AWS Systems Manager Parameter Store or Secrets Manager
- **Google Cloud**: Use Secret Manager
- **Azure**: Use Key Vault
- **Heroku**: Use Config Vars
- **Vercel/Netlify**: Use Environment Variables UI

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure specific `CORS_ORIGIN` (not `*`)
- [ ] Set appropriate `TRUST_PROXY` value
- [ ] Use secrets management (not `.env` files)
- [ ] Enable HTTPS (use SSL certificates)
- [ ] Configure rate limiting appropriately
- [ ] Review and test all environment variables
- [ ] Ensure `reasons.json` file permissions are correct (read-only)
- [ ] Set up monitoring and logging
- [ ] Configure firewall rules

### Example Production `.env`

```bash
# Production configuration (use secret management instead of .env)
NODE_ENV=production
PORT=3000
TRUST_PROXY=1
CORS_ORIGIN=https://your-domain.com,https://app.your-domain.com
RATE_LIMIT_MAX=60
RATE_LIMIT_WINDOW_MS=60000
REASONS_FILE_PATH=/app/data/reasons.json
```

### SSL/TLS Configuration

**Always use HTTPS in production.**

#### Option 1: Reverse Proxy (Recommended)
Use Nginx or Cloudflare to handle SSL:

```nginx
server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }
}
```

#### Option 2: Cloudflare (Free SSL)
1. Point domain to Cloudflare nameservers
2. Enable "Full (strict)" SSL mode
3. Deploy NoaaS on your server
4. Cloudflare automatically handles SSL

---

## Security Checklist

### Development

- [x] `.env` file exists and is in `.gitignore`
- [x] All secrets use environment variables
- [x] `NODE_ENV=development` is set
- [x] CORS allows all origins for testing (`*`)

### Staging

- [ ] `NODE_ENV=production` or `NODE_ENV=staging`
- [ ] CORS restricted to staging domain
- [ ] Secrets managed via platform tools
- [ ] HTTPS enabled
- [ ] Rate limiting tested

### Production

- [ ] `NODE_ENV=production`
- [ ] CORS restricted to production domain(s) only
- [ ] `TRUST_PROXY` configured correctly
- [ ] No `.env` file in production (use secret management)
- [ ] HTTPS enforced (redirect HTTP to HTTPS)
- [ ] Rate limiting appropriate for load
- [ ] Security headers enabled (Helmet)
- [ ] File permissions reviewed (reasons.json should be read-only)
- [ ] Monitoring and alerting configured
- [ ] Logs reviewed regularly
- [ ] Backup and disaster recovery plan in place

---

## Reporting Security Issues

If you discover a security vulnerability, please email **systems@koneisto** with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (optional)

**Do not open public GitHub issues for security vulnerabilities.**

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Cloudflare Security Settings](https://developers.cloudflare.com/fundamentals/security/)

---

**Last Updated:** 2025-11-21

For deployment guides, see:
- [QUICKSTART_WORKERS.md](./QUICKSTART_WORKERS.md) - Cloudflare Workers deployment
- [CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md) - All Cloudflare deployment methods
