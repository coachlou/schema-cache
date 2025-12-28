# CLAUDE.md

## Project: Schema Injection Service (schema-cache)

A lightweight system for storing and serving JSON-LD schemas to client websites via embeddable JavaScript loader with drift detection.

## Overview

This POC implements:
1. Store JSON-LD schemas for client website pages
2. Serve schemas via JavaScript loader that clients embed (one script tag)
3. Detect when page content changes (drift detection)
4. Provide mechanism to update schemas and invalidate cache

**Not in scope (yet):** Ontology extraction pipeline, AI-powered schema generation, client onboarding flows, admin dashboard.

## Tech Stack

- **Runtime:** Supabase Edge Functions (Deno)
- **Database:** Supabase PostgreSQL
- **Language:** TypeScript
- **Client SDK:** @supabase/supabase-js@2

## Project Structure

```
supabase/
├── migrations/
│   └── 20250101000000_initial_schema.sql
├── functions/
│   ├── schema-loader/index.ts      # Returns JS that clients embed
│   ├── get-schema/index.ts         # Returns JSON-LD for a given URL
│   ├── collect-signal/index.ts     # Receives page content hash for drift
│   ├── update-schema/index.ts      # Upserts schema for a page URL
│   └── get-drift/index.ts          # Returns unprocessed drift signals
└── config.toml
```

## Database Schema

Three main tables:
- **clients** - Client configs (id, name, domain, api_key, settings)
- **page_schemas** - JSON-LD schemas per URL (client_id, page_url, schema_json, content_hash, cache_version)
- **drift_signals** - Content change tracking (client_id, page_url, content_hash, drift_detected, processed)

## Development

### Setup

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your Supabase project
supabase link --project-ref [your-project-ref]
```

### Database Migration

```bash
supabase db push
```

### Deploy Functions

```bash
supabase functions deploy schema-loader
supabase functions deploy get-schema
supabase functions deploy collect-signal
supabase functions deploy update-schema
supabase functions deploy get-drift
```

### Test

```bash
# Create a client
curl -X POST 'https://[project].supabase.co/rest/v1/clients' \
  -H "apikey: [anon-key]" \
  -H "Authorization: Bearer [service-role-key]" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Client", "domain": "example.com"}'

# Add a schema
curl -X POST 'https://[project].supabase.co/functions/v1/update-schema' \
  -H "X-API-Key: [client-api-key]" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "[uuid]", "page_url": "https://example.com/", "schema_json": {...}}'

# Fetch schema
curl 'https://[project].supabase.co/functions/v1/get-schema?client_id=[uuid]&url=https://example.com/'
```

## Edge Functions

| Function | Method | Auth | Purpose |
|----------|--------|------|---------|
| schema-loader | GET | None | Returns JS for client embed |
| get-schema | GET | None | Returns JSON-LD schema |
| collect-signal | POST | None | Receives drift detection data |
| update-schema | POST | X-API-Key | Create/update schemas |
| get-drift | GET | X-API-Key | Check pages with content changes |

## Key Implementation Notes

- **URL Normalization:** Always strip trailing slashes for consistency
- **CORS:** All client-facing endpoints need `Access-Control-Allow-Origin: *`
- **Error Handling:** Loader fails silently—never break client's site
- **Caching:** Use `Cache-Control` headers; `cache_version` enables cache busting
- **Performance Target:** <200ms p95 for schema serving

## Client Integration

Clients add one line to their `<head>`:
```html
<script src="https://[project].supabase.co/functions/v1/schema-loader?client_id=[uuid]"></script>
```

## Security

- API key auth for write operations (X-API-Key header)
- RLS enabled on all tables
- Service role bypasses RLS for edge functions
- Public read access for schemas (needed for loader)
