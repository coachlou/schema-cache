// supabase/functions/get-drift/index.ts
// Returns unprocessed drift signals for a client. Used to check what pages need schema updates.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const clientId = url.searchParams.get('client_id');
  const apiKey = req.headers.get('X-API-Key');

  if (!clientId || !apiKey) {
    return new Response(JSON.stringify({ error: 'Missing client_id or API key' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Verify API key
  const { data: client } = await supabase
    .from('clients')
    .select('id, api_key')
    .eq('id', clientId)
    .single();

  if (!client || client.api_key !== apiKey) {
    return new Response(JSON.stringify({ error: 'Invalid API key' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get unprocessed drift signals, grouped by URL
  const { data: driftSignals } = await supabase
    .from('drift_signals')
    .select('page_url, content_hash, previous_hash, signals, created_at')
    .eq('client_id', clientId)
    .eq('drift_detected', true)
    .eq('processed', false)
    .order('created_at', { ascending: false });

  // Deduplicate by URL, keeping most recent
  const byUrl = new Map();
  for (const signal of driftSignals || []) {
    if (!byUrl.has(signal.page_url)) {
      byUrl.set(signal.page_url, {
        page_url: signal.page_url,
        current_hash: signal.content_hash,
        previous_hash: signal.previous_hash,
        first_detected: signal.created_at,
        signals: signal.signals
      });
    }
  }

  const pages = Array.from(byUrl.values());

  return new Response(JSON.stringify({
    drift_count: pages.length,
    pages
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
