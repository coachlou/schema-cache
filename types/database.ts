// ============================================
// GEARS v3.6 Database Types
// Schema Cache Service - Core Types
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

export interface JsonLdReference {
  '@id': string;
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
// API REQUEST/RESPONSE TYPES
// ============================================

export interface UpdateSchemaRequest {
  organization_id: string;
  page_url: string;
  schema_json: JsonLdGraph | Record<string, unknown>;
  content_hash?: string;
}

export interface CollectSignalRequest {
  organization_id: string;
  url: string;
  signals: {
    content_hash: string;
    title?: string;
    h1?: string;
    word_count?: number;
    [key: string]: unknown;
  };
}

export interface GetDriftParams {
  organization_id: string;
  limit?: number;
}

export interface GetSchemaParams {
  organization_id: string;  // Internal: maps from client_id query param
  url: string;
}

// ============================================
// UTILITY TYPES
// ============================================

// For partial updates
export type PartialPageSchema = Partial<PageSchema> & {
  organization_id: string;
  page_url: string;
};

// For Supabase query results
export type DatabaseResult<T> = {
  data: T | null;
  error: Error | null;
};
