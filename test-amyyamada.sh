#!/bin/bash
# Test script for amyyamada.com schemas

ORG_ID="grzzcqmbzedyykplusmn"
BASE_URL="https://makghlkulpflltpmuwlw.supabase.co"

echo "=== Testing amyyamada.com schema integration ==="
echo ""

# First, let's check if Edge Functions are deployed on this Supabase instance
echo "1. Testing get-schema endpoint..."
curl -s "${BASE_URL}/functions/v1/get-schema?client_id=${ORG_ID}&url=https://amyyamada.com" | jq . || echo "No jq available, raw output:"

echo ""
echo "2. Testing schema-loader endpoint..."
curl -s "${BASE_URL}/functions/v1/schema-loader?client_id=${ORG_ID}" | head -20

echo ""
echo "=== Test complete ==="
