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

## Database Schema (GEARS v3.6)

Core tables:
- **organizations** - Organization configs (id, name, domain, base_url, api_key, schema_version, phase, settings)
- **page_schemas** - JSON-LD schemas per URL (organization_id, page_url, schema_json, content_hash, cache_version, source_mode, page_type, entity_matches, confidence_score, generated_content_id)
- **drift_signals** - Content change tracking (organization_id, page_url, content_hash, drift_detected, drift_type, processed, processed_at)

See [GEARS-DB-SCHEMA.md](GEARS-DB-SCHEMA.md) for complete schema documentation.

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
# Create an organization (use seed scripts for easier setup)
../../scripts/seed-data.sh [project-ref] [service-role-key]

# Or manually create an organization
curl -X POST 'https://[project].supabase.co/rest/v1/organizations' \
  -H "apikey: [anon-key]" \
  -H "Authorization: Bearer [service-role-key]" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"name": "Test Organization", "domain": "example.com", "base_url": "https://example.com"}'

# Add a schema (Admin API - requires API key)
curl -X POST 'https://[project].supabase.co/functions/v1/update-schema' \
  -H "X-API-Key: [organization-api-key]" \
  -H "Content-Type: application/json" \
  -d '{"organization_id": "[uuid]", "page_url": "https://example.com/", "schema_json": {...}}'

# Fetch schema (Public API - uses client_id parameter for backwards compatibility)
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

## GEARS v3.6 Migration Notes

### API Compatibility

**Public APIs (backwards compatible):**
- `schema-loader`, `get-schema`, `collect-signal` continue to accept `client_id` parameter
- Internally mapped to `organization_id` in database queries
- No breaking changes for existing embedded scripts

**Admin APIs (breaking changes):**
- `update-schema` now requires `organization_id` instead of `client_id`
- `get-drift` supports both `organization_id` and `client_id` for backwards compatibility
- Organizations now require `base_url` field (e.g., "https://example.com")

### New Fields

**page_schemas:**
- `source_mode`: 'generation' | 'projection' | 'external'
- `page_type`: Optional schema type classification
- `entity_matches`: Mode B entity matching results
- `confidence_score`: Projection confidence (0.00-1.00)
- `generated_content_id`: FK to generated_content table

**drift_signals:**
- `drift_type`: 'content_change' | 'structure_change' | 'entity_drift'
- `processed_at`: Timestamp when drift was processed

For complete migration details, see [MIGRATION-PLAN.md](MIGRATION-PLAN.md).
