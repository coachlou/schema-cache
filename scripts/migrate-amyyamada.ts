// scripts/migrate-amyyamada.ts
// Migrates amyyamada.com data from one Supabase instance to the schema-cache instance

import { createClient } from 'npm:@supabase/supabase-js@2'

// Source: amyyamada.com Supabase
const SOURCE_URL = 'https://makghlkulpflltpmuwlw.supabase.co'
const SOURCE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ha2dobGt1bHBmbGx0cG11d2x3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTc1NTA0NywiZXhwIjoyMDgxMzMxMDQ3fQ.Q1hb28ryqijMa02ZbfrdbC0G8pHCwzkVQsziGJ-Av7Q'
const SOURCE_ORG_ID = 'grzzcqmbzedyykplusmn'

// Destination: schema-cache Supabase
const DEST_URL = 'https://uxkudwzbqijamqhuowly.supabase.co'
const DEST_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

if (!DEST_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set')
  console.log('Please set it with: export SUPABASE_SERVICE_ROLE_KEY=your-key')
  Deno.exit(1)
}

const sourceClient = createClient(SOURCE_URL, SOURCE_KEY)
const destClient = createClient(DEST_URL, DEST_KEY)

console.log('🔄 Migrating amyyamada.com data to schema-cache Supabase...\n')

// Step 1: Fetch organization from source
console.log('1️⃣  Fetching organization data from source...')
const { data: sourceOrg, error: orgFetchError } = await sourceClient
  .from('organizations')
  .select('*')
  .eq('id', SOURCE_ORG_ID)
  .single()

if (orgFetchError) {
  console.error('❌ Error fetching organization:', orgFetchError)
  Deno.exit(1)
}

console.log(`   ✓ Found organization: ${sourceOrg.name} (${sourceOrg.domain})`)

// Step 2: Insert organization into destination (or update if exists)
console.log('\n2️⃣  Creating organization in schema-cache database...')
const { data: newOrg, error: orgInsertError } = await destClient
  .from('organizations')
  .upsert({
    name: sourceOrg.name,
    domain: sourceOrg.domain,
    base_url: sourceOrg.base_url || `https://${sourceOrg.domain}`,
    settings: sourceOrg.settings || {},
  }, {
    onConflict: 'domain'
  })
  .select()
  .single()

if (orgInsertError) {
  console.error('❌ Error creating organization:', orgInsertError)
  Deno.exit(1)
}

const newOrgId = newOrg.id
console.log(`   ✓ Organization created with ID: ${newOrgId}`)
console.log(`   ✓ API Key: ${newOrg.api_key}`)

// Step 3: Fetch all page schemas from source
console.log('\n3️⃣  Fetching page schemas from source...')
const { data: sourceSchemas, error: schemaFetchError } = await sourceClient
  .from('page_schemas')
  .select('*')
  .eq('organization_id', SOURCE_ORG_ID)

if (schemaFetchError) {
  console.error('❌ Error fetching schemas:', schemaFetchError)
  Deno.exit(1)
}

console.log(`   ✓ Found ${sourceSchemas.length} page schemas`)

// Step 4: Insert schemas into destination
console.log('\n4️⃣  Migrating page schemas...')
let successCount = 0
let errorCount = 0

for (const schema of sourceSchemas) {
  const { error: schemaInsertError } = await destClient
    .from('page_schemas')
    .upsert({
      organization_id: newOrgId, // Use new org ID
      page_url: schema.page_url,
      schema_json: schema.schema_json,
      content_hash: schema.content_hash,
      cache_version: schema.cache_version || 1,
      source_mode: schema.source_mode || 'external',
      page_type: schema.page_type,
      entity_matches: schema.entity_matches,
      confidence_score: schema.confidence_score,
    }, {
      onConflict: 'organization_id,page_url'
    })

  if (schemaInsertError) {
    console.error(`   ❌ Error migrating ${schema.page_url}:`, schemaInsertError.message)
    errorCount++
  } else {
    console.log(`   ✓ Migrated: ${schema.page_url}`)
    successCount++
  }
}

console.log(`\n✅ Migration complete!`)
console.log(`   - Successfully migrated: ${successCount} schemas`)
if (errorCount > 0) {
  console.log(`   - Errors: ${errorCount} schemas`)
}

console.log('\n📋 Integration Details:')
console.log(`   Organization ID: ${newOrgId}`)
console.log(`   Domain: ${newOrg.domain}`)
console.log(`   API Key: ${newOrg.api_key}`)
console.log(`\n📝 Usage:`)
console.log(`   Embed this script tag in ${newOrg.domain} pages:`)
console.log(`   <script src="https://schema.coachlou.com/functions/v1/schema-loader?client_id=${newOrgId}"></script>`)
console.log(`\n🧪 Test with:`)
console.log(`   curl 'https://schema.coachlou.com/functions/v1/get-schema?client_id=${newOrgId}&url=https://${newOrg.domain}'`)
