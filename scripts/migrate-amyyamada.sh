#!/bin/bash
# Migration script: Copy amyyamada.com data from source to schema-cache Supabase

# Source Supabase (amyyamada.com data)
SOURCE_URL="https://makghlkulpflltpmuwlw.supabase.co"
SOURCE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ha2dobGt1bHBmbGx0cG11d2x3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTc1NTA0NywiZXhwIjoyMDgxMzMxMDQ3fQ.Q1hb28ryqijMa02ZbfrdbC0G8pHCwzkVQsziGJ-Av7Q"
SOURCE_ORG_ID="grzzcqmbzedyykplusmn"

# Destination Supabase (schema-cache)
DEST_URL="https://uxkudwzbqijamqhuowly.supabase.co"

# Check if DEST_KEY is provided as argument
if [ -z "$1" ]; then
  echo "❌ Error: Please provide the schema-cache Supabase service role key"
  echo "Usage: $0 <SUPABASE_SERVICE_ROLE_KEY>"
  echo ""
  echo "Example: $0 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  exit 1
fi

DEST_KEY="$1"

echo "🔄 Migrating amyyamada.com data to schema-cache Supabase..."
echo ""

# Step 1: Fetch organization from source
echo "1️⃣  Fetching organization from source..."
ORG_DATA=$(curl -s "${SOURCE_URL}/rest/v1/organizations?id=eq.${SOURCE_ORG_ID}" \
  -H "apikey: ${SOURCE_KEY}" \
  -H "Authorization: Bearer ${SOURCE_KEY}")

ORG_NAME=$(echo "$ORG_DATA" | jq -r '.[0].name')
ORG_DOMAIN=$(echo "$ORG_DATA" | jq -r '.[0].domain')
ORG_BASE_URL=$(echo "$ORG_DATA" | jq -r '.[0].base_url')

if [ "$ORG_NAME" == "null" ]; then
  echo "❌ Failed to fetch organization"
  echo "Response: $ORG_DATA"
  exit 1
fi

echo "   ✓ Found: $ORG_NAME ($ORG_DOMAIN)"

# Step 2: Create organization in destination
echo ""
echo "2️⃣  Creating organization in schema-cache..."

NEW_ORG=$(curl -s "${DEST_URL}/rest/v1/organizations" \
  -X POST \
  -H "apikey: ${DEST_KEY}" \
  -H "Authorization: Bearer ${DEST_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"name\": \"$ORG_NAME\",
    \"domain\": \"$ORG_DOMAIN\",
    \"base_url\": \"$ORG_BASE_URL\"
  }")

NEW_ORG_ID=$(echo "$NEW_ORG" | jq -r '.[0].id')
NEW_API_KEY=$(echo "$NEW_ORG" | jq -r '.[0].api_key')

if [ "$NEW_ORG_ID" == "null" ]; then
  echo "   ⚠️  Organization might already exist, trying to fetch..."
  EXISTING_ORG=$(curl -s "${DEST_URL}/rest/v1/organizations?domain=eq.${ORG_DOMAIN}" \
    -H "apikey: ${DEST_KEY}" \
    -H "Authorization: Bearer ${DEST_KEY}")

  NEW_ORG_ID=$(echo "$EXISTING_ORG" | jq -r '.[0].id')
  NEW_API_KEY=$(echo "$EXISTING_ORG" | jq -r '.[0].api_key')
fi

echo "   ✓ Organization ID: $NEW_ORG_ID"
echo "   ✓ API Key: $NEW_API_KEY"

# Step 3: Fetch schemas from source
echo ""
echo "3️⃣  Fetching schemas from source..."

SCHEMAS=$(curl -s "${SOURCE_URL}/rest/v1/page_schemas?organization_id=eq.${SOURCE_ORG_ID}" \
  -H "apikey: ${SOURCE_KEY}" \
  -H "Authorization: Bearer ${SOURCE_KEY}")

SCHEMA_COUNT=$(echo "$SCHEMAS" | jq '. | length')
echo "   ✓ Found $SCHEMA_COUNT schemas"

# Step 4: Migrate each schema
echo ""
echo "4️⃣  Migrating schemas..."

echo "$SCHEMAS" | jq -c '.[]' | while read -r schema; do
  PAGE_URL=$(echo "$schema" | jq -r '.page_url')
  SCHEMA_JSON=$(echo "$schema" | jq -c '.schema_json')
  PAGE_TYPE=$(echo "$schema" | jq -r '.page_type // "null"')
  SOURCE_MODE=$(echo "$schema" | jq -r '.source_mode // "external"')
  CONFIDENCE=$(echo "$schema" | jq -r '.confidence_score // "null"')

  # Build JSON payload
  PAYLOAD=$(jq -n \
    --arg org_id "$NEW_ORG_ID" \
    --arg url "$PAGE_URL" \
    --argjson schema "$SCHEMA_JSON" \
    --arg mode "$SOURCE_MODE" \
    '{
      organization_id: $org_id,
      page_url: $url,
      schema_json: $schema,
      source_mode: $mode,
      cache_version: 1
    }')

  # Add optional fields
  if [ "$PAGE_TYPE" != "null" ]; then
    PAYLOAD=$(echo "$PAYLOAD" | jq --arg type "$PAGE_TYPE" '. + {page_type: $type}')
  fi

  if [ "$CONFIDENCE" != "null" ]; then
    PAYLOAD=$(echo "$PAYLOAD" | jq --argjson conf "$CONFIDENCE" '. + {confidence_score: $conf}')
  fi

  # Insert schema
  RESULT=$(curl -s "${DEST_URL}/rest/v1/page_schemas" \
    -X POST \
    -H "apikey: ${DEST_KEY}" \
    -H "Authorization: Bearer ${DEST_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates,return=representation" \
    -d "$PAYLOAD")

  if echo "$RESULT" | jq -e '.[0].id' > /dev/null 2>&1; then
    echo "   ✓ $PAGE_URL"
  else
    echo "   ❌ Failed: $PAGE_URL"
    echo "      Error: $RESULT"
  fi
done

echo ""
echo "✅ Migration complete!"
echo ""
echo "📋 Integration Details:"
echo "   Organization ID: $NEW_ORG_ID"
echo "   Domain: $ORG_DOMAIN"
echo "   API Key: $NEW_API_KEY"
echo ""
echo "📝 Embed this in ${ORG_DOMAIN} pages:"
echo "   <script src=\"https://schema.coachlou.com/functions/v1/schema-loader?client_id=${NEW_ORG_ID}\"></script>"
echo ""
echo "🧪 Test with:"
echo "   curl 'https://schema.coachlou.com/functions/v1/get-schema?client_id=${NEW_ORG_ID}&url=https://${ORG_DOMAIN}'"
