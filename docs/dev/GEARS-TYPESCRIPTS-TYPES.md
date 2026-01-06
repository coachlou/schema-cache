# GEARS TypeScript Type Definitions

Copy these types into your codebase (e.g., `types/database.ts` or `types/gears.ts`).

---

```typescript
// ============================================
// GEARS v3.6 Database Types
// Derived from entity_registry_v3.1.json
// ============================================

// ============================================
// CORE ENTITIES
// ============================================

export interface Organization {
  id: string;
  name: string;
  domain: string;
  base_url: string;
  schema_version: string;
  phase: string;
  api_key: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface NodeType {
  id: string;
  type_id: string;
  description: string;
  parent_type_id: string | null;
  created_at: string;
}

export interface AuthorityTheme {
  id: string;
  entity_id: string;
  organization_id: string;
  name: string;
  display_name: string;
  canonical_definition: string | null;
  subtopic_capacity: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Subtopic {
  id: string;
  entity_id: string;
  organization_id: string;
  name: string;
  display_name: string;
  primary_theme_id: string;
  secondary_theme_ids: string[] | null;
  linked_glossary_terms: string[] | null;
  linked_psych_nodes: string[] | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface GlossaryTerm {
  id: string;
  entity_id: string;
  organization_id: string;
  term: string;
  slug: string;
  schema_id: string;
  page_url: string;
  aliases: string[] | null;
  status: 'active' | 'inactive';
  page_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface PsychNode {
  id: string;
  entity_id: string;
  organization_id: string;
  name: string;
  display_name: string;
  node_type: string;
  canonical_description: string | null;
  psychological_basis: string | null;
  emotional_valence: 'positive' | 'negative' | 'neutral' | null;
  schema_id: string;
  page_url: string;
  status: 'active' | 'inactive';
  page_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Persona {
  id: string;
  entity_id: string;
  organization_id: string;
  name: string;
  display_name: string;
  primary_psych_nodes: string[] | null;
  journey_stage_affinity: string | null;
  schema_id: string;
  page_url: string;
  status: 'active' | 'inactive';
  page_published: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// FRAMING ENTITIES
// ============================================

export type FramingEntityType = 'role' | 'stage' | 'angle' | 'outcome';

export interface FramingEntity {
  id: string;
  entity_id: string;
  organization_id: string | null;
  entity_type: FramingEntityType;
  slug: string;
  display_name: string;
  position: number | null;
  schema_id: string;
  status: 'active' | 'inactive';
  created_at: string;
}

// Type aliases for specific framing entities
export type StubRole = FramingEntity & { entity_type: 'role' };
export type JourneyStage = FramingEntity & { entity_type: 'stage' };
export type PerspectiveAngle = FramingEntity & { entity_type: 'angle' };
export type Outcome = FramingEntity & { entity_type: 'outcome' };

// ============================================
// RELATIONSHIPS
// ============================================

export type EdgeStrength = 'tendency' | 'strong-claim';
export type EvidenceRequired = 'required' | 'recommended' | 'optional';

export interface TypedRelation {
  id: string;
  relation_id: string;
  slug: string;
  term: string;
  label: string;
  description: string | null;
  direction: string | null;
  from_types: string[];
  to_types: string[];
  inverse_slug: string | null;
  strength_default: EdgeStrength;
  evidence_required: EvidenceRequired;
  category: string | null;
  schema_id: string;
  status: 'active' | 'inactive';
  page_published: boolean;
  created_at: string;
}

export interface TypedEdge {
  id: string;
  organization_id: string;
  relation_id: string;
  source_entity_id: string;
  source_entity_type: string;
  target_entity_id: string;
  target_entity_type: string;
  strength: EdgeStrength;
  evidence_citations: Citation[] | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Citation {
  source_id: string;
  claim_id?: string;
  quote?: string;
}

// ============================================
// CONTENT
// ============================================

export type ContentType = 'stub' | 'article' | 'landing';
export type ContentStatus = 'draft' | 'published' | 'archived';

export interface GeneratedContent {
  id: string;
  organization_id: string;
  subtopic_id: string | null;
  content_type: ContentType;
  slug: string;
  title: string;
  content: ContentPayload;
  schema_json: JsonLdGraph;
  word_count: number | null;
  stub_role: string | null;
  journey_stage: string | null;
  perspective_angle: string | null;
  outcome: string | null;
  status: ContentStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentPayload {
  body: string;
  meta_description?: string;
  human_redirect?: HumanRedirect;
  framework?: Framework;
  [key: string]: unknown;
}

export interface HumanRedirect {
  intro: string;
  bullets: string[];
  cta_text: string;
  cta_url: string;
}

export interface Framework {
  name: string;
  steps: FrameworkStep[];
}

export interface FrameworkStep {
  position: number;
  name: string;
  text: string;
}

// ============================================
// SCHEMA CACHING
// ============================================

export type SourceMode = 'generation' | 'projection' | 'external';

export interface PageSchema {
  id: string;
  organization_id: string;
  page_url: string;
  url_pattern: string | null;
  schema_json: JsonLdGraph;
  generated_content_id: string | null;
  source_mode: SourceMode;
  content_hash: string | null;
  cache_version: number;
  page_type: string | null;
  entity_matches: EntityMatch[] | null;
  confidence_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface EntityMatch {
  candidate_term: string;
  matched_entity_id: string;
  entity_type: 'glossary_term' | 'psych_node';
  match_type: 'exact' | 'alias' | 'fuzzy';
  confidence_score: number;
  schema_id: string;
}

// ============================================
// DRIFT DETECTION
// ============================================

export type DriftType = 'content_change' | 'structure_change' | 'entity_drift';

export interface DriftSignal {
  id: string;
  organization_id: string;
  page_url: string;
  content_hash: string;
  previous_hash: string | null;
  drift_detected: boolean;
  drift_type: DriftType | null;
  processed: boolean;
  processed_at: string | null;
  signals: DriftSignalMetadata | null;
  created_at: string;
}

export interface DriftSignalMetadata {
  title?: string;
  h1?: string;
  word_count?: number;
  word_count_delta?: number;
  [key: string]: unknown;
}

// ============================================
// EVIDENCE
// ============================================

export type EvidenceTier = 1 | 2 | 3;
export type ClaimConfidence = 'high' | 'medium' | 'low';

export interface EvidenceSource {
  id: string;
  organization_id: string;
  source_id: string;
  name: string;
  url: string;
  title: string | null;
  publication_date: string | null;
  tier: EvidenceTier;
  accessible: boolean;
  created_at: string;
}

export interface EvidenceClaim {
  id: string;
  claim_id: string;
  organization_id: string;
  source_id: string;
  claim_text: string;
  quote_verbatim: string | null;
  claim_type: string | null;
  confidence: ClaimConfidence;
  supports_edge_id: string | null;
  created_at: string;
}

// ============================================
// JSON-LD TYPES
// ============================================

export interface JsonLdGraph {
  '@context': string | Record<string, unknown>;
  '@graph': JsonLdNode[];
}

export interface JsonLdNode {
  '@type': string | string[];
  '@id': string;
  [key: string]: unknown;
}

export interface JsonLdArticle extends JsonLdNode {
  '@type': 'Article';
  headline: string;
  description?: string;
  wordCount?: number;
  articleBody?: string;
  datePublished?: string;
  dateModified?: string;
  author?: JsonLdReference | JsonLdOrganization;
  publisher?: JsonLdReference | JsonLdOrganization;
  about?: JsonLdReference[];
  mentions?: JsonLdReference[];
  hasPart?: JsonLdReference | JsonLdNode;
  isPartOf?: JsonLdReference | JsonLdNode;
  citation?: JsonLdCitation[];
  additionalProperty?: JsonLdPropertyValue[];
}

export interface JsonLdReference {
  '@id': string;
}

export interface JsonLdOrganization extends JsonLdNode {
  '@type': 'Organization';
  name: string;
  logo?: JsonLdImageObject;
}

export interface JsonLdImageObject extends JsonLdNode {
  '@type': 'ImageObject';
  url: string;
}

export interface JsonLdCitation extends JsonLdNode {
  '@type': 'ScholarlyArticle' | 'Article' | 'WebPage';
  name: string;
  description?: string;
  url?: string;
}

export interface JsonLdPropertyValue extends JsonLdNode {
  '@type': 'PropertyValue';
  name: string;
  value: string | number | boolean | JsonLdReference;
  propertyID?: string;
}

// ============================================
// VALIDATION CONFIG (from entity_registry)
// ============================================

export interface InternalLinkingThresholds {
  minimum_glossary_links: number;
  minimum_psych_node_links: number;
  maximum_glossary_links: number;
  maximum_psych_node_links: number;
  required_role_assignment: boolean;
  optional_journey_stage: boolean;
  optional_angle: boolean;
  optional_outcome: boolean;
  optional_persona: boolean;
}

export interface EdgeValidationRules {
  strong_claim_evidence_threshold: number;
  tendency_evidence_threshold: number;
  validate_domain_range: boolean;
  allow_type_inheritance: boolean;
}

// Default values from entity_registry_v3.1.json
export const DEFAULT_LINKING_THRESHOLDS: InternalLinkingThresholds = {
  minimum_glossary_links: 2,
  minimum_psych_node_links: 1,
  maximum_glossary_links: 5,
  maximum_psych_node_links: 3,
  required_role_assignment: true,
  optional_journey_stage: true,
  optional_angle: true,
  optional_outcome: true,
  optional_persona: true,
};

export const DEFAULT_EDGE_VALIDATION: EdgeValidationRules = {
  strong_claim_evidence_threshold: 2,
  tendency_evidence_threshold: 1,
  validate_domain_range: true,
  allow_type_inheritance: true,
};

// ============================================
// ENTITY ID PREFIXES
// ============================================

export const ENTITY_PREFIXES = {
  THEME: 'theme_',
  SUBTOPIC: 'sub_',
  GLOSSARY: 'g_',
  PSYCH: 'psych_',
  PERSONA: 'persona_',
  ROLE: 'role_',
  STAGE: 'stage_',
  ANGLE: 'angle_',
  OUTCOME: 'outcome_',
  RELATION: 'REL',
} as const;

export type EntityPrefix = typeof ENTITY_PREFIXES[keyof typeof ENTITY_PREFIXES];

// ============================================
// NODE TYPE TAXONOMY
// ============================================

export const NODE_TYPES = [
  'Belief',
  'Emotion',
  'Fear',      // Subset of Emotion
  'Need',
  'Behavior',
  'Trigger',
  'Pattern',
  'Outcome',
  'Value',
  'Rule',
] as const;

export type NodeTypeName = typeof NODE_TYPES[number];

export const NODE_TYPE_HIERARCHY: Record<string, string | null> = {
  Belief: null,
  Emotion: null,
  Fear: 'Emotion',  // Fear inherits from Emotion
  Need: null,
  Behavior: null,
  Trigger: null,
  Pattern: null,
  Outcome: null,
  Value: null,
  Rule: null,
};
```

---

## Usage Example

```typescript
import { 
  Organization, 
  PageSchema, 
  GlossaryTerm,
  SourceMode 
} from './types/gears';

// Query organization
const org: Organization = await supabase
  .from('organizations')
  .select('*')
  .eq('domain', 'example.com')
  .single()
  .then(r => r.data);

// Insert schema with proper typing
const newSchema: Partial<PageSchema> = {
  organization_id: org.id,
  page_url: '/services/',
  schema_json: { '@context': 'https://schema.org', '@graph': [] },
  source_mode: 'projection' as SourceMode,
};

await supabase.from('page_schemas').insert(newSchema);
```
