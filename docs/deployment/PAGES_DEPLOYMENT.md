# Deploy Landing Page to Cloudflare Pages

Deploy the NoaaS landing page (`index.html`) to Cloudflare Pages in 2 minutes.

## Quick Start

### Option 1: Direct Upload (Easiest)

1. **Go to Cloudflare Pages**
   - Visit https://dash.cloudflare.com
   - Click **Workers & Pages** → **Create** → **Pages** → **Upload assets**

2. **Upload index.html**
   - Name your project: `noaas-landing` (or whatever you prefer)
   - Drag and drop `index.html`
   - Click **Deploy site**

3. **Done!**
   - Your site will be live at: `https://noaas-landing.pages.dev`
   - You can add a custom domain later

**That's it! Total time: 2 minutes.**

---

### Option 2: Git Integration (Recommended for updates)

1. **Push to GitHub/GitLab**
   ```bash
   git init
   git add index.html
   git commit -m "Add landing page"
   git remote add origin https://github.com/yourusername/noaas-landing.git
   git push -u origin main
   ```

2. **Connect to Cloudflare Pages**
   - Go to https://dash.cloudflare.com
   - Click **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
   - Select your repository: `noaas-landing`

3. **Configure Build Settings**
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `/`
   - Root directory: `/`

4. **Deploy**
   - Click **Save and Deploy**
   - Wait ~30 seconds for build to complete
   - Your site is live!

**Automatic deployments:** Every git push will now auto-deploy!

---

## Custom Domain Setup

1. **Go to your Pages project**
   - Click **Custom domains** tab
   - Click **Set up a custom domain**

2. **Add your domain**
   - Enter: `noaas.yourdomain.com` (or any subdomain)
   - Click **Continue**

3. **Update DNS**
   - Cloudflare automatically adds CNAME record if domain is on CF
   - If external DNS: Add CNAME pointing to `noaas-landing.pages.dev`

4. **Wait for SSL**
   - SSL certificate is automatically provisioned
   - Usually takes 1-2 minutes
   - Check status: **Active Certificate** ✅

5. **Done!**
   - Your site is now at: `https://noaas.yourdomain.com`

---

## Updating Your Site

### Method 1: Direct Upload
- Go to Pages project → **Deployments** → **Create deployment**
- Upload updated `index.html`
- New version goes live immediately

### Method 2: Git Push (if using Git)
```bash
# Make changes to index.html
git add index.html
git commit -m "Update landing page"
git push

# Auto-deploys to Cloudflare Pages!
```

---

## Environment Variables (Optional)

If you want to set a default API URL for all users:

1. Edit `index.html` and find this line (around line 466):
   ```javascript
   const apiUrlInput = document.getElementById('apiUrl').value.trim();
   ```

2. Replace with your Worker URL:
   ```javascript
   const apiUrlInput = document.getElementById('apiUrl').value.trim()
       || 'https://noaas.YOUR-SUBDOMAIN.workers.dev';
   ```

3. Redeploy

Now users don't need to enter the API URL manually!

---

## Preview Deployments

Cloudflare Pages creates preview URLs for every git branch:

- `main` branch → `https://noaas-landing.pages.dev` (production)
- `dev` branch → `https://dev.noaas-landing.pages.dev` (preview)
- Pull requests → Unique preview URL per PR

Perfect for testing changes before going live!

---

## Features You Get

✅ **Free hosting** (unlimited bandwidth!)
✅ **Global CDN** (300+ cities)
✅ **Automatic HTTPS** (free SSL)
✅ **Instant cache purge**
✅ **Git-based deployments** (optional)
✅ **Preview deployments** (for branches/PRs)
✅ **Web Analytics** (optional, privacy-first)
✅ **99.99% uptime** SLA

---

## Troubleshooting

### Site not loading
- Check deployment status in Pages dashboard
- Verify `index.html` is in root directory
- Check browser console for errors

### 404 error
- Ensure file is named exactly `index.html` (lowercase)
- Check build output directory is set to `/`

### Styles not working
- All CSS is inline in `index.html` - no external files needed
- Clear browser cache (Cmd/Ctrl + Shift + R)

### API demo not working
- Enter your Worker URL in the input field
- Make sure Worker is deployed and accessible
- Check CORS is enabled in Worker (it is by default)

---

## Cost

**$0/month**

Cloudflare Pages free tier includes:
- Unlimited requests
- Unlimited bandwidth
- 500 builds per month
- 1 build at a time

---

## Next Steps

1. ✅ Deploy landing page to Pages
2. ✅ Deploy Worker (see QUICKSTART_WORKERS.md)
3. ✅ Add Worker URL to landing page
4. ✅ Share with users!

Optional:
- Set up custom domain
- Enable Web Analytics (privacy-first)
- Add to GitHub/GitLab for automatic deployments

---

## Example Complete Setup

**Worker URL:** `https://noaas.mycompany.workers.dev`
**Landing Page:** `https://noaas.mycompany.com`

Users visit your landing page, try the demo, and integrate your API into Claude Desktop. Perfect! 🎉

---

For more help:
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Pages Deployment Guide](https://developers.cloudflare.com/pages/get-started/)
