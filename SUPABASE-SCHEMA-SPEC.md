# Supabase Database Schema Specification for GEARS Integration

This document defines the exact database schema that GEARS must follow when writing schema data to Supabase.

**Project:** schema-cache
**Supabase Project ID:** uxkudwzbqijamqhuowly
**Version:** 4.0.0 (GEARS v3.6 Compatible)

---

## Overview

The schema-cache system stores JSON-LD schemas for client websites and tracks content drift. GEARS is responsible for:
1. Creating organization records for new clients
2. Writing generated JSON-LD schemas to the `page_schemas` table
3. Optionally marking drift signals as processed

---

## Table: `organizations`

Stores client/organization configuration and metadata.

### Schema

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  api_key UUID DEFAULT gen_random_uuid(),
  settings JSONB DEFAULT '{}',
  base_url TEXT DEFAULT 'https://example.com',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Column Definitions

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | Yes | `gen_random_uuid()` | Primary key, unique organization identifier |
| `name` | TEXT | Yes | - | Organization/client name (e.g., "Acme Corp") |
| `domain` | TEXT | Yes | - | Primary domain (e.g., "acme.com") |
| `api_key` | UUID | No | `gen_random_uuid()` | API key for authenticated endpoints |
| `settings` | JSONB | No | `{}` | Custom settings (free-form JSON) |
| `base_url` | TEXT | No | `'https://example.com'` | Base URL for the organization's website |
| `created_at` | TIMESTAMPTZ | No | `now()` | Timestamp when record was created |
| `updated_at` | TIMESTAMPTZ | No | `now()` | Timestamp when record was last updated |

### GEARS Write Operations

**Creating a new organization:**
```sql
INSERT INTO organizations (name, domain, base_url, settings)
VALUES (
  'Client Name',
  'example.com',
  'https://example.com',
  '{"industry": "technology", "tier": "enterprise"}'::jsonb
)
RETURNING id, api_key;
```

**Updating an existing organization:**
```sql
UPDATE organizations
SET
  name = 'Updated Name',
  settings = jsonb_set(settings, '{last_sync}', to_jsonb(now())),
  updated_at = now()
WHERE id = '8939ddba-6a96-4bd9-8d7b-b1333c955aeb';
```

### Indexes

```sql
CREATE INDEX idx_organizations_domain ON organizations(domain);
CREATE INDEX idx_organizations_api_key ON organizations(api_key);
```

---

## Table: `page_schemas`

Stores JSON-LD schemas for individual pages/URLs.

### Schema

```sql
CREATE TABLE page_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  schema_json JSONB NOT NULL,
  content_hash TEXT,
  cache_version INTEGER DEFAULT 1,
  source_mode TEXT DEFAULT 'external',
  page_type TEXT,
  entity_matches JSONB,
  confidence_score DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, page_url)
);
```

### Column Definitions

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | Yes | `gen_random_uuid()` | Primary key |
| `organization_id` | UUID | Yes | - | Foreign key to `organizations.id` |
| `page_url` | TEXT | Yes | - | **Normalized URL** (no trailing slash, no query params unless significant) |
| `schema_json` | JSONB | Yes | - | Complete JSON-LD schema object (must include `@context`) |
| `content_hash` | TEXT | No | NULL | Hash of page content at time of schema generation |
| `cache_version` | INTEGER | No | `1` | Increment to invalidate cache (bump when schema changes) |
| `source_mode` | TEXT | No | `'external'` | How schema was created: `'external'`, `'ai_generated'`, `'manual'`, `'hybrid'` |
| `page_type` | TEXT | No | NULL | Page classification: `'product'`, `'article'`, `'service'`, `'homepage'`, `'about'`, etc. |
| `entity_matches` | JSONB | No | NULL | Entities detected on page (array of objects) |
| `confidence_score` | DECIMAL(3,2) | No | NULL | AI confidence in schema accuracy (0.00-1.00) |
| `created_at` | TIMESTAMPTZ | No | `now()` | When schema was first created |
| `updated_at` | TIMESTAMPTZ | No | `now()` | When schema was last updated |

### GEARS Write Operations

**Insert a new schema (or update if exists):**

```sql
INSERT INTO page_schemas (
  organization_id,
  page_url,
  schema_json,
  content_hash,
  cache_version,
  source_mode,
  page_type,
  entity_matches,
  confidence_score
)
VALUES (
  '8939ddba-6a96-4bd9-8d7b-b1333c955aeb',  -- organization_id
  'https://example.com/services/consulting',  -- page_url (normalized!)
  '{
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Consulting Services",
    "provider": {
      "@type": "Organization",
      "name": "Example Corp"
    },
    "description": "Professional consulting services"
  }'::jsonb,  -- schema_json
  'a3f5d9c2e1b4',  -- content_hash (optional)
  1,  -- cache_version
  'ai_generated',  -- source_mode
  'service',  -- page_type
  '[
    {"type": "Organization", "name": "Example Corp", "confidence": 0.95},
    {"type": "Service", "name": "Consulting Services", "confidence": 0.92}
  ]'::jsonb,  -- entity_matches
  0.93  -- confidence_score
)
ON CONFLICT (organization_id, page_url)
DO UPDATE SET
  schema_json = EXCLUDED.schema_json,
  content_hash = EXCLUDED.content_hash,
  cache_version = page_schemas.cache_version + 1,  -- Increment to bust cache
  source_mode = EXCLUDED.source_mode,
  page_type = EXCLUDED.page_type,
  entity_matches = EXCLUDED.entity_matches,
  confidence_score = EXCLUDED.confidence_score,
  updated_at = now()
RETURNING id, cache_version;
```

**Update only the schema (common GEARS operation):**

```sql
UPDATE page_schemas
SET
  schema_json = '{
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Updated Product"
  }'::jsonb,
  cache_version = cache_version + 1,  -- IMPORTANT: Increment to invalidate cache
  confidence_score = 0.88,
  updated_at = now()
WHERE organization_id = '8939ddba-6a96-4bd9-8d7b-b1333c955aeb'
  AND page_url = 'https://example.com/products/widget'
RETURNING id, cache_version;
```

### URL Normalization Rules

**CRITICAL:** GEARS must normalize URLs before writing to ensure consistency:

1. **Remove trailing slashes:** `https://example.com/about/` → `https://example.com/about`
2. **Remove URL fragments:** `https://example.com/page#section` → `https://example.com/page`
3. **Remove query parameters** (unless semantically significant)
4. **Lowercase scheme and domain:** `HTTPS://EXAMPLE.COM` → `https://example.com`
5. **Keep path case-sensitive:** `https://example.com/Products` (keep as-is)

**Examples:**
```
Input:  https://example.com/services/
Output: https://example.com/services

Input:  https://example.com/products/?ref=email
Output: https://example.com/products

Input:  https://example.com/blog/post-1#comments
Output: https://example.com/blog/post-1
```

### Schema JSON Requirements

The `schema_json` field **MUST**:
1. Be valid JSON-LD
2. Include `"@context": "https://schema.org"` (or other valid context)
3. Include `"@type"` property
4. Follow schema.org vocabulary

**Minimum valid schema:**
```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Page Title"
}
```

### Indexes

```sql
CREATE INDEX idx_page_schemas_organization_id ON page_schemas(organization_id);
CREATE INDEX idx_page_schemas_page_url ON page_schemas(page_url);
CREATE INDEX idx_page_schemas_page_type ON page_schemas(page_type);
CREATE INDEX idx_page_schemas_source_mode ON page_schemas(source_mode);
CREATE UNIQUE INDEX idx_page_schemas_org_url ON page_schemas(organization_id, page_url);
```

---

## Table: `drift_signals`

Tracks when page content changes after schema was generated.

### Schema

```sql
CREATE TABLE drift_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  signals JSONB,
  drift_detected BOOLEAN DEFAULT false,
  drift_type TEXT,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Column Definitions

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | Yes | `gen_random_uuid()` | Primary key |
| `organization_id` | UUID | Yes | - | Foreign key to `organizations.id` |
| `page_url` | TEXT | Yes | - | Normalized URL where drift was detected |
| `content_hash` | TEXT | Yes | - | New content hash (different from schema's hash) |
| `signals` | JSONB | No | NULL | Page signals: `{title, h1, meta_description, etc}` |
| `drift_detected` | BOOLEAN | No | `false` | Whether drift was detected (set by system) |
| `drift_type` | TEXT | No | NULL | Type of drift: `'content_change'`, `'structure_change'`, `'entity_change'` |
| `processed` | BOOLEAN | No | `false` | Whether GEARS has processed this drift signal |
| `processed_at` | TIMESTAMPTZ | No | NULL | When drift was processed by GEARS |
| `created_at` | TIMESTAMPTZ | No | `now()` | When drift signal was received |

### GEARS Write Operations

**Mark drift signals as processed after regenerating schema:**

```sql
UPDATE drift_signals
SET
  processed = true,
  processed_at = now()
WHERE organization_id = '8939ddba-6a96-4bd9-8d7b-b1333c955aeb'
  AND page_url = 'https://example.com/services/consulting'
  AND processed = false;
```

**Query unprocessed drift signals for GEARS to handle:**

```sql
SELECT
  id,
  organization_id,
  page_url,
  content_hash,
  signals,
  drift_type,
  created_at
FROM drift_signals
WHERE processed = false
  AND drift_detected = true
ORDER BY created_at ASC
LIMIT 100;
```

### Indexes

```sql
CREATE INDEX idx_drift_signals_organization_id ON drift_signals(organization_id);
CREATE INDEX idx_drift_signals_processed ON drift_signals(processed);
CREATE INDEX idx_drift_signals_drift_detected ON drift_signals(drift_detected);
```

---

## Common GEARS Workflows

### 1. Initial Schema Generation for New Client

```sql
-- Step 1: Create organization
INSERT INTO organizations (name, domain, base_url)
VALUES ('Acme Corp', 'acme.com', 'https://acme.com')
RETURNING id, api_key;
-- Returns: id = 'abc-123...', api_key = 'xyz-789...'

-- Step 2: Generate and insert schemas for multiple pages
INSERT INTO page_schemas (organization_id, page_url, schema_json, source_mode, page_type, confidence_score)
VALUES
  ('abc-123...', 'https://acme.com', '{...homepage schema...}'::jsonb, 'ai_generated', 'homepage', 0.95),
  ('abc-123...', 'https://acme.com/about', '{...about schema...}'::jsonb, 'ai_generated', 'about', 0.92),
  ('abc-123...', 'https://acme.com/products', '{...products schema...}'::jsonb, 'ai_generated', 'service', 0.88);
```

### 2. Update Existing Schema (Schema Regeneration)

```sql
-- Update schema and increment cache_version to invalidate CDN cache
UPDATE page_schemas
SET
  schema_json = '{...new schema...}'::jsonb,
  cache_version = cache_version + 1,  -- Critical: busts cache
  confidence_score = 0.91,
  updated_at = now()
WHERE organization_id = 'abc-123...'
  AND page_url = 'https://acme.com/products'
RETURNING id, cache_version;
```

### 3. Process Drift Signals

```sql
-- Step 1: Get unprocessed drift signals
SELECT id, organization_id, page_url, content_hash, drift_type
FROM drift_signals
WHERE processed = false AND drift_detected = true
LIMIT 50;

-- Step 2: For each drift signal, regenerate schema
UPDATE page_schemas
SET
  schema_json = '{...regenerated schema...}'::jsonb,
  content_hash = 'new-hash-value',
  cache_version = cache_version + 1,
  updated_at = now()
WHERE organization_id = 'abc-123...'
  AND page_url = 'https://acme.com/products';

-- Step 3: Mark drift as processed
UPDATE drift_signals
SET processed = true, processed_at = now()
WHERE id = 'drift-signal-id';
```

---

## Data Validation Rules

### Organizations Table
- `domain` must not include protocol (e.g., `acme.com`, not `https://acme.com`)
- `base_url` must include protocol (e.g., `https://acme.com`)
- `name` must be at least 1 character
- `api_key` is auto-generated but can be regenerated if needed

### Page Schemas Table
- `page_url` must be a valid, normalized URL
- `schema_json` must contain `@context` and `@type` properties
- `cache_version` must be incremented whenever `schema_json` changes
- `confidence_score` must be between 0.00 and 1.00 (if provided)
- `source_mode` must be one of: `'external'`, `'ai_generated'`, `'manual'`, `'hybrid'`

### Drift Signals Table
- `content_hash` should be a short hash (e.g., MD5, SHA-256 truncated)
- `signals` should contain at least: `{title, h1, meta_description, content_hash}`
- `processed` should only be set to `true` after schema has been regenerated

---

## Row-Level Security (RLS)

All tables have RLS enabled. GEARS should use the **service role key** to bypass RLS when writing data.

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://uxkudwzbqijamqhuowly.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY  // Service role key, NOT anon key
)
```

---

## Connection Information

**Supabase Project:**
- URL: `https://uxkudwzbqijamqhuowly.supabase.co`
- Project ID: `uxkudwzbqijamqhuowly`
- Database: PostgreSQL 15

**Authentication:**
- Public endpoints (schema serving): No auth required
- Write operations: Require `X-API-Key` header (organization's `api_key`)
- Direct database access: Require service role key

---

## Example: Complete GEARS Write Flow

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://uxkudwzbqijamqhuowly.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 1. Create or get organization
const { data: org, error: orgError } = await supabase
  .from('organizations')
  .upsert({
    name: 'Acme Corporation',
    domain: 'acme.com',
    base_url: 'https://acme.com'
  }, {
    onConflict: 'domain'
  })
  .select('id, api_key')
  .single()

const orgId = org.id

// 2. Insert/update page schema
const { data: schema, error: schemaError } = await supabase
  .from('page_schemas')
  .upsert({
    organization_id: orgId,
    page_url: 'https://acme.com/services/consulting',  // Normalized!
    schema_json: {
      '@context': 'https://schema.org',
      '@type': 'Service',
      'name': 'Consulting Services',
      'provider': {
        '@type': 'Organization',
        'name': 'Acme Corporation'
      }
    },
    source_mode: 'ai_generated',
    page_type: 'service',
    confidence_score: 0.92,
    entity_matches: [
      { type: 'Organization', name: 'Acme Corporation', confidence: 0.95 },
      { type: 'Service', name: 'Consulting Services', confidence: 0.89 }
    ]
  }, {
    onConflict: 'organization_id,page_url',
    // Increment cache_version on update
    ignoreDuplicates: false
  })
  .select('id, cache_version')
  .single()

console.log('Schema saved:', schema.id, 'Cache version:', schema.cache_version)

// 3. Mark drift as processed (if applicable)
await supabase
  .from('drift_signals')
  .update({ processed: true, processed_at: new Date().toISOString() })
  .eq('organization_id', orgId)
  .eq('page_url', 'https://acme.com/services/consulting')
  .eq('processed', false)
```

---

## Testing Your Integration

Use the test organization already in the database:

**Test Organization:**
- ID: `8939ddba-6a96-4bd9-8d7b-b1333c955aeb`
- Name: Test Client
- Domain: `example.com`
- Base URL: `https://example.com`

**Test by inserting a schema:**
```sql
INSERT INTO page_schemas (organization_id, page_url, schema_json, source_mode, page_type, confidence_score)
VALUES (
  '8939ddba-6a96-4bd9-8d7b-b1333c955aeb',
  'https://example.com/test-gears',
  '{
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Test Article from GEARS",
    "author": {
      "@type": "Organization",
      "name": "GEARS System"
    }
  }'::jsonb,
  'ai_generated',
  'article',
  0.90
)
RETURNING id, cache_version;
```

**Verify it works:**
```bash
curl 'https://schema.coachlou.com/functions/v1/get-schema?client_id=8939ddba-6a96-4bd9-8d7b-b1333c955aeb&url=https://example.com/test-gears'
```

---

## Summary for GEARS

**What GEARS MUST do:**
1. ✅ Normalize URLs before writing (remove trailing slash, fragments, unnecessary query params)
2. ✅ Include `@context` and `@type` in all `schema_json` objects
3. ✅ Increment `cache_version` when updating existing schemas
4. ✅ Set `source_mode = 'ai_generated'` for AI-generated schemas
5. ✅ Set `confidence_score` (0.00-1.00) if available
6. ✅ Use `ON CONFLICT (organization_id, page_url) DO UPDATE` for upsert behavior
7. ✅ Mark drift signals as processed after regenerating schemas

**What GEARS SHOULD do:**
- Set `page_type` for better categorization
- Populate `entity_matches` with detected entities
- Provide `content_hash` for drift detection

**What GEARS must NOT do:**
- ❌ Write invalid JSON to `schema_json`
- ❌ Forget to increment `cache_version` on updates
- ❌ Use non-normalized URLs in `page_url`
- ❌ Include query parameters in `page_url` (unless semantically significant)
