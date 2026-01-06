#!/bin/bash
SOURCE_URL="https://makghlkulpflltpmuwlw.supabase.co"
SOURCE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ha2dobGt1bHBmbGx0cG11d2x3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTc1NTA0NywiZXhwIjoyMDgxMzMxMDQ3fQ.Q1hb28ryqijMa02ZbfrdbC0G8pHCwzkVQsziGJ-Av7Q"
SOURCE_ORG_ID="grzzcqmbzedyykplusmn"

echo "=== Checking source database ==="
echo "Organization:"
curl -s "${SOURCE_URL}/rest/v1/organizations?id=eq.${SOURCE_ORG_ID}" \
  -H "apikey: ${SOURCE_KEY}" \
  -H "Authorization: Bearer ${SOURCE_KEY}" | jq '.'

echo ""
echo "Page schemas:"
curl -s "${SOURCE_URL}/rest/v1/page_schemas?organization_id=eq.${SOURCE_ORG_ID}&limit=2" \
  -H "apikey: ${SOURCE_KEY}" \
  -H "Authorization: Bearer ${SOURCE_KEY}" | jq '.'
