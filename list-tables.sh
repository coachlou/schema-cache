#!/bin/bash
SOURCE_URL="https://makghlkulpflltpmuwlw.supabase.co"
SOURCE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ha2dobGt1bHBmbGx0cG11d2x3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTc1NTA0NywiZXhwIjoyMDgxMzMxMDQ3fQ.Q1hb28ryqijMa02ZbfrdbC0G8pHCwzkVQsziGJ-Av7Q"

echo "=== Listing all tables in database ==="
curl -s "${SOURCE_URL}/rest/v1/" \
  -H "apikey: ${SOURCE_KEY}" \
  -H "Authorization: Bearer ${SOURCE_KEY}" | jq '.definitions | keys'

echo ""
echo "=== Trying 'organizations' table (without UUID filter) ==="
curl -s "${SOURCE_URL}/rest/v1/organizations?limit=5" \
  -H "apikey: ${SOURCE_KEY}" \
  -H "Authorization: Bearer ${SOURCE_KEY}" | jq '.'
