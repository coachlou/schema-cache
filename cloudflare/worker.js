// Cloudflare Worker: schema-proxy
// Proxies requests to Supabase with edge caching for get-schema endpoint
// Deploy at: schema.coachlou.com
//
// Deployment:
//   1. Log into Cloudflare Dashboard
//   2. Navigate to Workers & Pages
//   3. Edit the schema-proxy worker
//   4. Copy and paste this code
//   OR use Wrangler CLI:
//   wrangler deploy

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // Only cache GET requests to get-schema
    const shouldCache = request.method === 'GET' && url.pathname.includes('/get-schema');

    if (shouldCache) {
      // Check cache first
      const cache = caches.default;
      // Create cache key from URL only (ignore headers for better cache hits)
      const cacheKey = new Request(url.toString(), {
        method: 'GET',
        headers: {
          'Host': url.host
        }
      });
      let response = await cache.match(cacheKey);

      if (response) {
        // Cache hit - add header to indicate
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('X-Cache', 'HIT');
        newResponse.headers.set('Access-Control-Allow-Origin', '*');
        newResponse.headers.set('Access-Control-Expose-Headers', 'X-Cache, CF-Cache-Status, Age, Cache-Control');
        return newResponse;
      }

      // Cache miss - fetch from origin
      const supabaseUrl = new URL(url.pathname + url.search, 'https://uxkudwzbqijamqhuowly.supabase.co');
      const headers = new Headers(request.headers);
      // Add custom header so Edge Functions know the original host
      // Supabase strips X-Forwarded-Host, so use a custom header
      headers.set('X-Original-Host', url.host);
      response = await fetch(supabaseUrl.toString(), {
        method: request.method,
        headers: headers
      });

      // Clone response immediately before consuming body
      const responseClone = response.clone();

      // Modify headers for client response
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Cache-Control', 'public, max-age=86400');
      newResponse.headers.set('X-Cache', 'MISS');
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      newResponse.headers.set('Access-Control-Expose-Headers', 'X-Cache, CF-Cache-Status, Age, Cache-Control');

      // Store clone in cache (don't await - do it in background)
      const cacheResponse = new Response(responseClone.body, responseClone);
      cacheResponse.headers.set('Cache-Control', 'public, max-age=86400');
      ctx.waitUntil(cache.put(cacheKey, cacheResponse));

      return newResponse;
    }

    // Non-cached requests - just proxy
    const supabaseUrl = new URL(url.pathname + url.search, 'https://uxkudwzbqijamqhuowly.supabase.co');
    const headers = new Headers(request.headers);
    // Add custom header so Edge Functions know the original host
    // Supabase strips X-Forwarded-Host, so use a custom header
    headers.set('X-Original-Host', url.host);
    return fetch(supabaseUrl.toString(), {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
    });
  }
}
