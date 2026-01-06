# Schema-Cache to GEARS v3.6 Migration Plan

**Project:** Schema Injection Service
**Target:** GEARS v3.6 Database Compatibility
**Status:** In Progress
**Last Updated:** 2025-12-31

---

## Executive Summary

This document provides a step-by-step migration plan to convert the schema-cache codebase from the current `clients`-based schema to GEARS v3.6 `organizations`-based schema. The migration maintains backwards compatibility for public-facing APIs while updating internal database structures.

**Key Changes:**
- Table rename: `clients` → `organizations`
- Column rename: `client_id` → `organization_id` (all tables)
- New required field: `organizations.base_url`
- New optional fields on `page_schemas` and `drift_signals`
- Updated type definitions for GEARS compatibility

---

## Migration Phases

### Phase 1: Database Schema Migration
### Phase 2: Type Definitions
### Phase 3: Edge Functions
### Phase 4: Utility Scripts
### Phase 5: Documentation
### Phase 6: Testing & Validation
### Phase 7: Deployment

---

## Phase 1: Database Schema Migration

**Objective:** Create migration SQL to update database structure while preserving data.

### 1.1 Create New Migration File

- [ ] Create file: `../../supabase/migrations/20250101000001_migrate_to_gears.sql`

**Contents:**

```sql
-- ============================================
-- GEARS v3.6 Schema Migration
-- Migrates from clients-based to organizations-based schema
-- ============================================

-- Step 1: Rename clients table to organizations
ALTER TABLE clients RENAME TO organizations;

-- Step 2: Add new required column with temporary default
ALTER TABLE organizations ADD COLUMN base_url TEXT DEFAULT 'https://example.com';
ALTER TABLE organizations ADD COLUMN schema_version TEXT DEFAULT 'GEARS_v3.6';
ALTER TABLE organizations ADD COLUMN phase TEXT DEFAULT 'Phase_1_MVP';

-- Step 3: Backfill base_url from domain (customize this query for real data)
UPDATE organizations SET base_url = 'https://' || domain WHERE base_url = 'https://example.com';

-- Step 4: Make base_url NOT NULL after backfilling
ALTER TABLE organizations ALTER COLUMN base_url SET NOT NULL;
ALTER TABLE organizations ALTER COLUMN base_url DROP DEFAULT;

-- Step 5: Update page_schemas - rename FK column
ALTER TABLE page_schemas RENAME COLUMN client_id TO organization_id;

-- Step 6: Add new columns to page_schemas
ALTER TABLE page_schemas ADD COLUMN generated_content_id UUID;
ALTER TABLE page_schemas ADD COLUMN source_mode TEXT DEFAULT 'external';
ALTER TABLE page_schemas ADD COLUMN page_type TEXT;
ALTER TABLE page_schemas ADD COLUMN entity_matches JSONB;
ALTER TABLE page_schemas ADD COLUMN confidence_score NUMERIC(3,2);

-- Step 7: Update drift_signals - rename FK column
ALTER TABLE drift_signals RENAME COLUMN client_id TO organization_id;

-- Step 8: Add new columns to drift_signals
ALTER TABLE drift_signals ADD COLUMN drift_type TEXT;
ALTER TABLE drift_signals ADD COLUMN processed_at TIMESTAMPTZ;

-- Step 9: Update RLS policy names
DROP POLICY IF EXISTS "Public can read clients" ON organizations;
CREATE POLICY "Public can read organizations" ON organizations
  FOR SELECT USING (true);

-- Step 10: Verify indexes (PostgreSQL auto-updates most, but check performance)
-- Existing indexes on renamed columns should continue to work
-- Index names can be manually renamed for clarity:
ALTER INDEX IF EXISTS idx_clients_domain RENAME TO idx_organizations_domain;
```

### 1.2 Validation Checklist

- [ ] Review migration SQL for syntax errors
- [ ] Test migration on local Supabase instance
- [ ] Verify all existing data preserved after migration
- [ ] Confirm indexes still exist and perform correctly
- [ ] Verify RLS policies updated correctly

---

## Phase 2: Type Definitions

**Objective:** Create TypeScript type definitions matching GEARS v3.6 schema.

### 2.1 Create Type Definition File

- [ ] Create file: `../../types/database.ts`
- [ ] Copy types from `GEARS-TYPESCRIPTS-TYPES.md`

**Priority Interfaces (Phase 1):**

```typescript
// Core entities used by schema-cache
export interface Organization {
  id: string;
  name: string;
  domain: string;
  base_url: string;  // NEW - required
  schema_version: string;
  phase: string;
  api_key: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PageSchema {
  id: string;
  organization_id: string;  // renamed from client_id
  page_url: string;
  url_pattern: string | null;
  schema_json: JsonLdGraph;
  generated_content_id: string | null;  // NEW
  source_mode: SourceMode;  // NEW
  content_hash: string | null;
  cache_version: number;
  page_type: string | null;  // NEW
  entity_matches: EntityMatch[] | null;  // NEW
  confidence_score: number | null;  // NEW
  created_at: string;
  updated_at: string;
}

export type SourceMode = 'generation' | 'projection' | 'external';

export interface DriftSignal {
  id: string;
  organization_id: string;  // renamed from client_id
  page_url: string;
  content_hash: string;
  previous_hash: string | null;
  drift_detected: boolean;
  drift_type: DriftType | null;  // NEW
  processed: boolean;
  processed_at: string | null;  // NEW
  signals: DriftSignalMetadata | null;
  created_at: string;
}

export type DriftType = 'content_change' | 'structure_change' | 'entity_drift';

export interface DriftSignalMetadata {
  title?: string;
  h1?: string;
  word_count?: number;
  word_count_delta?: number;
  [key: string]: unknown;
}

// JSON-LD types
export interface JsonLdGraph {
  '@context': string | Record<string, unknown>;
  '@graph': JsonLdNode[];
}

export interface JsonLdNode {
  '@type': string | string[];
  '@id': string;
  [key: string]: unknown;
}

export interface EntityMatch {
  candidate_term: string;
  matched_entity_id: string;
  entity_type: 'glossary_term' | 'psych_node';
  match_type: 'exact' | 'alias' | 'fuzzy';
  confidence_score: number;
  schema_id: string;
}
```

### 2.2 Type Definition Checklist

- [ ] Create `../../types/database.ts` with core interfaces
- [ ] Add `Organization` interface
- [ ] Add `PageSchema` interface with new fields
- [ ] Add `DriftSignal` interface with new fields
- [ ] Add supporting types (`SourceMode`, `DriftType`, etc.)
- [ ] Add JSON-LD type definitions
- [ ] Export all types properly

---

## Phase 3: Edge Functions Updates

**Objective:** Update all Supabase Edge Functions to use new schema.

### 3.1 Update `collect-signal/index.ts`

**File:** `../../supabase/functions/collect-signal/index.ts`

**Changes:**

- [ ] Line 35: Rename `client_id` → `organization_id` in destructuring
- [ ] Line 37: Update validation condition variable name
- [ ] Line 56-60: Update query `.eq('client_id', client_id)` → `.eq('organization_id', organization_id)`
- [ ] Line 66-73: Update insert `{ client_id, ... }` → `{ organization_id, ... }`
- [ ] Add import for types at top of file (optional but recommended)

**Specific Code Changes:**

```typescript
// OLD (Line 35-37)
const { client_id, url, signals } = body;
if (!client_id || !url || !signals?.content_hash) {

// NEW
const { organization_id, url, signals } = body;
if (!organization_id || !url || !signals?.content_hash) {
```

```typescript
// OLD (Line 56-60)
const { data: existing } = await supabase
  .from('page_schemas')
  .select('content_hash')
  .eq('client_id', client_id)
  .eq('page_url', normalizedUrl)
  .single();

// NEW
const { data: existing } = await supabase
  .from('page_schemas')
  .select('content_hash')
  .eq('organization_id', organization_id)
  .eq('page_url', normalizedUrl)
  .single();
```

```typescript
// OLD (Line 66-73)
const { error: insertError } = await supabase
  .from('drift_signals')
  .insert({
    client_id,
    page_url: normalizedUrl,
    content_hash: signals.content_hash,
    previous_hash: existing?.content_hash || null,
    drift_detected,
    signals,
  });

// NEW
const { error: insertError } = await supabase
  .from('drift_signals')
  .insert({
    organization_id,
    page_url: normalizedUrl,
    content_hash: signals.content_hash,
    previous_hash: existing?.content_hash || null,
    drift_detected,
    drift_type: drift_detected ? 'content_change' : null,  // NEW
    signals,
  });
```

**Note:** Public API still accepts `client_id` in POST body for backwards compatibility. We map it internally to `organization_id`.

- [ ] Consider: Add API mapping layer to accept both `client_id` and `organization_id`

---

### 3.2 Update `update-schema/index.ts`

**File:** `../../supabase/functions/update-schema/index.ts`

**Changes:**

- [ ] Line 29: Rename `client_id` → `organization_id` in destructuring
- [ ] Line 31: Update validation variable name
- [ ] Line 44-48: Update query from `'clients'` → `'organizations'`
- [ ] Line 50: Rename variable `client` → `organization`
- [ ] Line 61-65: Update `.eq('client_id', ...)` → `.eq('organization_id', ...)`
- [ ] Line 73-80: Update UPDATE query, add new fields
- [ ] Line 84-91: Update INSERT query, add new fields
- [ ] Line 96-100: Update drift_signals UPDATE query

**Specific Code Changes:**

```typescript
// OLD (Line 29-31)
const { client_id, page_url, schema_json, content_hash } = body;
if (!client_id || !page_url || !schema_json) {

// NEW
const { organization_id, page_url, schema_json, content_hash } = body;
if (!organization_id || !page_url || !schema_json) {
```

```typescript
// OLD (Line 44-50)
const { data: client } = await supabase
  .from('clients')
  .select('id, api_key')
  .eq('id', client_id)
  .single();

if (!client || client.api_key !== apiKey) {

// NEW
const { data: organization } = await supabase
  .from('organizations')
  .select('id, api_key')
  .eq('id', organization_id)
  .single();

if (!organization || organization.api_key !== apiKey) {
```

```typescript
// OLD (Line 84-91)
const { error: insertError } = await supabase
  .from('page_schemas')
  .insert({
    client_id,
    page_url: normalizedUrl,
    schema_json,
    content_hash,
    cache_version: 1,
  });

// NEW
const { error: insertError } = await supabase
  .from('page_schemas')
  .insert({
    organization_id,
    page_url: normalizedUrl,
    schema_json,
    content_hash,
    cache_version: 1,
    source_mode: 'external',  // NEW - or 'projection' if Mode B
    page_type: null,  // NEW - optional, could infer from schema
    entity_matches: null,  // NEW - for Mode B matching
    confidence_score: null,  // NEW - for Mode B confidence
  });
```

---

### 3.3 Update `get-drift/index.ts`

**File:** `../../supabase/functions/get-drift/index.ts`

**Changes:**

- [ ] Line 8: Rename `clientId` → `organizationId`
- [ ] Line 12: Update error message
- [ ] Line 24-28: Update query from `'clients'` → `'organizations'`
- [ ] Line 30: Rename variable `client` → `organization`
- [ ] Line 38-44: Update `.eq('client_id', ...)` → `.eq('organization_id', ...)`

**Specific Code Changes:**

```typescript
// OLD (Line 8-12)
const clientId = url.searchParams.get('client_id');
const apiKey = request.headers.get('X-API-Key');

if (!clientId || !apiKey) {
  return new Response(JSON.stringify({ error: 'Missing client_id or API key' }), {

// NEW
const organizationId = url.searchParams.get('organization_id');  // Note: Changed param name (BREAKING)
const apiKey = request.headers.get('X-API-Key');

if (!organizationId || !apiKey) {
  return new Response(JSON.stringify({ error: 'Missing organization_id or API key' }), {
```

**Alternative (Backwards Compatible):**

```typescript
// Accept both old and new parameter names
const organizationId = url.searchParams.get('organization_id') || url.searchParams.get('client_id');
const apiKey = request.headers.get('X-API-Key');

if (!organizationId || !apiKey) {
  return new Response(JSON.stringify({ error: 'Missing organization_id or API key' }), {
```

```typescript
// OLD (Line 24-30)
const { data: client } = await supabase
  .from('clients')
  .select('id, api_key')
  .eq('id', clientId)
  .single();

if (!client || client.api_key !== apiKey) {

// NEW
const { data: organization } = await supabase
  .from('organizations')
  .select('id, api_key')
  .eq('id', organizationId)
  .single();

if (!organization || organization.api_key !== apiKey) {
```

```typescript
// OLD (Line 38-44)
const { data: signals } = await supabase
  .from('drift_signals')
  .select('*')
  .eq('client_id', clientId)
  .eq('drift_detected', true)
  .eq('processed', false)
  .order('created_at', { ascending: false });

// NEW
const { data: signals } = await supabase
  .from('drift_signals')
  .select('*')
  .eq('organization_id', organizationId)
  .eq('drift_detected', true)
  .eq('processed', false)
  .order('created_at', { ascending: false });
```

**Decision Point:**

- [ ] **Breaking Change:** Update query param to `organization_id` (requires admin tool updates)
- [ ] **OR** Maintain backwards compatibility by accepting both param names

---

### 3.4 Update `get-schema/index.ts`

**File:** `../../supabase/functions/get-schema/index.ts`

**Changes:**

- [ ] Line 18: Rename `clientId` → `organizationId`
- [ ] Line 22: Update error message
- [ ] Line 38: Update REST API URL parameter `client_id=eq.` → `organization_id=eq.`
- [ ] Line 52: Update fallback REST API URL parameter

**Specific Code Changes:**

```typescript
// OLD (Line 18-22)
const clientId = url.searchParams.get('client_id');
const requestedUrl = url.searchParams.get('url');

if (!clientId || !requestedUrl) {
  return new Response(JSON.stringify({ error: 'Missing client_id or url' }), {

// NEW (Keep client_id for public API backwards compatibility)
const organizationId = url.searchParams.get('client_id');  // Keep param name for public API
const requestedUrl = url.searchParams.get('url');

if (!organizationId || !requestedUrl) {
  return new Response(JSON.stringify({ error: 'Missing client_id or url' }), {
```

```typescript
// OLD (Line 38)
const apiUrl = `${supabaseUrl}/rest/v1/page_schemas?client_id=eq.${encodeURIComponent(clientId)}&page_url=eq.${encodeURIComponent(normalizedUrl)}&select=schema_json,cache_version`;

// NEW
const apiUrl = `${supabaseUrl}/rest/v1/page_schemas?organization_id=eq.${encodeURIComponent(organizationId)}&page_url=eq.${encodeURIComponent(normalizedUrl)}&select=schema_json,cache_version`;
```

```typescript
// OLD (Line 52)
const fallbackUrl = `${supabaseUrl}/rest/v1/page_schemas?client_id=eq.${encodeURIComponent(clientId)}&page_url=eq.${encodeURIComponent(normalizedUrl + '/')}&select=schema_json,cache_version`;

// NEW
const fallbackUrl = `${supabaseUrl}/rest/v1/page_schemas?organization_id=eq.${encodeURIComponent(organizationId)}&page_url=eq.${encodeURIComponent(normalizedUrl + '/')}&select=schema_json,cache_version`;
```

**Important:** This function uses direct REST API calls for performance. The column name in the URL must match the database column exactly.

**Decision:**

- [ ] Keep public API parameter as `client_id` for backwards compatibility
- [ ] Map internally to `organizationId` variable
- [ ] Use `organization_id` in database queries (column name)

---

### 3.5 Update `schema-loader/index.ts`

**File:** `../../supabase/functions/schema-loader/index.ts`

**Changes:**

- [ ] Line 77: Keep `client_id` parameter (public API)
- [ ] Update internal variable mapping

**Specific Code Changes:**

```typescript
// OLD (Line 77-80)
const clientId = url.searchParams.get('client_id');

if (!clientId) {
  return new Response('// Missing client_id parameter', {

// NEW (Keep public API parameter, map internally)
const organizationId = url.searchParams.get('client_id');  // Keep 'client_id' in public API

if (!organizationId) {
  return new Response('// Missing client_id parameter', {  // Keep error message
```

**Note:** The embedded JavaScript (lines 6-70) uses `client_id` throughout. This is client-facing code and should maintain backwards compatibility. No changes needed to the template.

---

### 3.6 Edge Functions Checklist

- [ ] Update `collect-signal/index.ts` - all variable and query changes
- [ ] Update `update-schema/index.ts` - all variable and query changes
- [ ] Update `get-drift/index.ts` - all variable and query changes
- [ ] Update `get-schema/index.ts` - REST API URL parameters
- [ ] Update `schema-loader/index.ts` - internal variable mapping only
- [ ] Test each function locally with `supabase functions serve`
- [ ] Verify backwards compatibility for public APIs

---

## Phase 4: Utility Scripts Updates

**Objective:** Update seed data scripts to use new schema.

### 4.1 Update `seed-data.ts`

**File:** `../../scripts/seed-data.ts`

**Changes:**

- [ ] Line 23-28: Rename `Client` interface → `Organization`, add `base_url`
- [ ] Line 30: Rename function `createClient()` → `createOrganization()`
- [ ] Line 33: Update URL `/rest/v1/clients` → `/rest/v1/organizations`
- [ ] Line 41-44: Add `base_url` to POST body
- [ ] Line 52-53: Update variable names
- [ ] Line 63-68: Rename parameters in `addSchema()` function
- [ ] Line 77: Update POST body `client_id` → `organization_id`
- [ ] Line 94+: Update all variable references
- [ ] Line 167-174: Update example curl commands in output

**Specific Code Changes:**

```typescript
// OLD (Line 23-28)
interface Client {
  id: string;
  name: string;
  domain: string;
  api_key: string;
}

async function createClient(): Promise<Client> {

// NEW
interface Organization {
  id: string;
  name: string;
  domain: string;
  base_url: string;  // NEW
  api_key: string;
}

async function createOrganization(): Promise<Organization> {
```

```typescript
// OLD (Line 33)
const response = await fetch(`${BASE_URL}/rest/v1/clients`, {

// NEW
const response = await fetch(`${BASE_URL}/rest/v1/organizations`, {
```

```typescript
// OLD (Line 41-44)
body: JSON.stringify({
  name: "Test Client",
  domain: "example.com",
}),

// NEW
body: JSON.stringify({
  name: "Test Organization",
  domain: "example.com",
  base_url: "https://example.com",  // NEW - required
}),
```

```typescript
// OLD (Line 52-55)
const clients = await response.json() as Client[];
const client = clients[0];

console.log("✅ Client created!");
console.log(`   Client ID: ${client.id}`);

// NEW
const organizations = await response.json() as Organization[];
const organization = organizations[0];

console.log("✅ Organization created!");
console.log(`   Organization ID: ${organization.id}`);
```

```typescript
// OLD (Line 63-68)
async function addSchema(
  clientId: string,
  apiKey: string,
  pageUrl: string,
  schemaJson: Record<string, unknown>,
  description: string
): Promise<void> {

// NEW
async function addSchema(
  organizationId: string,
  apiKey: string,
  pageUrl: string,
  schemaJson: Record<string, unknown>,
  description: string
): Promise<void> {
```

```typescript
// OLD (Line 77)
body: JSON.stringify({
  client_id: clientId,
  page_url: pageUrl,
  schema_json: schemaJson,
}),

// NEW
body: JSON.stringify({
  organization_id: organizationId,
  page_url: pageUrl,
  schema_json: schemaJson,
}),
```

```typescript
// OLD (Line 94)
const client = await createClient();

// NEW
const organization = await createOrganization();
```

Continue updating all references to `client.id` and `client.api_key` throughout the file.

---

### 4.2 Update `seed-data.sh`

**File:** `../../scripts/seed-data.sh`

**Changes:**

- [ ] Line 14: Update comment about creating client
- [ ] Line 22: Update URL `/rest/v1/clients` → `/rest/v1/organizations`
- [ ] Line 27-29: Add `base_url` to JSON body
- [ ] Line 34: Update comment "Extract client_id..." → "Extract organization_id..."
- [ ] Line 35-36: Consider renaming `CLIENT_ID` → `ORG_ID` (or keep for compatibility)
- [ ] Line 55, 70, 88: Update POST body `"client_id"` → `"organization_id"`
- [ ] Line 102-108: Update example commands in output

**Specific Code Changes:**

```bash
# OLD (Line 14)
echo "🔧 Creating client..."

# NEW
echo "🔧 Creating organization..."
```

```bash
# OLD (Line 22)
CLIENT_RESPONSE=$(curl -s -X POST "${BASE_URL}/rest/v1/clients" \

# NEW
CLIENT_RESPONSE=$(curl -s -X POST "${BASE_URL}/rest/v1/organizations" \
```

```bash
# OLD (Line 27-29)
-d '{
  "name": "Test Client",
  "domain": "example.com"
}'

# NEW
-d '{
  "name": "Test Organization",
  "domain": "example.com",
  "base_url": "https://example.com"
}'
```

```bash
# OLD (Line 34-38)
echo "Client created: $CLIENT_RESPONSE"

# Extract client_id and api_key from response
CLIENT_ID=$(echo "$CLIENT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# NEW (Option 1: Keep variable name for backwards compatibility)
echo "Organization created: $CLIENT_RESPONSE"

# Extract organization_id and api_key from response
CLIENT_ID=$(echo "$CLIENT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# OR (Option 2: Rename variable)
ORG_ID=$(echo "$CLIENT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
```

```bash
# OLD (Line 55, 70, 88)
-d "{
  \"client_id\": \"${CLIENT_ID}\",
  \"page_url\": \"https://example.com/\",
  ...
}"

# NEW
-d "{
  \"organization_id\": \"${CLIENT_ID}\",
  \"page_url\": \"https://example.com/\",
  ...
}"
```

**Decision:**

- [ ] **Option 1:** Keep `CLIENT_ID` variable name for script compatibility
- [ ] **Option 2:** Rename to `ORG_ID` for consistency (update all references)

**Recommendation:** Keep `CLIENT_ID` variable name, update only the JSON payload fields.

---

### 4.3 Utility Scripts Checklist

- [ ] Update `seed-data.ts` - all type definitions and API calls
- [ ] Update `seed-data.sh` - all curl commands and JSON payloads
- [ ] Test both scripts against migrated database
- [ ] Verify scripts create valid organizations with `base_url`
- [ ] Confirm generated schemas include new fields

---

## Phase 5: Documentation Updates

**Objective:** Update all documentation to reflect schema changes.

### 5.1 Update `CLAUDE.md`

**File:** `CLAUDE.md`

**Changes:**

- [ ] Line 41: Update table name `clients` → `organizations`
- [ ] Add `base_url` to organization description
- [ ] Line 43: Update FK `client_id` → `organization_id` in `page_schemas`
- [ ] Line 44: Update FK `client_id` → `organization_id` in `drift_signals`
- [ ] Line 69: Update example curl POST body
- [ ] Line 88: Update example for creating client → organization
- [ ] Document new fields on `page_schemas`

**Specific Sections to Update:**

```markdown
## Database Schema

Three main tables:
- **organizations** - Organization configs (id, name, domain, base_url, api_key, settings)
- **page_schemas** - JSON-LD schemas per URL (organization_id, page_url, schema_json, content_hash, cache_version, source_mode, page_type, entity_matches, confidence_score)
- **drift_signals** - Content change tracking (organization_id, page_url, content_hash, drift_detected, drift_type, processed, processed_at)
```

```bash
# OLD Example
curl -X POST 'https://[project].supabase.co/rest/v1/clients' \
  -H "apikey: [anon-key]" \
  -H "Authorization: Bearer [service-role-key]" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Client", "domain": "example.com"}'

# NEW Example
curl -X POST 'https://[project].supabase.co/rest/v1/organizations' \
  -H "apikey: [anon-key]" \
  -H "Authorization: Bearer [service-role-key]" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Organization", "domain": "example.com", "base_url": "https://example.com"}'
```

```bash
# Add note about new fields
curl -X POST 'https://[project].supabase.co/functions/v1/update-schema' \
  -H "X-API-Key: [client-api-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "[uuid]",
    "page_url": "https://example.com/",
    "schema_json": {...}
  }'
```

**Note:** Keep `client_id` in public-facing API examples (schema-loader, get-schema) for backwards compatibility.

---

### 5.2 Update `SCRIPTS-README.md`

**File:** `SCRIPTS-README.md`

**Changes:**

- [ ] Line 36: Update heading "Client Record" → "Organization Record"
- [ ] Update table showing created data
- [ ] Line 73: Update POST body example `client_id` → `organization_id`
- [ ] Line 88-91: Update SQL INSERT examples
- [ ] Add `base_url` to all examples

**Specific Sections:**

```markdown
## What Gets Created

### 1. Organization Record
- **Name:** Test Organization
- **Domain:** example.com
- **Base URL:** https://example.com
- **API Key:** Auto-generated (you'll see this in output)
```

```bash
# OLD (Line 73)
curl -X POST 'https://[project].supabase.co/functions/v1/update-schema' \
  -H "X-API-Key: [client-api-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "[uuid]",
    "page_url": "https://yoursite.com/page/",
    "schema_json": {...}
  }'

# NEW
curl -X POST 'https://[project].supabase.co/functions/v1/update-schema' \
  -H "X-API-Key: [organization-api-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "[uuid]",
    "page_url": "https://yoursite.com/page/",
    "schema_json": {...}
  }'
```

```sql
-- OLD (Line 88-95)
INSERT INTO clients (name, domain)
VALUES ('My Company', 'mycompany.com')
RETURNING id, api_key;

INSERT INTO page_schemas (client_id, page_url, schema_json)
VALUES (
  'client-uuid-here',
  'https://mycompany.com/products/',
  '{"@context": "https://schema.org", "@type": "Product", "name": "Widget"}'::jsonb
);

-- NEW
INSERT INTO organizations (name, domain, base_url)
VALUES ('My Company', 'mycompany.com', 'https://mycompany.com')
RETURNING id, api_key;

INSERT INTO page_schemas (organization_id, page_url, schema_json, source_mode)
VALUES (
  'organization-uuid-here',
  'https://mycompany.com/products/',
  '{"@context": "https://schema.org", "@graph": [{"@type": "Product", "name": "Widget"}]}'::jsonb,
  'external'
);
```

---

### 5.3 Update Implementation Plan (if needed)

**File:** `../../.claude/implementation-plan.md`

- [ ] Update references to `client_id` in examples
- [ ] Note API versioning strategy
- [ ] Document backwards compatibility approach

---

### 5.4 Documentation Checklist

- [ ] Update `CLAUDE.md` - all schema references and examples
- [ ] Update `SCRIPTS-README.md` - all examples and SQL queries
- [ ] Update `../../.claude/implementation-plan.md` - migration notes
- [ ] Review all markdown files for stray references
- [ ] Update any API documentation

---

## Phase 6: Testing & Validation

**Objective:** Comprehensive testing to ensure migration success.

### 6.1 Database Validation

- [ ] Run migration SQL on test database
- [ ] Verify all tables exist: `organizations`, `page_schemas`, `drift_signals`
- [ ] Verify all columns exist with correct types
- [ ] Verify indexes still exist and perform well
- [ ] Verify RLS policies updated correctly
- [ ] Check foreign key constraints

**SQL Validation Queries:**

```sql
-- Check organizations table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'organizations'
ORDER BY ordinal_position;

-- Verify base_url is NOT NULL
SELECT COUNT(*) FROM organizations WHERE base_url IS NULL;
-- Should return 0

-- Check page_schemas columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'page_schemas'
  AND column_name IN ('organization_id', 'generated_content_id', 'source_mode', 'page_type', 'entity_matches', 'confidence_score');

-- Check drift_signals columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'drift_signals'
  AND column_name IN ('organization_id', 'drift_type', 'processed_at');

-- Verify foreign keys
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('page_schemas', 'drift_signals');
```

---

### 6.2 Edge Function Testing

Test each function individually:

#### Test `schema-loader`

- [ ] Deploy function: `supabase functions deploy schema-loader`
- [ ] Test with valid organization ID:
  ```bash
  curl 'https://[project].supabase.co/functions/v1/schema-loader?client_id=[org-uuid]'
  ```
- [ ] Verify JavaScript returned correctly
- [ ] Test with missing `client_id` parameter
- [ ] Verify CORS headers present

#### Test `get-schema`

- [ ] Deploy function: `supabase functions deploy get-schema`
- [ ] Test with valid URL:
  ```bash
  curl 'https://[project].supabase.co/functions/v1/get-schema?client_id=[org-uuid]&url=https://example.com/'
  ```
- [ ] Verify schema returned with correct structure
- [ ] Test with URL not in database (should return empty)
- [ ] Verify Cache-Control headers
- [ ] Test performance (<300ms p95)

#### Test `collect-signal`

- [ ] Deploy function: `supabase functions deploy collect-signal`
- [ ] Test drift detection:
  ```bash
  curl -X POST 'https://[project].supabase.co/functions/v1/collect-signal' \
    -H "Content-Type: application/json" \
    -d '{
      "client_id": "[org-uuid]",
      "url": "https://example.com/test/",
      "signals": {
        "title": "Test Page",
        "h1": "Test",
        "content_hash": "abc123"
      }
    }'
  ```
- [ ] Verify drift_signal created in database
- [ ] Verify `drift_type` populated when drift detected
- [ ] Test with matching hash (no drift)

#### Test `update-schema`

- [ ] Deploy function: `supabase functions deploy update-schema`
- [ ] Test schema creation:
  ```bash
  curl -X POST 'https://[project].supabase.co/functions/v1/update-schema' \
    -H "X-API-Key: [org-api-key]" \
    -H "Content-Type: application/json" \
    -d '{
      "organization_id": "[org-uuid]",
      "page_url": "https://example.com/new-page/",
      "schema_json": {
        "@context": "https://schema.org",
        "@graph": [{
          "@type": "WebPage",
          "name": "New Page"
        }]
      }
    }'
  ```
- [ ] Verify schema inserted with `source_mode: 'external'`
- [ ] Test schema update (upsert)
- [ ] Verify cache_version increments
- [ ] Test authentication failure
- [ ] Verify drift signals marked as processed

#### Test `get-drift`

- [ ] Deploy function: `supabase functions deploy get-drift`
- [ ] Test drift retrieval:
  ```bash
  curl 'https://[project].supabase.co/functions/v1/get-drift?organization_id=[org-uuid]' \
    -H "X-API-Key: [org-api-key]"
  ```
- [ ] Verify unprocessed drift signals returned
- [ ] Test authentication
- [ ] Verify only organization's drift returned

---

### 6.3 Seed Script Testing

- [ ] Run TypeScript seed script:
  ```bash
  SUPABASE_SERVICE_ROLE_KEY=your-key deno run --allow-net --allow-env ../../scripts/seed-data.ts
  ```
- [ ] Verify organization created with `base_url`
- [ ] Verify 4 schemas created
- [ ] Verify all schemas have `source_mode: 'external'`
- [ ] Verify output shows correct IDs and URLs

- [ ] Run Bash seed script:
  ```bash
  ./scripts/seed-data.sh uxkudwzbqijamqhuowly your-service-role-key
  ```
- [ ] Verify same results as TypeScript version

---

### 6.4 Integration Testing

- [ ] Update `../../test.html` with new organization ID
- [ ] Open `../../test.html` in browser
- [ ] Verify schema-loader executes without errors
- [ ] Check browser console for successful schema injection
- [ ] View page source - verify JSON-LD present in `<head>`
- [ ] Test drift signal collection
- [ ] Verify network requests complete successfully

---

### 6.5 Backwards Compatibility Testing

- [ ] Test old API calls with `client_id` parameter still work
- [ ] Verify embedded scripts on external sites continue to function
- [ ] Test that schemas are still served correctly
- [ ] Confirm no breaking changes to public APIs

---

### 6.6 Performance Testing

- [ ] Benchmark `get-schema` response time (target: <300ms p95)
- [ ] Test concurrent requests (10+ simultaneous)
- [ ] Verify database query performance with EXPLAIN
- [ ] Check Cloudflare Worker caching still works

**Performance Test Script:**

```bash
# Run 20 concurrent requests
for i in {1..20}; do
  curl -s -w "Request $i: %{time_total}s\n" -o /dev/null \
    "https://[project].supabase.co/functions/v1/get-schema?client_id=[uuid]&url=https://example.com/" &
done
wait
```

---

### 6.7 Testing Checklist

- [ ] All database validation queries pass
- [ ] All 5 edge functions deployed and tested
- [ ] Both seed scripts create valid data
- [ ] Integration test with `../../test.html` succeeds
- [ ] Backwards compatibility confirmed
- [ ] Performance benchmarks meet targets
- [ ] No console errors or warnings

---

## Phase 7: Deployment

**Objective:** Deploy migration to production safely.

### 7.1 Pre-Deployment Checklist

- [ ] All tests pass in development
- [ ] Database migration SQL reviewed and approved
- [ ] Edge functions tested locally
- [ ] Documentation updated
- [ ] Rollback plan prepared
- [ ] Stakeholders notified of deployment window

---

### 7.2 Deployment Steps

#### Step 1: Database Migration

- [ ] Backup production database:
  ```bash
  supabase db dump -f backup_pre_gears_migration.sql
  ```

- [ ] Review migration file one final time

- [ ] Apply migration:
  ```bash
  supabase db push
  ```

- [ ] Verify migration applied successfully:
  ```bash
  supabase db remote commit
  ```

- [ ] Run validation queries on production

#### Step 2: Deploy Edge Functions

- [ ] Deploy all functions atomically:
  ```bash
  supabase functions deploy schema-loader
  supabase functions deploy get-schema
  supabase functions deploy collect-signal
  supabase functions deploy update-schema
  supabase functions deploy get-drift
  ```

- [ ] Verify all functions deployed:
  ```bash
  supabase functions list
  ```

#### Step 3: Smoke Tests

- [ ] Test `schema-loader` with production org ID
- [ ] Test `get-schema` with production URL
- [ ] Test `collect-signal` with test payload
- [ ] Monitor error logs for 10 minutes

#### Step 4: Monitor

- [ ] Watch Supabase logs for errors
- [ ] Check function invocation metrics
- [ ] Monitor database performance
- [ ] Verify no increase in error rates

---

### 7.3 Rollback Plan

If critical issues arise:

#### Database Rollback

```bash
# Restore from backup
supabase db reset --db-url postgresql://[connection-string]
psql -f backup_pre_gears_migration.sql
```

#### Function Rollback

```bash
# Redeploy previous versions from git
git checkout [previous-commit]
supabase functions deploy --all
git checkout main
```

---

### 7.4 Post-Deployment Verification

- [ ] All public-facing embeds still work
- [ ] Schemas being served correctly
- [ ] Drift detection functioning
- [ ] Admin APIs accessible
- [ ] Performance within SLA
- [ ] No error spikes in logs

---

### 7.5 Deployment Checklist

- [ ] Database backed up
- [ ] Migration applied successfully
- [ ] All functions deployed
- [ ] Smoke tests pass
- [ ] Monitoring in place
- [ ] Rollback plan ready (but not needed!)
- [ ] Post-deployment verification complete

---

## Summary of Changes

### Database Schema

| Change Type | Details |
|-------------|---------|
| Table Rename | `clients` → `organizations` |
| Column Rename | `client_id` → `organization_id` (all tables) |
| New Required Field | `organizations.base_url` |
| New Fields (page_schemas) | `generated_content_id`, `source_mode`, `page_type`, `entity_matches`, `confidence_score` |
| New Fields (drift_signals) | `drift_type`, `processed_at` |

### Code Changes

| File Type | Files Changed | Key Changes |
|-----------|---------------|-------------|
| SQL Migrations | 1 new file | Complete schema migration |
| TypeScript Types | 1 new file | GEARS-compliant type definitions |
| Edge Functions | 5 files | Variable renames, query updates |
| Scripts | 2 files | API endpoint and payload updates |
| Documentation | 3 files | Schema and example updates |

### API Compatibility

| API | Parameter | Status |
|-----|-----------|--------|
| schema-loader (public) | `client_id` | ✅ Maintained |
| get-schema (public) | `client_id` | ✅ Maintained |
| collect-signal (public) | `client_id` | ✅ Maintained |
| update-schema (admin) | `organization_id` | ⚠️ Breaking change |
| get-drift (admin) | `organization_id` | ⚠️ Breaking change |

**Note:** Admin APIs have breaking changes. Update any tools/scripts that call these endpoints.

---

## Known Issues & Limitations

### Phase 1 Scope

This migration focuses on:
- ✅ Schema compatibility with GEARS v3.6
- ✅ Renaming core tables and columns
- ✅ Adding new required fields
- ✅ Maintaining public API backwards compatibility

**Not included in Phase 1:**
- ❌ Creating full GEARS entity tables (authority_themes, subtopics, etc.)
- ❌ Entity matching/projection logic (Mode B)
- ❌ Auto-sync triggers for generated_content
- ❌ Evidence tracking tables
- ❌ Relationship graphs (typed_edges)

These features can be added incrementally in future phases.

---

## Future Enhancements

### Phase 2: GEARS Entity Tables

- [ ] Create remaining GEARS tables from schema
- [ ] Implement entity CRUD operations
- [ ] Add entity resolution queries

### Phase 3: Mode B Schema Projection

- [ ] Implement glossary term matching
- [ ] Add psych node entity extraction
- [ ] Build confidence scoring algorithm
- [ ] Populate `entity_matches` field

### Phase 4: Generated Content Pipeline

- [ ] Create `generated_content` workflow
- [ ] Implement auto-sync trigger
- [ ] Build content generation pipeline

### Phase 5: Evidence & Relationships

- [ ] Add evidence source tracking
- [ ] Implement typed edges for relationships
- [ ] Build graph query capabilities

---

## Maintenance Notes

### Ongoing Tasks

- [ ] Monitor database performance post-migration
- [ ] Track API usage patterns
- [ ] Collect feedback on new fields
- [ ] Plan Phase 2 features

### Breaking Change Communication

**For Admin API Users:**

```
BREAKING CHANGE: Admin API Parameter Updates

Effective: [Deployment Date]

The following endpoints have updated parameter names:

1. update-schema
   OLD: { "client_id": "..." }
   NEW: { "organization_id": "..." }

2. get-drift
   OLD: ?client_id=...
   NEW: ?organization_id=...

Public APIs (schema-loader, get-schema, collect-signal) are
unchanged and maintain backwards compatibility.

Update your ../../scripts/tools accordingly.
```

---

## Contact & Support

For questions or issues during migration:

1. Check this migration plan first
2. Review GEARS schema documentation
3. Test in local Supabase instance
4. Refer to comprehensive inventory report

---

**Migration Status:** ⬜ Not Started | ⏳ In Progress | ✅ Complete

Update this document as you complete each checklist item. Good luck! 🚀
