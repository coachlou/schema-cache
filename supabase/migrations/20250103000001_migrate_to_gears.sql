-- ============================================
-- GEARS v3.6 Schema Migration
-- Migrates from clients-based to organizations-based schema
-- Date: 2025-01-03
-- ============================================

-- Step 1: Rename clients table to organizations
ALTER TABLE clients RENAME TO organizations;

-- Step 2: Add new required columns with temporary defaults
ALTER TABLE organizations ADD COLUMN base_url TEXT DEFAULT 'https://example.com';
ALTER TABLE organizations ADD COLUMN schema_version TEXT DEFAULT 'GEARS_v3.6';
ALTER TABLE organizations ADD COLUMN phase TEXT DEFAULT 'Phase_1_MVP';

-- Step 3: Backfill base_url from domain
-- This creates a valid URL from the domain field
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

-- Step 10: Rename indexes for clarity (PostgreSQL auto-updates column references)
ALTER INDEX IF EXISTS idx_clients_domain RENAME TO idx_organizations_domain;

-- Note: The following indexes are automatically updated by PostgreSQL when columns are renamed:
-- - idx_page_schemas_client_url (now references organization_id)
-- - idx_page_schemas_client_pattern (now references organization_id)
-- - idx_drift_unprocessed (now references organization_id)

-- Step 11: Add comment to track migration
COMMENT ON TABLE organizations IS 'GEARS v3.6 - Migrated from clients table on 2025-01-03';
COMMENT ON COLUMN organizations.base_url IS 'Required base URL for the organization (e.g., https://example.com)';
COMMENT ON COLUMN page_schemas.source_mode IS 'Source of schema: generation (from generated_content), projection (Mode B matching), or external (API upload)';
COMMENT ON COLUMN page_schemas.entity_matches IS 'Mode B entity matching results for projection schemas';
COMMENT ON COLUMN drift_signals.drift_type IS 'Type of drift detected: content_change, structure_change, or entity_drift';
