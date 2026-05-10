# Manual Deployment to Cloudflare Pages

This guide explains how to manually deploy your ReflectivAI application to Cloudflare Pages.

## Prerequisites

Before using the manual deployment workflow, you need to set up the following secrets in your GitHub repository:

### 1. Create GitHub Secrets

Go to **Settings → Secrets and variables → Actions** in your GitHub repository and add:

- **`CLOUDFLARE_API_TOKEN`**: Your Cloudflare API token
  - Get this from Cloudflare Dashboard → My Profile → API Tokens
  - Create a token with permission to deploy to Pages and Workers
  
- **`CLOUDFLARE_ACCOUNT_ID`**: Your Cloudflare account ID
  - This is already `59fea97fab54fbd4d4168ccaa1fa3410` (from your wrangler.toml)
  - Add it as a secret for security

### 2. Create Cloudflare API Token

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to **My Profile → API Tokens**
3. Click **Create Token**
4. Select **Custom token** and configure:
   - **Permissions**: 
     - `Pages:All zones - Edit` (for Pages deployments)
     - `Workers KV Storage:Edit` (if needed for KV storage)
     - `Workers Scripts:Edit` (for Worker deployments)
   - **Zone Resources**: Select your zone or All zones
5. Copy the token and add it to GitHub Secrets as `CLOUDFLARE_API_TOKEN`

## How to Deploy Manually

### Method 1: From GitHub Actions UI (Easiest)

1. Go to your GitHub repository: `https://github.com/ReflectivEI/reflectiv-AIv4`
2. Navigate to **Actions** tab
3. Select **"Manual Deploy to Cloudflare Pages"** workflow on the left
4. Click **"Run workflow"** button (top right)
5. Choose environment:
   - `production` - Deploy to live site
   - `staging` - Deploy to staging environment
6. Click **"Run workflow"**
7. Monitor the deployment in the workflow run details

### Method 2: Using GitHub CLI (Terminal)

```bash
# Deploy to production
gh workflow run deploy-pages.yml --ref main -f environment=production

# Deploy to staging
gh workflow run deploy-pages.yml --ref main -f environment=staging
```

### Method 3: Automatic Deployment (Default - Branch Push)

The workflow automatically deploys when you push to the `main` branch. To do a manual deployment from your local machine:

```bash
# Make your changes
git add .
git commit -m "Your commit message"

# Push to trigger automatic deployment
git push origin main
```

## Deployment Process

The workflow performs these steps:

1. ✅ Checks out your code
2. ✅ Sets up Node.js 18
3. ✅ Installs npm dependencies (`npm ci`)
4. ✅ Builds your application (`npm run build`)
5. ✅ Deploys to Cloudflare Pages using Wrangler
6. ✅ Creates GitHub deployment record
7. ✅ Notifies you of success/failure

## Monitoring Deployment

### In GitHub

1. Go to **Actions** tab
2. Click on the failed or in-progress workflow run
3. View detailed logs for each step
4. Check the status jobs

### In Cloudflare

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain (`reflectiv-ai.com`)
3. Go to **Pages** (left sidebar)
4. Click on your Pages project
5. View recent deployments and status

### Testing Deployment

After successful deployment:

1. **For GitHub Pages URL**: Visit the URL provided in Cloudflare Pages dashboard
2. **For your domain**: Visit `https://reflectiv-ai.com` (after DNS is configured)
3. Verify the demo login page loads with:
   - Email: `demo@reflectivai.com`
   - Password: `letmein`

## Troubleshooting

### Workflow fails with "API token invalid"

- Verify `CLOUDFLARE_API_TOKEN` secret is set correctly in GitHub
- Check token permissions in Cloudflare dashboard
- Ensure token hasn't expired

### Workflow fails with "Build error"

- Check the workflow logs for npm or build errors
- Run `npm run build` locally to test
- Verify all dependencies are installed: `npm ci`

### Deployment created but site not updating

- Clear browser cache (Ctrl+Shift+Delete)
- Wait 2-5 minutes for DNS propagation
- Check Cloudflare Pages deployment history for errors

### "Pages project not found"

- Verify your Cloudflare account ID is correct: `59fea97fab54fbd4d4168ccaa1fa3410`
- Ensure Pages project is created in Cloudflare dashboard
- Check that account has proper permissions

## Local Testing

Before deploying, test locally:

```bash
# Build the project
npm run build

# Preview the build
npm run preview

# Or use Vite dev server
npm run dev
```

## Environment Variables

Currently, the app runs in **demo mode** with no external dependencies. If you need to add environment variables:

1. Create `.env.production` in your project root
2. Add variables (they'll be embedded during build)
3. Update workflow to pass them during build if needed

## Files Modified/Created

- `.github/workflows/deploy-pages.yml` - Manual deployment workflow
- `DEPLOYMENT_GUIDE.md` - This documentation (optional)

## Contact & Support

For issues with:
- **GitHub Actions**: Check GitHub Actions documentation
- **Cloudflare Pages**: Visit [Cloudflare Support](https://support.cloudflare.com)
- **Your app**: Check project README.md

---

**Last Updated**: February 27, 2026
# Deployment triggered on Fri Feb 27 13:57:23 PST 2026
