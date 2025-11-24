# Security Policy

## Sensitive Files

The following files contain sensitive information and are **NOT** included in this repository:

### 🔒 Never Commit These Files

1. **`deployment/wrangler.toml`** - Contains your actual Cloudflare KV namespace IDs
   - Use `deployment/wrangler.toml.example` as a template
   - Copy and modify it with your own credentials
   - Already excluded via `.gitignore`

2. **`.env`** - Contains environment variables and secrets
   - Use `.env.example` as a template
   - Already excluded via `.gitignore`

3. **`.wrangler/`** - Cloudflare Wrangler cache and local state
   - Already excluded via `.gitignore`

## Setup Instructions

When cloning this repository:

1. **Copy configuration templates:**
   ```bash
   cp deployment/wrangler.toml.example deployment/wrangler.toml
   cp .env.example .env
   ```

2. **Update with your credentials:**
   - Edit `deployment/wrangler.toml` with your KV namespace IDs
   - Edit `.env` with your configuration (if running Node.js/Express)

3. **Never commit these files:**
   ```bash
   # These files should already be in .gitignore
   # If you accidentally add them, remove with:
   git rm --cached deployment/wrangler.toml
   git rm --cached .env
   ```

## What's Safe to Share

✅ **These files are safe to commit:**
- `deployment/wrangler.toml.example` - Template with placeholder values
- `.env.example` - Template with example configuration
- All source code files
- Documentation
- Docker configurations
- Landing page

## Reporting Security Issues

If you discover a security vulnerability, please use [GitHub Security Advisories](https://github.com/Koneisto/no-as-a-service/security/advisories/new) to report it privately.

**Do NOT** open a public issue for security vulnerabilities.

## Security Best Practices

When deploying NoaaS:

1. **Use environment variables** for all sensitive configuration
2. **Never hardcode** API keys, secrets, or credentials
3. **Enable Cloudflare's security features:**
   - WAF (Web Application Firewall)
   - DDoS protection
   - Rate limiting (already implemented)
4. **Keep dependencies updated:**
   ```bash
   npm audit
   npm update
   ```
5. **Review logs regularly** for suspicious activity:
   ```bash
   npm run worker:tail
   ```

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Cloudflare Security Best Practices](https://developers.cloudflare.com/workers/best-practices/security/)
- [Security Guide](./docs/guides/SECURITY.md) - Detailed security configuration

---

**Remember:** Security is not a feature, it's a requirement. Keep your credentials private.
