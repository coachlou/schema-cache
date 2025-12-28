-- Schema Injection Service: Initial Database Schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Table: clients
-- Stores client configurations.
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL,                    -- e.g., "example.com"
  api_key TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for lookup by domain
CREATE INDEX idx_clients_domain ON clients(domain);

-- Table: page_schemas
-- Stores JSON-LD schemas per page URL.
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

-- Table: drift_signals
-- Stores content change signals for drift detection.
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

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_signals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- For Edge Functions using service role, RLS is bypassed
-- These policies are for any future direct access

-- Public can read schemas (needed for the loader)
CREATE POLICY "Public can read page_schemas" ON page_schemas
  FOR SELECT USING (true);

-- Public can read clients (for validation)
CREATE POLICY "Public can read clients" ON clients
  FOR SELECT USING (true);

-- Public can insert drift signals (from the loader)
CREATE POLICY "Public can insert drift_signals" ON drift_signals
  FOR INSERT WITH CHECK (true);
