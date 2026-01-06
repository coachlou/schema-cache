# Schema Injection Service: Proof of Concept

## Technical Specification for Implementation

---

## 1. Overview

### What We're Building

A lightweight system that:
1. Stores JSON-LD schemas for client website pages
2. Serves schemas via a JavaScript loader that clients embed
3. Detects when page content changes (drift detection)
4. Provides a mechanism to update schemas and invalidate cache

### What We're NOT Building (Yet)

- Ontology extraction pipeline
- AI-powered schema generation
- Client onboarding flows
- Admin dashboard

### Success Criteria

- [ ] Client can embed one script tag and receive JSON-LD schema injection
- [ ] Schemas are cached and served fast (<200ms p95)
- [ ] System detects when page content changes
- [ ] Schema can be updated and cache invalidated via API call

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT WEBSITE                          │
│                                                                 │
│  <script src="https://[project].supabase.co/functions/v1/      │
│          schema-loader?client_id=xxx"></script>                 │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTIONS                      │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │ schema-loader   │  │ get-schema      │  │ collect-signal │  │
│  │                 │  │                 │  │                │  │
│  │ Returns JS that │  │ Returns JSON-LD │  │ Receives page  │  │
│  │ fetches schema  │  │ for a given URL │  │ content hash   │  │
│  │ and injects it  │  │                 │  │ for drift      │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │ update-schema   │  │ purge-cache     │                      │
│  │                 │  │                 │                      │
│  │ Upserts schema  │  │ Marks schema    │                      │
│  │ for a page URL  │  │ cache as stale  │                      │
│  └─────────────────┘  └─────────────────┘                      │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE POSTGRES                          │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ clients     │  │ page_schemas│  │ drift_signals           │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### Table: `clients`

Stores client configurations.

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL,                    -- e.g., "example.com"
  api_key TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for lookup by domain
CREATE INDEX idx_clients_domain ON clients(domain);

-- Example insert:
-- INSERT INTO clients (name, domain) VALUES ('Acme Corp', 'acme.com');
```

### Table: `page_schemas`

Stores JSON-LD schemas per page URL.

```sql
CREATE TABLE page_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,                  -- Full URL: https://acme.com/services/
  url_pattern TEXT,                        -- Optional glob: /services/*
  schema_json JSONB NOT NULL,              -- The JSON-LD schema
  content_hash TEXT,                       -- Hash of page content when schema was generated
  cache_version INTEGER DEFAULT 1,         -- Increment to invalidate cache
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(client_id, page_url)
);

-- Indexes for fast lookup
CREATE INDEX idx_page_schemas_client_url ON page_schemas(client_id, page_url);
CREATE INDEX idx_page_schemas_client_pattern ON page_schemas(client_id, url_pattern);
```

### Table: `drift_signals`

Stores content change signals for drift detection.

```sql
CREATE TABLE drift_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  content_hash TEXT NOT NULL,              -- Current hash from page
  previous_hash TEXT,                      -- Hash we had stored
  drift_detected BOOLEAN DEFAULT false,    -- True if hashes don't match
  processed BOOLEAN DEFAULT false,         -- True once we've handled this
  signals JSONB,                           -- Additional metadata (title, h1, etc.)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for unprocessed drift signals
CREATE INDEX idx_drift_unprocessed ON drift_signals(client_id, drift_detected, processed) 
  WHERE drift_detected = true AND processed = false;
```

### RLS Policies

```sql
-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_signals ENABLE ROW LEVEL SECURITY;

-- For Edge Functions using service role, RLS is bypassed
-- These policies are for any future direct access

-- Public can read schemas (needed for the loader)
CREATE POLICY "Public can read page_schemas" ON page_schemas
  FOR SELECT USING (true);

-- Only service role can write (enforced by Edge Function auth)
```

---

## 4. Edge Functions

### 4.1 `schema-loader`

**Purpose:** Returns JavaScript that clients embed. This JS fetches and injects the schema.

**Route:** `GET /functions/v1/schema-loader`

**Query Params:**
- `client_id` (required): UUID of the client

**Response:** JavaScript file (content-type: application/javascript)

**Implementation:**

```typescript
// supabase/functions/schema-loader/index.ts

const LOADER_SCRIPT = `
(function() {
  var clientId = '{{CLIENT_ID}}';
  var baseUrl = '{{BASE_URL}}';
  var currentUrl = window.location.href.split('?')[0].split('#')[0]; // Clean URL
  
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
  const clientId = url.searchParams.get('client_id');
  
  if (!clientId) {
    return new Response('// Missing client_id parameter', {
      status: 400,
      headers: { 'Content-Type': 'application/javascript' }
    });
  }
  
  // Validate client exists (optional but recommended)
  // For POC, we skip this check
  
  const baseUrl = `${url.origin}/functions/v1`;
  
  const script = LOADER_SCRIPT
    .replace('{{CLIENT_ID}}', clientId)
    .replace('{{BASE_URL}}', baseUrl);
  
  return new Response(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=86400', // Cache loader for 24 hours
      'Access-Control-Allow-Origin': '*'
    }
  });
});
```

---

### 4.2 `get-schema`

**Purpose:** Returns the JSON-LD schema for a specific page URL.

**Route:** `GET /functions/v1/get-schema`

**Query Params:**
- `client_id` (required): UUID of the client
- `url` (required): Full page URL to get schema for

**Response:** JSON-LD schema or empty object

**Implementation:**

```typescript
// supabase/functions/get-schema/index.ts

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
```

---

### 4.3 `collect-signal`

**Purpose:** Receives page content signals for drift detection.

**Route:** `POST /functions/v1/collect-signal`

**Request Body:**
```json
{
  "client_id": "uuid",
  "url": "https://example.com/page/",
  "signals": {
    "title": "Page Title",
    "h1": "Main Heading",
    "meta_description": "...",
    "content_hash": "abc123"
  }
}
```

**Response:** `{ "received": true, "drift_detected": boolean }`

**Implementation:**

```typescript
// supabase/functions/collect-signal/index.ts

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
```

---

### 4.4 `update-schema`

**Purpose:** Create or update a schema for a page URL. Used by the skill or admin.

**Route:** `POST /functions/v1/update-schema`

**Auth:** Requires client API key in header

**Request Headers:**
- `X-API-Key`: Client's API key

**Request Body:**
```json
{
  "client_id": "uuid",
  "page_url": "https://example.com/services/",
  "schema_json": { "@context": "https://schema.org", ... },
  "content_hash": "optional-hash-of-current-content"
}
```

**Response:** `{ "success": true, "cache_version": 2 }`

**Implementation:**

```typescript
// supabase/functions/update-schema/index.ts

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
```

---

### 4.5 `get-drift`

**Purpose:** Returns unprocessed drift signals for a client. Used to check what pages need schema updates.

**Route:** `GET /functions/v1/get-drift`

**Auth:** Requires client API key in header

**Query Params:**
- `client_id` (required)

**Response:**
```json
{
  "drift_count": 3,
  "pages": [
    {
      "page_url": "https://example.com/about/",
      "current_hash": "abc123",
      "previous_hash": "def456",
      "first_detected": "2025-01-15T...",
      "signals": { "title": "...", "h1": "..." }
    }
  ]
}
```

**Implementation:**

```typescript
// supabase/functions/get-drift/index.ts

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
```

---

## 5. Client Integration

### How Clients Install

**Step 1:** You create a client record and give them their client_id.

**Step 2:** Client adds one line to their site's `<head>` (or via GTM):

```html
<script src="https://[your-project].supabase.co/functions/v1/schema-loader?client_id=[their-uuid]"></script>
```

**That's it.** The script handles everything else automatically.

---

## 6. Testing the System

### Manual Test Flow

```bash
# 1. Create a client
curl -X POST 'https://[project].supabase.co/rest/v1/clients' \
  -H "apikey: [anon-key]" \
  -H "Authorization: Bearer [service-role-key]" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Client", "domain": "example.com"}'

# Response includes: id, api_key

# 2. Add a schema for a page
curl -X POST 'https://[project].supabase.co/functions/v1/update-schema' \
  -H "X-API-Key: [client-api-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "[client-uuid]",
    "page_url": "https://example.com/services/",
    "schema_json": {
      "@context": "https://schema.org",
      "@type": "Service",
      "name": "Consulting Services",
      "provider": {
        "@type": "Organization",
        "name": "Example Corp"
      }
    }
  }'

# 3. Fetch the schema (what the loader does)
curl 'https://[project].supabase.co/functions/v1/get-schema?client_id=[uuid]&url=https://example.com/services/'

# 4. Test the loader script
curl 'https://[project].supabase.co/functions/v1/schema-loader?client_id=[uuid]'

# 5. Simulate a signal (what the loader sends)
curl -X POST 'https://[project].supabase.co/functions/v1/collect-signal' \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "[uuid]",
    "url": "https://example.com/services/",
    "signals": {
      "title": "Our Services",
      "h1": "Consulting Services",
      "content_hash": "abc123"
    }
  }'

# 6. Check for drift
curl 'https://[project].supabase.co/functions/v1/get-drift?client_id=[uuid]' \
  -H "X-API-Key: [client-api-key]"
```

---

## 7. File Structure

```
supabase/
├── migrations/
│   └── 20250101000000_initial_schema.sql
├── functions/
│   ├── schema-loader/
│   │   └── index.ts
│   ├── get-schema/
│   │   └── index.ts
│   ├── collect-signal/
│   │   └── index.ts
│   ├── update-schema/
│   │   └── index.ts
│   └── get-drift/
│       └── index.ts
└── config.toml
```

---

## 8. Deployment Steps

1. **Create Supabase Project**
   - Go to supabase.com, create new project
   - Note the project URL and keys

2. **Run Migration**
   ```bash
   supabase db push
   ```

3. **Deploy Edge Functions**
   ```bash
   supabase functions deploy schema-loader
   supabase functions deploy get-schema
   supabase functions deploy collect-signal
   supabase functions deploy update-schema
   supabase functions deploy get-drift
   ```

4. **Test**
   - Create a test client
   - Add a test schema
   - Verify loader returns correct JS
   - Verify schema injection works on a test page

---

## 9. Future Enhancements (Out of Scope for POC)

- [ ] CDN caching layer (Cloudflare in front)
- [ ] Batch schema updates
- [ ] Webhook for CMS integrations
- [ ] Admin dashboard
- [ ] Schema validation before storage
- [ ] URL pattern matching (wildcards)
- [ ] Multi-schema per page support

---

## 10. Notes for Implementation

### Key Points

1. **URL Normalization**: Always strip trailing slashes for consistency when storing/querying.

2. **CORS**: All client-facing endpoints need `Access-Control-Allow-Origin: *` headers.

3. **Error Handling**: Loader should fail silently—never break the client's site.

4. **Caching**: Use `Cache-Control` headers aggressively. The `cache_version` field enables cache busting.

5. **Security**: API key auth is simple for POC. For production, consider JWT or stricter validation.

### Supabase Edge Function Notes

- Functions use Deno runtime
- Import Supabase client from esm.sh
- Environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` are auto-available
- Deploy with: `supabase functions deploy [function-name]`

---

## Summary

This POC implements the minimal viable schema injection service:

| Component | Purpose |
|-----------|---------|
| `clients` table | Store client configs and API keys |
| `page_schemas` table | Store JSON-LD schemas per URL |
| `drift_signals` table | Track content changes |
| `schema-loader` function | JS that clients embed |
| `get-schema` function | Serve schemas with caching |
| `collect-signal` function | Receive drift detection data |
| `update-schema` function | Create/update schemas |
| `get-drift` function | Check what pages have changed |

Client effort: **One line of code.**
Your control: **Complete.**