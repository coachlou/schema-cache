# Deployment Guide

## Deploying test.html to Coolify/VPS

This guide shows how to deploy the schema cache test page as a static website.

### Option 1: Deploy with Coolify (Recommended)

1. **Push to Git Repository**
   ```bash
   git add Dockerfile nginx.conf .dockerignore test.html
   git commit -m "Add static site deployment for test.html"
   git push origin main
   ```

2. **Create New Application in Coolify**
   - Go to your Coolify dashboard
   - Click "New Resource" → "Application"
   - Select your Git repository
   - Branch: `main`
   - Build Pack: **Dockerfile**
   - Port: `80`

3. **Configure Domain**
   - Set domain (e.g., `schema-test.yourdomain.com`)
   - Enable HTTPS/SSL
   - Save and Deploy

4. **Access Your Test Page**
   - Visit: `https://schema-test.yourdomain.com`
   - Click "Refetch Schema" button to test caching

### Option 2: Deploy Manually on VPS

1. **Clone Repository on VPS**
   ```bash
   ssh user@your-vps
   cd /opt
   git clone <your-repo-url> schema-test
   cd schema-test
   ```

2. **Build and Run with Docker**
   ```bash
   docker build -t schema-test .
   docker run -d -p 8080:80 --name schema-test schema-test
   ```

3. **Setup Nginx Reverse Proxy** (Optional)
   ```nginx
   server {
       listen 80;
       server_name schema-test.yourdomain.com;

       location / {
           proxy_pass http://localhost:8080;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

4. **Enable HTTPS with Certbot**
   ```bash
   sudo certbot --nginx -d schema-test.yourdomain.com
   ```

### Option 3: Deploy to Cloudflare Pages

1. **Create `public` directory**
   ```bash
   mkdir public
   cp test.html public/index.html
   ```

2. **Push to GitHub**
   ```bash
   git add public/
   git commit -m "Add Cloudflare Pages deployment"
   git push
   ```

3. **Deploy via Cloudflare Dashboard**
   - Go to Cloudflare Dashboard → Pages
   - Connect your GitHub repository
   - Build directory: `public`
   - Deploy

### Testing the Deployment

Once deployed, test the caching:

1. Open the deployed URL in your browser
2. First load should show `X-Cache: MISS`
3. Click "🔄 Refetch Schema" button
4. Should now show `X-Cache: HIT`

### Environment-Specific Configuration

If you need to use different client IDs or domains per environment, you can modify test.html to read from query parameters:

```javascript
const CLIENT_ID = new URLSearchParams(window.location.search).get('client_id') || '8939ddba-6a96-4bd9-8d7b-b1333c955aeb';
```

Then access: `https://your-domain.com?client_id=YOUR_CLIENT_ID`
