#!/bin/bash
SOURCE_URL="https://makghlkulpflltpmuwlw.supabase.co"
SOURCE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ha2dobGt1bHBmbGx0cG11d2x3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTc1NTA0NywiZXhwIjoyMDgxMzMxMDQ3fQ.Q1hb28ryqijMa02ZbfrdbC0G8pHCwzkVQsziGJ-Av7Q"

echo "=== Organizations with amyyamada domain ==="
curl -s "${SOURCE_URL}/rest/v1/organizations?domain=like.*amyyamada*" \
  -H "apikey: ${SOURCE_KEY}" \
  -H "Authorization: Bearer ${SOURCE_KEY}" | jq '.'

echo ""
echo "=== All organizations ==="
curl -s "${SOURCE_URL}/rest/v1/organizations" \
  -H "apikey: ${SOURCE_KEY}" \
  -H "Authorization: Bearer ${SOURCE_KEY}" | jq '.[] | {id, name, domain}'

echo ""
echo "=== Schema entities table structure ==="
curl -s "${SOURCE_URL}/rest/v1/schema_entities?limit=1" \
  -H "apikey: ${SOURCE_KEY}" \
  -H "Authorization: Bearer ${SOURCE_KEY}" | jq '.'
