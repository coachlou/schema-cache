#!/bin/bash
DEST_URL="https://uxkudwzbqijamqhuowly.supabase.co"
DEST_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4a3Vkd3picWlqYW1xaHVvd2x5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njk0NDg5OCwiZXhwIjoyMDgyNTIwODk4fQ.-35fjEcLcsfLH6ZoX0mXVUgc314B45QfFNl5JwYTWCc"

echo "=== Organizations with amyyamada domain ==="
curl -s "${DEST_URL}/rest/v1/organizations?domain=like.*amyyamada*" \
  -H "apikey: ${DEST_KEY}" \
  -H "Authorization: Bearer ${DEST_KEY}" | jq '.'

echo ""
echo "=== All organizations ==="
curl -s "${DEST_URL}/rest/v1/organizations" \
  -H "apikey: ${DEST_KEY}" \
  -H "Authorization: Bearer ${DEST_KEY}" | jq '.[] | {id, name, domain, base_url}'

echo ""
echo "=== Search for amyyamada in page_schemas ==="
curl -s "${DEST_URL}/rest/v1/page_schemas?page_url=like.*amyyamada*&limit=5" \
  -H "apikey: ${DEST_KEY}" \
  -H "Authorization: Bearer ${DEST_KEY}" | jq '.'
