// supabase/functions/schema-loader/index.ts
// Returns JavaScript that clients embed. This JS fetches and injects the schema.

const LOADER_SCRIPT = `
(function() {
  var clientId = '{{CLIENT_ID}}';
  var baseUrl = '{{BASE_URL}}';
  var overrideUrl = '{{OVERRIDE_URL}}';
  var currentUrl = overrideUrl || window.location.href.split('?')[0].split('#')[0]; // Clean URL

  // Fetch and inject schema
  function loadSchema() {
    var url = baseUrl + '/get-schema?client_id=' + clientId + '&url=' + encodeURIComponent(currentUrl);

    fetch(url)
      .then(function(r) {
        if (!r.ok) throw new Error('Schema not found');
        return r.json();
      })
      .then(function(schema) {
        if (schema && schema['@context']) {
          var el = document.createElement('script');
          el.type = 'application/ld+json';
          el.textContent = JSON.stringify(schema);
          document.head.appendChild(el);
        }
      })
      .catch(function(e) {
        console.debug('[Schema Loader] No schema for this page');
      });
  }

  // Collect page signals for drift detection
  function collectSignals() {
    var signals = {
      title: document.title || '',
      h1: (document.querySelector('h1') || {}).innerText || '',
      meta_description: ((document.querySelector('meta[name="description"]') || {}).content) || '',
      content_hash: simpleHash(document.body ? document.body.innerText.substring(0, 2000) : '')
    };

    fetch(baseUrl + '/collect-signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        url: currentUrl,
        signals: signals
      })
    }).catch(function() {}); // Silent fail - non-critical
  }

  function simpleHash(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  // Execute
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      loadSchema();
      setTimeout(collectSignals, 1000); // Delay signal collection
    });
  } else {
    loadSchema();
    setTimeout(collectSignals, 1000);
  }
})();
`;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Keep client_id in public API for backwards compatibility
  const clientId = url.searchParams.get('client_id');
  // Optional: page_url parameter for testing/override
  const pageUrl = url.searchParams.get('page_url') || '';
  // Internally, this maps to organization_id in the database
  const organizationId = clientId;

  if (!organizationId) {
    return new Response('// Missing client_id parameter', {
      status: 400,
      headers: { 'Content-Type': 'application/javascript' }
    });
  }

  // Validate organization exists (optional but recommended)
  // For POC, we skip this check

  // Always use https for the base URL (edge functions may report http internally)
  const baseUrl = `https://${url.host}/functions/v1`;

  const script = LOADER_SCRIPT
    .replace('{{CLIENT_ID}}', clientId)
    .replace('{{BASE_URL}}', baseUrl)
    .replace('{{OVERRIDE_URL}}', pageUrl);

  return new Response(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=86400', // Cache loader for 24 hours
      'Access-Control-Allow-Origin': '*'
    }
  });
});
