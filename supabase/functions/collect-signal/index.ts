// supabase/functions/collect-signal/index.ts
// Receives page content signals for drift detection.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const { client_id, url, signals } = body;

  if (!client_id || !url || !signals?.content_hash) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const normalizedUrl = url.replace(/\/+$/, '');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get current stored hash for this page
  const { data: existingSchema } = await supabase
    .from('page_schemas')
    .select('content_hash')
    .eq('client_id', client_id)
    .eq('page_url', normalizedUrl)
    .single();

  const previousHash = existingSchema?.content_hash || null;
  const driftDetected = previousHash !== null && previousHash !== signals.content_hash;

  // Store the signal
  await supabase.from('drift_signals').insert({
    client_id,
    page_url: normalizedUrl,
    content_hash: signals.content_hash,
    previous_hash: previousHash,
    drift_detected: driftDetected,
    signals: signals
  });

  return new Response(JSON.stringify({
    received: true,
    drift_detected: driftDetected
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
});
