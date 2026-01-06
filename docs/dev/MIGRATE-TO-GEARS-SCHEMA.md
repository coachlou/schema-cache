# Claude Code Migration Instructions

## Mission

Migrate the existing Schema Injection Service codebase to use the GEARS v3.6 database schema. The current implementation uses a `clients` table and simplified `page_schemas` structure. The target architecture aligns with the GEARS entity registry model.

---

## Reference Document

The file `GEARS-DB-SCHEMA.md` (in this same directory or provided separately) contains the complete target Supabase schema. Use it as the source of truth for all table structures, column names, and relationships.

---

## Phase 1: Discovery

### 1.1 Map the Codebase

Explore the project and identify:

1. **All Supabase references** — Files importing `@supabase/supabase-js` or containing `.from()` calls
2. **SQL queries** — Any raw SQL strings or migration files
3. **Type definitions** — TypeScript interfaces, Zod schemas, or JSDoc types for database entities
4. **API routes** — Handlers for CRUD operations on clients, schemas, drift signals
5. **Background workers** — Scheduled jobs or queue processors

Report a file inventory before proceeding.

### 1.2 Identify Table References

Search for these exact strings:

- `'clients'` — Table name
- `client_id` — Column reference
- `'page_schemas'` — Table name
- `'drift_signals'` — Table name
- `.from(` — Supabase query builder

List every file and line number where these appear.

---

## Phase 2: Schema Mapping

### 2.1 Table Renames

| Current | Target | Notes |
|---------|--------|-------|
| `clients` | `organizations` | Add `base_url` (required) |
| `client_id` | `organization_id` | All foreign keys |

### 2.2 New Columns on `page_schemas`

Add these columns:

```typescript
generated_content_id: string | null;  // FK to generated_content
source_mode: 'generation' | 'projection' | 'external';
page_type: string | null;
entity_matches: Record<string, unknown> | null;
confidence_score: number | null;
```

### 2.3 New Columns on `drift_signals`

Add these columns:

```typescript
drift_type: string | null;
processed_at: string | null;
```

### 2.4 New Required Field on `organizations`

```typescript
base_url: string;  // Required, e.g., "https://example.com"
```

### 2.5 New Tables (create types for)

- `authority_themes`
- `subtopics`
- `glossary_terms`
- `psych_nodes`
- `personas`
- `framing_entities`
- `typed_relations`
- `typed_edges`
- `generated_content`
- `evidence_sources`
- `evidence_claims`
- `node_types`

See `GEARS-DB-SCHEMA.md` for complete column definitions.

---

## Phase 3: Code Modifications

### 3.1 Type Definitions

Create or update interfaces to match the GEARS schema. Example structure:

```typescript
// ../../types/database.ts

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
  schema_json: Record<string, unknown>;
  generated_content_id: string | null;  // NEW
  source_mode: 'generation' | 'projection' | 'external';  // NEW
  content_hash: string | null;
  cache_version: number;
  page_type: string | null;  // NEW
  entity_matches: Record<string, unknown> | null;  // NEW
  confidence_score: number | null;  // NEW
  created_at: string;
  updated_at: string;
}

// ... continue for all entity types
```

### 3.2 Supabase Query Updates

Replace all occurrences:

```typescript
// BEFORE
supabase.from('clients')
supabase.from('page_schemas').select('client_id')
.eq('client_id', value)

// AFTER
supabase.from('organizations')
supabase.from('page_schemas').select('organization_id')
.eq('organization_id', value)
```

### 3.3 Variable Renames

For consistency throughout the codebase:

| Find | Replace |
|------|---------|
| `client` | `organization` (or `org`) |
| `clientId` | `organizationId` (or `orgId`) |
| `clients` | `organizations` |
| `Client` (type) | `Organization` |

Preserve existing naming conventions (camelCase vs snake_case).

### 3.4 Schema Insertion Logic

When inserting into `page_schemas`, include new fields:

```typescript
// BEFORE
await supabase.from('page_schemas').insert({
  client_id: clientId,
  page_url: url,
  schema_json: schema,
  content_hash: hash,
});

// AFTER
await supabase.from('page_schemas').insert({
  organization_id: orgId,
  page_url: url,
  schema_json: schema,
  content_hash: hash,
  source_mode: 'external',  // or 'projection' for Mode B
  page_type: inferPageType(schema),  // optional
});
```

### 3.5 Organization Creation

Ensure `base_url` is required:

```typescript
// BEFORE
interface CreateClientRequest {
  name: string;
  domain: string;
}

// AFTER
interface CreateOrganizationRequest {
  name: string;
  domain: string;
  base_url: string;  // NEW - required
}
```

---

## Phase 4: New Entity Support (Optional)

If the codebase needs to interact with GEARS entities:

### 4.1 Entity CRUD Operations

Create service functions for:

- `glossary_terms` — Term lookup, alias matching
- `psych_nodes` — Node type queries, valence filtering
- `typed_relations` — Relation vocabulary lookup
- `typed_edges` — Edge creation with validation
- `generated_content` — Content storage with auto schema sync

### 4.2 Entity Resolution Queries

For Mode B schema projection:

```typescript
// Find matching glossary terms
const { data: terms } = await supabase
  .from('glossary_terms')
  .select('*')
  .eq('organization_id', orgId)
  .eq('status', 'active')
  .eq('page_published', true);

// Find psych nodes by type
const { data: nodes } = await supabase
  .from('psych_nodes')
  .select('*')
  .eq('organization_id', orgId)
  .eq('node_type', 'Fear');
```

---

## Phase 5: Validation

### 5.1 Type Check

Run TypeScript compiler:

```bash
npx tsc --noEmit
```

Fix all type errors from schema changes.

### 5.2 Search for Stragglers

After modifications, search for any remaining references:

```bash
grep -r "client" --include="*.ts" --include="*.tsx"
grep -r "client_id" --include="*.ts" --include="*.tsx"
```

### 5.3 Test Queries

Verify these operations work:

```typescript
// Organization lookup
const { data: org } = await supabase
  .from('organizations')
  .select('*')
  .eq('domain', 'example.com')
  .single();

// Schema retrieval
const { data: schemas } = await supabase
  .from('page_schemas')
  .select('*')
  .eq('organization_id', org.id);

// Drift signal creation
await supabase.from('drift_signals').insert({
  organization_id: org.id,
  page_url: '/test/',
  content_hash: 'abc123',
  drift_detected: false,
});
```

---

## Constraints

1. **Do not modify database schema** — Assume migrations are already applied
2. **Preserve existing functionality** — This is rename/extension, not rewrite
3. **Match existing code style** — Follow conventions already in use
4. **Document changes** — Add comments where reason isn't obvious

---

## Deliverables

After completing migration:

1. Summary of all files modified
2. List of any breaking API changes
3. Issues or ambiguities encountered
4. Recommendations for follow-up work
