# GEARS Database Schema Reference

Version: Derived from entity_registry_v3.1.json
Purpose: Canonical Supabase PostgreSQL schema for GEARS applications

---

## Overview

This schema normalizes the GEARS entity_registry.json structure into relational tables. The source JSON contains nested objects that map to the following tables:

| JSON Path | Table Name |
|-----------|------------|
| `registry_metadata` | `organizations` |
| `authority_themes[]` | `authority_themes` |
| `subtopics[]` | `subtopics` |
| `glossary_terms[]` | `glossary_terms` |
| `psych_nodes[]` | `psych_nodes` |
| `personas[]` | `personas` |
| `framing_entities.stub_roles[]` | `framing_entities` (entity_type='role') |
| `framing_entities.journey_stages[]` | `framing_entities` (entity_type='stage') |
| `framing_entities.perspective_angles[]` | `framing_entities` (entity_type='angle') |
| `framing_entities.outcomes[]` | `framing_entities` (entity_type='outcome') |
| `relationship_vocabulary[]` | `typed_relations` |
| `node_type_taxonomy.types[]` | `node_types` |
| (runtime edges) | `typed_edges` |
| (generated output) | `generated_content` |
| (schema cache) | `page_schemas` |
| (evidence) | `evidence_sources`, `evidence_claims` |

---

## SQL Schema

```sql
-- ============================================
-- GEARS v3.6 Database Schema
-- Derived from entity_registry_v3.1.json
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- ORGANIZATIONS (from registry_metadata)
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                      -- "PowerUp Coaching"
  domain TEXT NOT NULL,                    -- "powerupcoaching.com"
  base_url TEXT NOT NULL,                  -- "https://powerupcoaching.com"
  schema_version TEXT DEFAULT 'GEARS_v3.6',
  phase TEXT DEFAULT 'Phase_1_MVP',
  api_key TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_organizations_domain ON organizations(domain);

-- ============================================
-- NODE_TYPES (from node_type_taxonomy)
-- ============================================
CREATE TABLE node_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id TEXT UNIQUE NOT NULL,            -- "Fear", "Emotion", "Need", etc.
  description TEXT NOT NULL,
  parent_type_id TEXT REFERENCES node_types(type_id),  -- e.g., Fear -> Emotion
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUTHORITY_THEMES
-- ============================================
CREATE TABLE authority_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT UNIQUE NOT NULL,          -- "theme_0001"
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                      -- "ai_augmented_expertise"
  display_name TEXT NOT NULL,              -- "AI-Augmented Expertise"
  canonical_definition TEXT,
  subtopic_capacity INTEGER DEFAULT 15,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_authority_themes_org ON authority_themes(organization_id);
CREATE INDEX idx_authority_themes_status ON authority_themes(status);

-- ============================================
-- SUBTOPICS
-- ============================================
CREATE TABLE subtopics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT UNIQUE NOT NULL,          -- "sub_0001"
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                      -- "ai_tool_selection_overwhelm"
  display_name TEXT NOT NULL,              -- "AI Tool Selection Overwhelm"
  primary_theme_id TEXT NOT NULL REFERENCES authority_themes(entity_id),
  secondary_theme_ids TEXT[],              -- Array of theme entity_ids
  linked_glossary_terms TEXT[],            -- Array of glossary entity_ids
  linked_psych_nodes TEXT[],               -- Array of psych entity_ids
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subtopics_org ON subtopics(organization_id);
CREATE INDEX idx_subtopics_theme ON subtopics(primary_theme_id);
CREATE INDEX idx_subtopics_status ON subtopics(status);

-- ============================================
-- GLOSSARY_TERMS
-- ============================================
CREATE TABLE glossary_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT UNIQUE NOT NULL,          -- "g_0001"
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  term TEXT NOT NULL,                      -- "AI-Augmented Expertise"
  slug TEXT NOT NULL,                      -- "ai-augmented-expertise"
  schema_id TEXT NOT NULL,                 -- "/glossary/ai-augmented-expertise/#term"
  page_url TEXT NOT NULL,                  -- "/glossary/ai-augmented-expertise/"
  aliases TEXT[],                          -- Alternative names for fuzzy matching
  status TEXT DEFAULT 'active',
  page_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_glossary_terms_org ON glossary_terms(organization_id);
CREATE INDEX idx_glossary_terms_slug ON glossary_terms(slug);
CREATE UNIQUE INDEX idx_glossary_terms_org_slug ON glossary_terms(organization_id, slug);

-- ============================================
-- PSYCH_NODES
-- ============================================
CREATE TABLE psych_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT UNIQUE NOT NULL,          -- "psych_0001"
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                      -- "expertise_commoditization_fear"
  display_name TEXT NOT NULL,              -- "Expertise Commoditization Fear"
  node_type TEXT NOT NULL REFERENCES node_types(type_id),  -- "Fear"
  canonical_description TEXT,
  psychological_basis TEXT,                -- "Loss aversion, competence anxiety..."
  emotional_valence TEXT,                  -- "positive" | "negative" | "neutral"
  schema_id TEXT NOT NULL,                 -- "/psych/expertise-commoditization-fear/#node"
  page_url TEXT NOT NULL,                  -- "/psych/expertise-commoditization-fear/"
  status TEXT DEFAULT 'active',
  page_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_psych_nodes_org ON psych_nodes(organization_id);
CREATE INDEX idx_psych_nodes_type ON psych_nodes(node_type);
CREATE INDEX idx_psych_nodes_valence ON psych_nodes(emotional_valence);

-- ============================================
-- PERSONAS
-- ============================================
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT UNIQUE NOT NULL,          -- "persona_0001"
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                      -- "overwhelmed_optimizer"
  display_name TEXT NOT NULL,              -- "The Overwhelmed Optimizer"
  primary_psych_nodes TEXT[],              -- ["psych_0002", "psych_0003"]
  journey_stage_affinity TEXT,             -- "awareness"
  schema_id TEXT NOT NULL,                 -- "/personas/overwhelmed-optimizer/#persona"
  page_url TEXT NOT NULL,                  -- "/personas/overwhelmed-optimizer/"
  status TEXT DEFAULT 'active',
  page_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_personas_org ON personas(organization_id);
CREATE INDEX idx_personas_stage ON personas(journey_stage_affinity);

-- ============================================
-- FRAMING_ENTITIES (unified table for roles, stages, angles, outcomes)
-- ============================================
CREATE TABLE framing_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT UNIQUE NOT NULL,          -- "role_0001", "stage_0001", etc.
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL for global
  entity_type TEXT NOT NULL,               -- 'role', 'stage', 'angle', 'outcome'
  slug TEXT NOT NULL,                      -- "definition", "awareness", etc.
  display_name TEXT NOT NULL,              -- "Definition", "Awareness", etc.
  position INTEGER,                        -- For ordered types like journey_stages
  schema_id TEXT NOT NULL,                 -- "/id/role/definition"
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_framing_entities_type ON framing_entities(entity_type);
CREATE INDEX idx_framing_entities_org ON framing_entities(organization_id);
CREATE UNIQUE INDEX idx_framing_entities_type_slug ON framing_entities(entity_type, slug);

-- ============================================
-- TYPED_RELATIONS (relationship vocabulary)
-- ============================================
CREATE TABLE typed_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relation_id TEXT UNIQUE NOT NULL,        -- "REL001"
  slug TEXT NOT NULL,                      -- "causes"
  term TEXT NOT NULL,                      -- "causes"
  label TEXT NOT NULL,                     -- "Causes"
  description TEXT,
  direction TEXT,                          -- "cause -> effect"
  from_types TEXT[] NOT NULL,              -- ["Trigger", "Belief", "Emotion", ...]
  to_types TEXT[] NOT NULL,                -- ["Emotion", "Behavior", "Outcome", ...]
  inverse_slug TEXT,                       -- "caused-by"
  strength_default TEXT DEFAULT 'tendency', -- "tendency" | "strong-claim"
  evidence_required TEXT DEFAULT 'recommended', -- "required" | "recommended" | "optional"
  category TEXT,                           -- "causal", "resolution", "reinforcement", etc.
  schema_id TEXT NOT NULL,                 -- "/relations/causes/"
  status TEXT DEFAULT 'active',
  page_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_typed_relations_slug ON typed_relations(slug);
CREATE INDEX idx_typed_relations_category ON typed_relations(category);

-- ============================================
-- TYPED_EDGES (actual relationships between entities)
-- ============================================
CREATE TABLE typed_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  relation_id TEXT NOT NULL REFERENCES typed_relations(relation_id),
  source_entity_id TEXT NOT NULL,          -- e.g., "psych_0001"
  source_entity_type TEXT NOT NULL,        -- e.g., "Fear"
  target_entity_id TEXT NOT NULL,          -- e.g., "psych_0004"
  target_entity_type TEXT NOT NULL,        -- e.g., "Need"
  strength TEXT DEFAULT 'tendency',        -- "tendency" | "strong-claim"
  evidence_citations JSONB,                -- Array of citation objects
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_typed_edges_org ON typed_edges(organization_id);
CREATE INDEX idx_typed_edges_source ON typed_edges(source_entity_id);
CREATE INDEX idx_typed_edges_target ON typed_edges(target_entity_id);
CREATE INDEX idx_typed_edges_relation ON typed_edges(relation_id);
CREATE UNIQUE INDEX idx_typed_edges_unique ON typed_edges(organization_id, relation_id, source_entity_id, target_entity_id);

-- ============================================
-- GENERATED_CONTENT (content output with embedded schema)
-- ============================================
CREATE TABLE generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subtopic_id TEXT REFERENCES subtopics(entity_id),
  content_type TEXT NOT NULL,              -- 'stub', 'article', 'landing'
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,                  -- Full content structure
  schema_json JSONB NOT NULL,              -- Embedded JSON-LD schema
  word_count INTEGER,
  stub_role TEXT,                          -- FK to framing_entities slug
  journey_stage TEXT,                      -- FK to framing_entities slug
  perspective_angle TEXT,                  -- FK to framing_entities slug
  outcome TEXT,                            -- FK to framing_entities slug
  status TEXT DEFAULT 'draft',             -- 'draft', 'published', 'archived'
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_generated_content_org ON generated_content(organization_id);
CREATE INDEX idx_generated_content_subtopic ON generated_content(subtopic_id);
CREATE INDEX idx_generated_content_status ON generated_content(status);
CREATE INDEX idx_generated_content_type ON generated_content(content_type);
CREATE UNIQUE INDEX idx_generated_content_org_slug_type ON generated_content(organization_id, slug, content_type);

-- ============================================
-- PAGE_SCHEMAS (schema delivery/caching layer)
-- ============================================
CREATE TABLE page_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,                  -- Full URL or path
  url_pattern TEXT,                        -- Optional glob pattern
  schema_json JSONB NOT NULL,              -- The JSON-LD schema
  generated_content_id UUID REFERENCES generated_content(id) ON DELETE SET NULL,
  source_mode TEXT DEFAULT 'projection',   -- 'generation', 'projection', 'external'
  content_hash TEXT,                       -- Hash for drift detection
  cache_version INTEGER DEFAULT 1,
  page_type TEXT,                          -- 'Article', 'Service', 'FAQPage', etc.
  entity_matches JSONB,                    -- Mode B match results
  confidence_score NUMERIC(3,2),           -- 0.00-1.00
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_page_schemas_org ON page_schemas(organization_id);
CREATE INDEX idx_page_schemas_source ON page_schemas(source_mode);
CREATE UNIQUE INDEX idx_page_schemas_org_url ON page_schemas(organization_id, page_url);

-- ============================================
-- EVIDENCE_SOURCES
-- ============================================
CREATE TABLE evidence_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,                 -- "src_001"
  name TEXT NOT NULL,                      -- Publisher/Author name
  url TEXT NOT NULL,
  title TEXT,
  publication_date DATE,
  tier INTEGER DEFAULT 2,                  -- 1=peer-reviewed, 2=authoritative, 3=general
  accessible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evidence_sources_org ON evidence_sources(organization_id);
CREATE UNIQUE INDEX idx_evidence_sources_org_id ON evidence_sources(organization_id, source_id);

-- ============================================
-- EVIDENCE_CLAIMS
-- ============================================
CREATE TABLE evidence_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id TEXT NOT NULL,                  -- "claim_001"
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,                 -- FK to evidence_sources.source_id
  claim_text TEXT NOT NULL,
  quote_verbatim TEXT,
  claim_type TEXT,                         -- 'statistic', 'finding', 'quote', etc.
  confidence TEXT DEFAULT 'medium',        -- 'high', 'medium', 'low'
  supports_edge_id UUID REFERENCES typed_edges(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evidence_claims_org ON evidence_claims(organization_id);
CREATE INDEX idx_evidence_claims_source ON evidence_claims(source_id);
CREATE INDEX idx_evidence_claims_edge ON evidence_claims(supports_edge_id);

-- ============================================
-- DRIFT_SIGNALS (content change detection)
-- ============================================
CREATE TABLE drift_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  previous_hash TEXT,
  drift_detected BOOLEAN DEFAULT FALSE,
  drift_type TEXT,                         -- 'content_change', 'structure_change', 'entity_drift'
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  signals JSONB,                           -- { title, h1, word_count_delta, etc. }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_drift_signals_org ON drift_signals(organization_id);
CREATE INDEX idx_drift_signals_unprocessed ON drift_signals(organization_id, drift_detected, processed)
  WHERE drift_detected = TRUE AND processed = FALSE;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE authority_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE glossary_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE psych_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE framing_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE typed_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE typed_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_signals ENABLE ROW LEVEL SECURITY;

-- Public read for schema delivery
CREATE POLICY "Public can read page_schemas" ON page_schemas
  FOR SELECT USING (true);

CREATE POLICY "Public can read organizations" ON organizations
  FOR SELECT USING (true);

-- Public insert for drift signals (from loader)
CREATE POLICY "Public can insert drift_signals" ON drift_signals
  FOR INSERT WITH CHECK (true);

-- ============================================
-- AUTO-SYNC TRIGGER: generated_content -> page_schemas
-- ============================================
CREATE OR REPLACE FUNCTION sync_generated_schema_to_cache()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO page_schemas (
    organization_id,
    page_url,
    schema_json,
    generated_content_id,
    source_mode,
    page_type,
    created_at,
    updated_at
  ) VALUES (
    NEW.organization_id,
    CONCAT(
      (SELECT base_url FROM organizations WHERE id = NEW.organization_id),
      '/insights/', NEW.slug,
      CASE WHEN NEW.content_type = 'article' THEN '/full/' ELSE '/' END
    ),
    NEW.schema_json,
    NEW.id,
    'generation',
    'Article',
    NOW(),
    NOW()
  )
  ON CONFLICT (organization_id, page_url)
  DO UPDATE SET
    schema_json = EXCLUDED.schema_json,
    generated_content_id = EXCLUDED.generated_content_id,
    source_mode = 'generation',
    cache_version = page_schemas.cache_version + 1,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_schema_on_publish
AFTER INSERT OR UPDATE OF schema_json, status ON generated_content
FOR EACH ROW
WHEN (NEW.status = 'published')
EXECUTE FUNCTION sync_generated_schema_to_cache();
```

---

## Entity ID Conventions

Per GEARS Governance, all entity IDs follow this pattern:

```
[type_prefix]_[zero-padded integer][_vX][optional qualifiers]
```

| Entity Type | Prefix | Example |
|-------------|--------|---------|
| Authority Theme | `theme_` | `theme_0001` |
| Subtopic | `sub_` | `sub_0005` |
| Glossary Term | `g_` | `g_0012` |
| Psych Node | `psych_` | `psych_0003` |
| Persona | `persona_` | `persona_0002` |
| Stub Role | `role_` | `role_0004` |
| Journey Stage | `stage_` | `stage_0003` |
| Perspective Angle | `angle_` | `angle_0002` |
| Outcome | `outcome_` | `outcome_0001` |
| Relation | `REL` | `REL009` |

---

## Validation Rules (from entity_registry)

```json
{
  "internal_linking_thresholds": {
    "minimum_glossary_links": 2,
    "minimum_psych_node_links": 1,
    "maximum_glossary_links": 5,
    "maximum_psych_node_links": 3
  },
  "edge_validation_rules": {
    "strong_claim_evidence_threshold": 2,
    "tendency_evidence_threshold": 1,
    "validate_domain_range": true,
    "allow_type_inheritance": true
  }
}
```

These should be enforced at application level, not database level.

---

## Node Type Hierarchy

```
Emotion
  └── Fear (inherits from Emotion)

Belief
Behavior
Need
Trigger
Pattern
Outcome
Value
Rule
```

When `allow_type_inheritance: true`, a `Fear` node can be used anywhere an `Emotion` is valid in edge from_types/to_types.
