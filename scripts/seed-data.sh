#!/bin/bash

# Script to populate Supabase database with sample data
# Usage: ./scripts/seed-data.sh [SUPABASE_PROJECT_REF] [SUPABASE_SERVICE_ROLE_KEY]

set -e

PROJECT_REF="${1:-uxkudwzbqijamqhuowly}"
SERVICE_ROLE_KEY="${2}"

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Error: SERVICE_ROLE_KEY is required"
  echo "Usage: ./scripts/seed-data.sh [PROJECT_REF] [SERVICE_ROLE_KEY]"
  exit 1
fi

BASE_URL="https://${PROJECT_REF}.supabase.co"

echo "🔧 Creating organization..."

# Create an organization and capture the response
ORG_RESPONSE=$(curl -s -X POST "${BASE_URL}/rest/v1/organizations" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "name": "Test Organization",
    "domain": "example.com",
    "base_url": "https://example.com"
  }')

echo "Organization created: $ORG_RESPONSE"

# Extract organization_id and api_key from response
# Keep variable name CLIENT_ID for backwards compatibility in script
CLIENT_ID=$(echo "$ORG_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
API_KEY=$(echo "$ORG_RESPONSE" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)

if [ -z "$CLIENT_ID" ]; then
  echo "❌ Failed to create organization"
  exit 1
fi

echo "✅ Organization created!"
echo "   Organization ID: $CLIENT_ID"
echo "   API Key: $API_KEY"

echo ""
echo "📝 Adding sample schemas..."

# Add schema for homepage
curl -s -X POST "${BASE_URL}/functions/v1/update-schema" \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"organization_id\": \"${CLIENT_ID}\",
    \"page_url\": \"https://example.com/\",
    \"schema_json\": {
      \"@context\": \"https://schema.org\",
      \"@type\": \"WebPage\",
      \"name\": \"Example Homepage\",
      \"description\": \"Welcome to our example website\"
    }
  }" | echo "   Homepage schema: $(cat)"

# Add schema for services page
curl -s -X POST "${BASE_URL}/functions/v1/update-schema" \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"organization_id\": \"${CLIENT_ID}\",
    \"page_url\": \"https://example.com/services/\",
    \"schema_json\": {
      \"@context\": \"https://schema.org\",
      \"@type\": \"Service\",
      \"name\": \"Our Services\",
      \"provider\": {
        \"@type\": \"Organization\",
        \"name\": \"Example Company\"
      }
    }
  }" | echo "   Services schema: $(cat)"

# Add schema for about page
curl -s -X POST "${BASE_URL}/functions/v1/update-schema" \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"organization_id\": \"${CLIENT_ID}\",
    \"page_url\": \"https://example.com/about/\",
    \"schema_json\": {
      \"@context\": \"https://schema.org\",
      \"@type\": \"AboutPage\",
      \"name\": \"About Us\",
      \"description\": \"Learn more about our company\"
    }
  }" | echo "   About schema: $(cat)"

echo ""
echo "✅ Sample data created!"
echo ""
echo "🚀 Test the schema loader:"
echo "   curl '${BASE_URL}/functions/v1/schema-loader?client_id=${CLIENT_ID}'"
echo ""
echo "🔍 Fetch a schema:"
echo "   curl '${BASE_URL}/functions/v1/get-schema?client_id=${CLIENT_ID}&url=https://example.com/services/'"
echo ""
echo "📋 Add this to your HTML <head>:"
echo "   <script src=\"${BASE_URL}/functions/v1/schema-loader?client_id=${CLIENT_ID}\"></script>"
