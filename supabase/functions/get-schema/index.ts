// supabase/functions/get-schema/index.ts
// Returns the JSON-LD schema for a specific page URL.
// Optimized for performance with direct REST API call

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  const url = new URL(req.url);
  // Keep client_id in public API for backwards compatibility, map to organization_id internally
  const organizationId = url.searchParams.get('client_id');
  const pageUrl = url.searchParams.get('url');

  if (!organizationId || !pageUrl) {
    return new Response(JSON.stringify({ error: 'Missing client_id or url' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // Normalize URL (remove trailing slash inconsistencies)
  const normalizedUrl = pageUrl.replace(/\/+$/, '');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Use direct REST API call for faster response (avoids JS client overhead)
  const apiUrl = `${supabaseUrl}/rest/v1/page_schemas?organization_id=eq.${encodeURIComponent(organizationId)}&page_url=eq.${encodeURIComponent(normalizedUrl)}&select=schema_json,cache_version&limit=1`;

  const response = await fetch(apiUrl, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Accept': 'application/json'
    }
  });

  let data = await response.json();

  // If no exact match, try with trailing slash
  if (!data || data.length === 0) {
    const apiUrlWithSlash = `${supabaseUrl}/rest/v1/page_schemas?organization_id=eq.${encodeURIComponent(organizationId)}&page_url=eq.${encodeURIComponent(normalizedUrl + '/')}&select=schema_json,cache_version&limit=1`;
    const response2 = await fetch(apiUrlWithSlash, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Accept': 'application/json'
      }
    });
    data = await response2.json();
  }

  // If still no match, return empty schema
  if (!data || data.length === 0) {
    return new Response(JSON.stringify({}), {
      headers: {
        'Content-Type': 'application/ld+json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=300, max-age=300',
        'CDN-Cache-Control': 'public, max-age=300'
      }
    });
  }

  const result = data[0];

  return new Response(JSON.stringify(result.schema_json), {
    headers: {
      'Content-Type': 'application/ld+json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=86400, max-age=86400',
      'CDN-Cache-Control': 'public, max-age=86400',
      'Surrogate-Control': 'max-age=86400',
      'ETag': `"${result.cache_version}"`,
      'Vary': 'Origin'
    }
  });
});
