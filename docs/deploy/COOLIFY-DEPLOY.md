# Deploy to Coolify - Quick Guide

## Step 1: Commit Files

```bash
git add ../../Dockerfile .dockerignore ../../test.html
git commit -m "Add schema cache test page deployment"
git push origin main
```

## Step 2: Create Application in Coolify

1. Open Coolify dashboard: http://104.225.219.46:8000
2. Click **"+ New"** → **"Application"**
3. Select **"Public Repository"** or connect your Git repo
4. Configure:
   - **Repository URL**: Your repo URL
   - **Branch**: `main`
   - **Build Pack**: `dockerfile`
   - **Port**: `80`
   - **Domain**: `schema-test.yourdomain.com` (or use the provided subdomain)

5. Click **"Deploy"**

## Step 3: Access Your Site

Once deployed, visit your domain. You should see the Schema Cache Test Page.

## Testing Cache Behavior

1. First page load will show `X-Cache: MISS`
2. Click the **"🔄 Refetch Schema"** button
3. Should now show `X-Cache: HIT` ✅

## Troubleshooting

**If deployment fails:**
- Check Coolify build logs
- Ensure ../../Dockerfile is in repository root
- Verify port 80 is exposed

**If cache shows MISS every time:**
- This is expected on page refresh (F5/Cmd+R)
- Use the "Refetch" button to test cache without page reload
- Browser sends `Cache-Control: no-cache` on refresh

## Environment Variables (Optional)

To use a different client_id, you can modify ../../test.html or add query parameters:

```
https://schema-test.yourdomain.com?client_id=YOUR_CLIENT_ID
```

## Cleanup

To remove the deployment from Coolify:
1. Go to your application in Coolify
2. Click **"Stop"**
3. Click **"Delete"**
