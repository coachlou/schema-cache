// supabase/functions/get-schema/index.ts
// Returns the JSON-LD schema for a specific page URL.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  const clientId = url.searchParams.get('client_id');
  const pageUrl = url.searchParams.get('url');

  if (!clientId || !pageUrl) {
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Try exact match first
  let { data, error } = await supabase
    .from('page_schemas')
    .select('schema_json, cache_version')
    .eq('client_id', clientId)
    .eq('page_url', normalizedUrl)
    .single();

  // If no exact match, try with trailing slash
  if (!data) {
    const result = await supabase
      .from('page_schemas')
      .select('schema_json, cache_version')
      .eq('client_id', clientId)
      .eq('page_url', normalizedUrl + '/')
      .single();
    data = result.data;
  }

  // If still no match, return minimal schema
  if (!data) {
    return new Response(JSON.stringify({}), {
      headers: {
        'Content-Type': 'application/ld+json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300' // Short cache for missing schemas
      }
    });
  }

  return new Response(JSON.stringify(data.schema_json), {
    headers: {
      'Content-Type': 'application/ld+json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400', // 24 hour cache
      'ETag': `"${data.cache_version}"`,        // For cache invalidation
      'Vary': 'Origin'
    }
  });
});
