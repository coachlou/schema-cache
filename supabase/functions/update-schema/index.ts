// supabase/functions/update-schema/index.ts
// Create or update a schema for a page URL. Used by the skill or admin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = req.headers.get('X-API-Key');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing API key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { client_id, page_url, schema_json, content_hash } = body;

  if (!client_id || !page_url || !schema_json) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Verify API key belongs to this client
  const { data: client } = await supabase
    .from('clients')
    .select('id, api_key')
    .eq('id', client_id)
    .single();

  if (!client || client.api_key !== apiKey) {
    return new Response(JSON.stringify({ error: 'Invalid API key' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const normalizedUrl = page_url.replace(/\/+$/, '');

  // Check if schema exists
  const { data: existing } = await supabase
    .from('page_schemas')
    .select('id, cache_version')
    .eq('client_id', client_id)
    .eq('page_url', normalizedUrl)
    .single();

  let newCacheVersion = 1;

  if (existing) {
    // Update existing
    newCacheVersion = (existing.cache_version || 1) + 1;
    await supabase
      .from('page_schemas')
      .update({
        schema_json,
        content_hash: content_hash || null,
        cache_version: newCacheVersion,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    // Insert new
    await supabase
      .from('page_schemas')
      .insert({
        client_id,
        page_url: normalizedUrl,
        schema_json,
        content_hash: content_hash || null,
        cache_version: 1
      });
  }

  // Mark any drift signals for this URL as processed
  await supabase
    .from('drift_signals')
    .update({ processed: true })
    .eq('client_id', client_id)
    .eq('page_url', normalizedUrl)
    .eq('processed', false);

  return new Response(JSON.stringify({
    success: true,
    cache_version: newCacheVersion
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
