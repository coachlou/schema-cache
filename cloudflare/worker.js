// Cloudflare Worker: schema-proxy
// Proxies requests to Supabase with edge caching for get-schema endpoint
// Deploy at: schema.coachlou.com

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only cache GET requests to get-schema
    const shouldCache = request.method === 'GET' && url.pathname.includes('/get-schema');

    if (shouldCache) {
      // Check cache first
      const cache = caches.default;
      const cacheKey = new Request(url.toString(), request);
      let response = await cache.match(cacheKey);

      if (response) {
        // Cache hit - add header to indicate
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('X-Cache', 'HIT');
        newResponse.headers.set('Access-Control-Allow-Origin', '*');
        newResponse.headers.set('Access-Control-Expose-Headers', 'X-Cache');
        return newResponse;
      }

      // Cache miss - fetch from origin
      const supabaseUrl = new URL(url.pathname + url.search, 'https://uxkudwzbqijamqhuowly.supabase.co');
      response = await fetch(supabaseUrl.toString(), {
        method: request.method,
        headers: request.headers
      });

      // Clone and modify response for caching
      const responseToCache = new Response(response.body, response);
      responseToCache.headers.set('Cache-Control', 'public, max-age=86400');
      responseToCache.headers.set('X-Cache', 'MISS');
      responseToCache.headers.set('Access-Control-Allow-Origin', '*');
      responseToCache.headers.set('Access-Control-Expose-Headers', 'X-Cache');

      // Store in cache (don't await - do it in background)
      ctx.waitUntil(cache.put(cacheKey, responseToCache.clone()));

      return responseToCache;
    }

    // Non-cached requests - just proxy
    const supabaseUrl = new URL(url.pathname + url.search, 'https://uxkudwzbqijamqhuowly.supabase.co');
    return fetch(supabaseUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
    });
  }
}
