#!/bin/bash
DEST_URL="https://uxkudwzbqijamqhuowly.supabase.co"
DEST_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4a3Vkd3picWlqYW1xaHVvd2x5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njk0NDg5OCwiZXhwIjoyMDgyNTIwODk4fQ.-35fjEcLcsfLH6ZoX0mXVUgc314B45QfFNl5JwYTWCc"

# Keep this one (has the most complete settings and earliest creation)
KEEP_ORG_ID="21c3dc7d-bf61-4f00-b2b5-945d98807cbf"

# Delete these duplicates
DUPLICATE_IDS=(
  "b592e608-cc5e-48ab-abee-d9cb9b54c742"
  "6e2896d8-8150-46b6-9d7a-9ed9275fc654"
  "7746b108-a374-4cfc-8d00-de71c22254b8"
  "789d2987-d5e8-4e28-9a5a-b74638f158c5"
  "91f6f228-58a5-4a57-aaaf-f5ba8c4173a0"
)

echo "🧹 Cleaning up duplicate organizations for amyyamada.com..."
echo ""
echo "Keeping organization: $KEEP_ORG_ID"
echo "Deleting ${#DUPLICATE_IDS[@]} duplicate organizations..."
echo ""

for org_id in "${DUPLICATE_IDS[@]}"; do
  echo "Deleting organization: $org_id"
  
  # Delete the organization (CASCADE will delete related page_schemas)
  RESULT=$(curl -s -X DELETE "${DEST_URL}/rest/v1/organizations?id=eq.${org_id}" \
    -H "apikey: ${DEST_KEY}" \
    -H "Authorization: Bearer ${DEST_KEY}" \
    -H "Prefer: return=minimal")
  
  if [ -z "$RESULT" ]; then
    echo "   ✓ Deleted successfully"
  else
    echo "   ❌ Error: $RESULT"
  fi
done

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Verifying remaining organizations for amyyamada.com:"
curl -s "${DEST_URL}/rest/v1/organizations?domain=eq.amyyamada.com" \
  -H "apikey: ${DEST_KEY}" \
  -H "Authorization: Bearer ${DEST_KEY}" | jq '.[] | {id, name, domain, created_at}'

echo ""
echo "Verifying page schemas:"
curl -s "${DEST_URL}/rest/v1/page_schemas?organization_id=eq.${KEEP_ORG_ID}&select=page_url" \
  -H "apikey: ${DEST_KEY}" \
  -H "Authorization: Bearer ${DEST_KEY}" | jq -r '.[].page_url'
