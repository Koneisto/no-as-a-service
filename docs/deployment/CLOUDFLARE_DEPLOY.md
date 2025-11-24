# Cloudflare Deployment Guide

This guide covers multiple ways to deploy NoaaS on Cloudflare infrastructure.

## Option 1: Cloudflare Tunnel (Easiest - Zero Code Changes)

This is the **recommended approach** if you want to keep the existing Node.js code as-is.

### Prerequisites
- Your app running somewhere (local machine, VPS, Docker, etc.)
- Cloudflare account with a domain

### Steps

1. **Install cloudflared**
```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# Windows
# Download from: https://github.com/cloudflare/cloudflared/releases
```

2. **Authenticate with Cloudflare**
```bash
cloudflared tunnel login
```

3. **Create a tunnel**
```bash
cloudflared tunnel create noaas
```

This creates a tunnel and saves credentials to `~/.cloudflared/<TUNNEL-ID>.json`

4. **Configure the tunnel**
```bash
# Create config file
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: <YOUR-TUNNEL-ID>
credentials-file: /Users/yourusername/.cloudflared/<YOUR-TUNNEL-ID>.json

ingress:
  - hostname: noaas.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
EOF
```

5. **Start your Node.js app**
```bash
# Start the NoaaS service
npm start
# or
docker-compose up
```

6. **Route DNS to your tunnel**
```bash
cloudflared tunnel route dns noaas noaas.yourdomain.com
```

7. **Run the tunnel**
```bash
# Test first
cloudflared tunnel run noaas

# If working, install as a service
cloudflared service install
```

### Benefits
- ✅ Zero code changes required
- ✅ Automatic HTTPS
- ✅ DDoS protection
- ✅ No exposed ports/firewall config needed
- ✅ Works from anywhere (home network, VPS, etc.)

---

## Option 2: VPS/Cloud + Cloudflare Proxy

Deploy to any cloud provider and use Cloudflare as a reverse proxy.

### Recommended Providers
- **DigitalOcean**: $6/month droplet
- **Fly.io**: ~$5/month (has free tier)
- **Railway**: Pay-as-you-go
- **Render**: Free tier available

### Example: DigitalOcean Deployment

1. **Create a Droplet**
   - Ubuntu 22.04 LTS
   - $6/month (1GB RAM)
   - Enable automatic backups

2. **SSH into server and setup**
```bash
ssh root@your-droplet-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Clone your repo
git clone https://github.com/yourusername/no-as-a-service.git
cd no-as-a-service

# Create .env file
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
TRUST_PROXY=1
CORS_ORIGIN=*
EOF

# Start with Docker Compose
docker-compose up -d

# Verify it's running
curl http://localhost:3000/health
```

3. **Point domain to server**
   - In Cloudflare DNS, add an A record:
     - Name: `noaas` (or `@` for root domain)
     - Content: Your droplet IP
     - Proxy status: **Proxied** (orange cloud) ✅

4. **Enable Cloudflare features**
   - SSL/TLS: Set to "Full" mode
   - Enable "Always Use HTTPS"
   - Enable "Auto Minify" (JS, CSS, HTML)
   - Consider enabling WAF rules

### Setup Nginx Reverse Proxy (Optional but recommended)
```bash
# Install Nginx
apt install nginx -y

# Create Nginx config
cat > /etc/nginx/sites-available/noaas << 'EOF'
server {
    listen 80;
    server_name noaas.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/noaas /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

---

## Option 3: Fly.io (Easy Docker Deployment)

Fly.io has excellent Docker support and free tier.

### Steps

1. **Install flyctl**
```bash
curl -L https://fly.io/install.sh | sh
```

2. **Login to Fly.io**
```bash
fly auth login
```

3. **Launch app**
```bash
fly launch
# Follow prompts:
# - Choose app name: noaas
# - Choose region closest to your users
# - Don't deploy yet (we need to configure)
```

4. **Update fly.toml**
```toml
app = "noaas"
primary_region = "sjc"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

  [[http_service.checks]]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    timeout = "5s"
    path = "/health"
```

5. **Update Dockerfile PORT**
```dockerfile
EXPOSE 8080
```

6. **Deploy**
```bash
fly deploy
```

7. **Point Cloudflare to Fly.io (optional)**
```bash
# Get your Fly.io app URL
fly info

# In Cloudflare DNS:
# Add CNAME record pointing to your-app.fly.dev
# Enable proxy (orange cloud)
```

---

## Option 4: Cloudflare Workers (Requires Code Rewrite)

If you want true serverless on Cloudflare's edge, you'll need to rewrite the app for Workers.

### Challenges
- ❌ No `express` support
- ❌ No `fs` module (use KV or R2 for reasons.json)
- ❌ Different API (Fetch API instead of Express)
- ✅ But: Global edge deployment, unlimited scale, free tier

### Quick Start (if you want to pursue this)

1. **Install Wrangler**
```bash
npm install -g wrangler
wrangler login
```

2. **Initialize project**
```bash
wrangler init noaas-worker
```

3. **Rewrite index.js using Fetch API**
```javascript
// Example worker structure (not complete):
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Load reasons from KV
    const reasons = JSON.parse(await env.REASONS_KV.get('reasons'));

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok' });
    }

    // ... handle other routes
  }
}
```

4. **Store reasons.json in KV**
```bash
wrangler kv:namespace create REASONS_KV
wrangler kv:key put --namespace-id=<ID> reasons "$(cat reasons.json)"
```

5. **Deploy**
```bash
wrangler deploy
```

**Note:** This requires significant refactoring. Only pursue if you need edge compute.

---

## Recommended Approach

**For most users: Option 1 (Cloudflare Tunnel) or Option 2 (VPS + Cloudflare Proxy)**

These options:
- Require no code changes
- Are production-ready immediately
- Give you full Cloudflare protection
- Are easy to maintain

**Cost comparison:**
- Cloudflare Tunnel: Free (run on existing hardware/VPS)
- VPS + CF Proxy: ~$5-6/month
- Fly.io: ~$5/month (free tier available)
- CF Workers: Would require rewrite

---

## Post-Deployment Checklist

After deploying, verify:

- [ ] `https://your-domain.com/health` returns 200 OK
- [ ] All endpoints return proper JSON responses
- [ ] Rate limiting works (test 121 requests in 1 minute)
- [ ] CORS headers present
- [ ] Security headers present (use securityheaders.com)
- [ ] SSL certificate valid (A+ on ssllabs.com)
- [ ] Response times < 100ms
- [ ] Setup monitoring (UptimeRobot, Pingdom, etc.)

---

## Environment Variables for Production

```bash
NODE_ENV=production
PORT=3000
TRUST_PROXY=1  # Or 2 if behind Nginx + Cloudflare
CORS_ORIGIN=https://yourdomain.com  # Or * for public API
```

---

## Troubleshooting

### "Address already in use" error
```bash
# Find process using port 3000
lsof -i :3000
kill -9 <PID>
```

### Cloudflare 520 errors
- Check your origin server is running: `curl http://localhost:3000/health`
- Verify firewall allows Cloudflare IPs
- Check Cloudflare SSL mode is "Full" not "Full (Strict)"

### Rate limit not working
- Verify `TRUST_PROXY` is set correctly
- Check `X-Forwarded-For` header is being passed

---

## Support

- 📧 Email: systems@koneisto
- 🐛 Issues: GitHub Issues
- 📚 Docs: README.md
